#!/usr/bin/env bash
# session-record.sh — LLM-agnostic session recorder for AI Dev Shop.
#
# Writes a per-conversation record to <host>/ADS-memory/sessions/. The record
# captures date/time, the user, the AI model(s) used, and a space for the AI to
# fill in a summary, the questions asked, the answers given, and decisions.
#
# It is host-agnostic on purpose so any LLM host can use it:
#   - Claude Code wires it to lifecycle hooks in .claude/settings.json
#     (Stop -> update, SessionEnd -> finalize, SessionStart -> finalize leftover).
#   - Codex CLI, Gemini CLI, and other hosts have no lifecycle hooks, so the
#     AI invokes it directly per the instruction in AGENTS.md.
#
# Model detection:
#   - Claude Code passes a Stop/SessionEnd JSON payload on stdin that includes a
#     "transcript_path". The transcript records the model on every message, so
#     this script reads it and captures every model used — including mid-session
#     /model switches. There is deliberately no reliance on a $CLAUDE_MODEL env
#     var: Claude Code does not set one (only SessionStart gets a "model" field).
#   - Peer models the transcript cannot see (Codex, Gemini dispatched as peers)
#     are supplied by the AI via --models "Name, Name". Detected + supplied
#     models are merged and de-duplicated.
#   - Non-Claude hosts with no transcript pass their model via --models.
#
# Subcommands:
#   update    Create or refresh ADS-memory/sessions/CURRENT-SESSION.md (metadata
#             block only; never touches the AI-written summary body).
#   finalize  Archive CURRENT-SESSION.md to a dated file
#             YYYY-MM-DD-HHmmSS-<topic>.md. No-op if no stub exists.
#
# Options (all optional):
#   --models "A, B"     Comma-separated model name(s) to merge into detection.
#   --user  "Name"      Override the recorded user (else $ADS_SESSION_USER,
#                       git config user.name, then $USER).
#   --project-dir PATH  Host project root (else $CLAUDE_PROJECT_DIR, else stdin
#                       "cwd", else git toplevel of this script).
#   --topic "text"      Topic slug hint for the finalized filename.
#
# Never fails a caller: always exits 0 (hooks must not break the session).
set -uo pipefail

subcommand="${1:-}"
shift || true

opt_models=""
opt_user=""
opt_project_dir=""
opt_topic=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --models)      opt_models="${2:-}"; shift 2 || shift ;;
    --user)        opt_user="${2:-}"; shift 2 || shift ;;
    --project-dir) opt_project_dir="${2:-}"; shift 2 || shift ;;
    --topic)       opt_topic="${2:-}"; shift 2 || shift ;;
    -h|--help)     sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)             shift ;;
  esac
done

# Slurp stdin once (Claude hook JSON arrives on a pipe). Only read when stdin is
# an actual pipe or regular file — reading an open interactive/other stdin with
# no EOF (e.g. when the AI runs this manually) would block forever.
stdin_data=""
if [ -p /dev/stdin ] || [ -f /dev/stdin ]; then
  stdin_data="$(cat 2>/dev/null || true)"
fi

json_field() {
  # Extract a top-level string field from the stdin JSON, best-effort.
  printf '%s' "$stdin_data" \
    | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | sed "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/" \
    | head -1
}

# --- resolve host project root -------------------------------------------------
resolve_project_dir() {
  if [ -n "$opt_project_dir" ] && [ -d "$opt_project_dir" ]; then printf '%s' "$opt_project_dir"; return; fi
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}" ]; then printf '%s' "$CLAUDE_PROJECT_DIR"; return; fi
  local c; c="$(json_field cwd)"
  if [ -n "$c" ] && [ -d "$c" ]; then printf '%s' "$c"; return; fi
  local script_dir top
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  top="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$top" ] && [ -d "$top" ]; then printf '%s' "$top"; return; fi
  printf '%s' ""
}

project_dir="$(resolve_project_dir)"
[ -n "$project_dir" ] || exit 0
sessions_dir="$project_dir/ADS-memory/sessions"
stub="$sessions_dir/CURRENT-SESSION.md"

# --- resolve user --------------------------------------------------------------
resolve_user() {
  if [ -n "$opt_user" ]; then printf '%s' "$opt_user"; return; fi
  if [ -n "${ADS_SESSION_USER:-}" ]; then printf '%s' "$ADS_SESSION_USER"; return; fi
  local g; g="$(git -C "$project_dir" config user.name 2>/dev/null || true)"
  if [ -n "$g" ]; then printf '%s' "$g"; return; fi
  printf '%s' "${USER:-Unknown}"
}

# --- model helpers -------------------------------------------------------------
friendly_model() {
  local id="$1" out
  case "$id" in
    "<synthetic>"|"") return ;;
    claude-opus-4-8*)   out="Claude Opus 4.8" ;;
    claude-opus-4-7*)   out="Claude Opus 4.7" ;;
    claude-opus-4-6*)   out="Claude Opus 4.6" ;;
    claude-sonnet-4-6*) out="Claude Sonnet 4.6" ;;
    claude-sonnet-4-5*) out="Claude Sonnet 4.5" ;;
    claude-haiku-4-5*)  out="Claude Haiku 4.5" ;;
    claude-fable-5*)    out="Claude Fable 5" ;;
    *)  # generic: drop trailing date, turn digit-dash into a version dot, title-case
      out="$(printf '%s' "$id" \
        | sed -E 's/-[0-9]{8}$//; s/([0-9])-([0-9])/\1.\2/g; s/[-_]/ /g' \
        | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')" ;;
  esac
  printf '%s' "$out"
}

detect_models() {
  # Emit friendly model names, one per line, from transcript + --models.
  local transcript raw
  transcript="$(json_field transcript_path)"
  if [ -n "$transcript" ] && [ -f "$transcript" ]; then
    local fm
    while IFS= read -r raw; do
      [ -n "$raw" ] || continue
      fm="$(friendly_model "$raw")"
      [ -n "$fm" ] && printf '%s\n' "$fm"
    done < <(grep -ho '"model"[[:space:]]*:[[:space:]]*"[^"]*"' "$transcript" 2>/dev/null \
               | sed 's/.*"model"[[:space:]]*:[[:space:]]*"//; s/"$//' | sort -u)
  fi
  # --models: split on commas, trim
  if [ -n "$opt_models" ]; then
    printf '%s' "$opt_models" | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$'
  fi
}

existing_models() {
  # Preserve models already recorded in the stub. The Claude transcript cannot
  # see external peers, and the Stop hook refreshes without --models, so peer
  # models supplied on an earlier update must not be dropped by a later refresh.
  [ -f "$stub" ] || return
  grep -m1 '^\*\*Models:\*\*' "$stub" 2>/dev/null \
    | sed 's/^\*\*Models:\*\* *//' \
    | tr ',' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' \
    | grep -v '^$' \
    | grep -v '^(pending'
}

models_line() {
  # Merge freshly detected/supplied models with any already recorded, dedupe
  # (preserve first-seen order), and join with ", ".
  { detect_models; existing_models; } | awk '!seen[$0]++' | paste -sd ',' - | sed 's/,/, /g'
}

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

case "$subcommand" in
  update)
    mkdir -p "$sessions_dir" 2>/dev/null || exit 0
    session_id="$(json_field session_id)"; [ -n "$session_id" ] || session_id="unknown"
    models="$(models_line)"; [ -n "$models" ] || models="(pending — set by AI)"
    user="$(resolve_user)"

    if [ ! -f "$stub" ]; then
      {
        printf '# Session — in progress\n\n'
        printf '**Started:** %s\n' "$now"
        printf '**Last activity:** %s\n' "$now"
        printf '**User:** %s\n' "$user"
        printf '**Session ID:** %s\n' "$session_id"
        printf '**Models:** %s\n\n' "$models"
        printf '<!-- METADATA ABOVE is auto-maintained by harness-engineering/hooks/session-record.sh.\n'
        printf '     The AI fills in the sections below when asked to "save this session" or at session end. -->\n\n'
        printf '## Summary\n\n_Not written yet._\n\n'
        printf '## Questions & Answers\n\n_Not written yet._\n\n'
        printf '## Decisions & Learnings\n\n_Not written yet._\n'
      } > "$stub"
    else
      # Refresh only the FIRST occurrence of each metadata line. The metadata block
      # is always written first, so the first match is the header line; a body line
      # the AI wrote with the same prefix is a later occurrence and is never touched
      # — this holds even if the "METADATA ABOVE" marker was hand-deleted (a sed
      # line-range would silently extend to EOF and clobber the body). awk -v uses
      # literal assignment, so model names / timestamps need no metacharacter escaping.
      # Values are passed through the environment and read via ENVIRON[] rather
      # than `awk -v`, because -v applies backslash-escape processing to the value;
      # ENVIRON[] is fully literal, so no model name / timestamp can be mangled.
      tmp="$(mktemp "$sessions_dir/.current.XXXXXX" 2>/dev/null || true)"
      if [ -n "$tmp" ]; then
        ADS_SR_NOW="$now" ADS_SR_MODELS="$models" awk '
          !ml && /^\*\*Last activity:\*\* / { $0 = "**Last activity:** " ENVIRON["ADS_SR_NOW"];    ml = 1 }
          !mm && /^\*\*Models:\*\* /        { $0 = "**Models:** "        ENVIRON["ADS_SR_MODELS"]; mm = 1 }
          { print }
        ' "$stub" > "$tmp" && mv -f "$tmp" "$stub" || rm -f "$tmp"
      fi
    fi
    ;;

  finalize)
    [ -f "$stub" ] || exit 0
    started="$(grep -m1 '^\*\*Started:\*\*' "$stub" | sed 's/^\*\*Started:\*\* *//')"
    [ -n "$started" ] || started="$now"
    # 2026-07-02T18:23:10Z -> 20260702-182310
    fname_ts="$(printf '%s' "$started" | sed -E 's/[-:]//g; s/T/-/; s/Z$//')"

    topic="$opt_topic"
    if [ -z "$topic" ]; then
      topic="$(grep -m1 '^# Session' "$stub" | sed 's/^# Session[[:space:]]*—*[[:space:]]*//')"
    fi
    case "$topic" in ""|"in progress"|"Session") topic="session" ;; esac
    slug="$(printf '%s' "$topic" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40)"
    [ -n "$slug" ] || slug="session"

    archive="$sessions_dir/${fname_ts}-${slug}.md"
    # Don't clobber an already-finalized file for this session.
    if [ -e "$archive" ]; then
      archive="$sessions_dir/${fname_ts}-${slug}-$(date -u +%s).md"
    fi
    mv "$stub" "$archive" 2>/dev/null || true
    ;;

  ""|-h|--help)
    sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    # Unknown subcommand: do nothing, never fail a hook.
    ;;
esac

exit 0
