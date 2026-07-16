#!/usr/bin/env bash
# AI Dev Shop first-time initialization (host-agnostic).
#
# Runs once when the toolkit is first loaded into a host repo. It only does the
# safe, project-owned part:
#   - creates the ADS-memory/ workspace at the host project root
#   - writes a sentinel flag so subsequent sessions short-circuit instantly
#
# It deliberately does NOT install slash commands (see install-slash-commands.sh).
#
# Host/project-root resolution (does NOT depend on the toolkit folder name or on
# .claude already existing), highest priority first:
#   1. --host-dir PATH          explicit override
#   2. $ADS_HOST_DIR            explicit override via env
#   3. $CLAUDE_PROJECT_DIR      set by Claude Code to the launched project root
#   4. git toplevel of the toolkit (the repo that contains the toolkit = the host)
#   5. fallback: the toolkit root itself
# Caveat: if the toolkit was cloned as its OWN nested git repo inside a larger
# host repo, git toplevel resolves to the toolkit; use --host-dir/$ADS_HOST_DIR
# (or run under Claude Code, which sets $CLAUDE_PROJECT_DIR) in that case.
#
# Safety: refuses to operate when .claude, the workspace, or the sentinel target
# is a symlink or a non-regular object (prevents repo-controlled redirection of
# state writes outside the project). Idempotent; never blocks startup on error.
#   bash framework/operations/scripts/ads-initialization.sh             # run once
#   bash framework/operations/scripts/ads-initialization.sh --force     # re-run even if flagged
#   bash framework/operations/scripts/ads-initialization.sh --status    # report state only
#   bash framework/operations/scripts/ads-initialization.sh --host-dir /path/to/host

set -uo pipefail

SENTINEL_SCHEMA="ads-init/v1"

force=false
status_only=false
host_override=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)   force=true; shift ;;
    --status)  status_only=true; shift ;;
    --host-dir)
      if [ "$#" -lt 2 ]; then echo "ads-initialization: --host-dir requires a path" >&2; exit 2; fi
      host_override="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,29p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "ads-initialization: unknown argument: $1" >&2; exit 2 ;;
  esac
done

# --- locate the toolkit (independent of cwd) -------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ads_root="$(cd "$script_dir/../../.." && pwd)"          # toolkit root

# --- resolve the host project root (name-agnostic) -------------------------
resolve_host_dir() {
  if [ -n "$host_override" ]; then printf '%s' "$host_override"; return; fi
  if [ -n "${ADS_HOST_DIR:-}" ]; then printf '%s' "$ADS_HOST_DIR"; return; fi
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}" ]; then
    printf '%s' "$CLAUDE_PROJECT_DIR"; return
  fi
  local top
  top="$(git -C "$ads_root" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$top" ] && [ -d "$top" ]; then printf '%s' "$top"; return; fi
  printf '%s' "$ads_root"
}
host_dir="$(resolve_host_dir)"
if [ ! -d "$host_dir" ] || [ -L "$host_dir" ]; then
  echo "ads-initialization: resolved host dir is missing or a symlink: $host_dir (use --host-dir / \$ADS_HOST_DIR)" >&2
  exit 2
fi
host_dir="$(cd "$host_dir" && pwd -P)"   # normalize to absolute physical path

# Reject control characters in either path so the emitted JSON sentinel (which
# embeds both the toolkit root and the host root) is always valid for accepted
# paths. ads_root is the toolkit's own checkout path; a control-bearing path is
# self-inflicted on a single-user box, but we refuse rather than emit bad JSON.
for p in "$host_dir" "$ads_root"; do
  if printf '%s' "$p" | LC_ALL=C grep -q '[[:cntrl:]]'; then
    echo "ads-initialization: path contains control characters; refusing: $p" >&2
    exit 2
  fi
done

claude_dir="$host_dir/.claude"
flag_file="$claude_dir/.ads-initialized"
workspace_root="$host_dir/ADS-memory"
setup_script="$ads_root/framework/operations/scripts/setup-project-knowledge.sh"
install_cmds="$ads_root/framework/operations/scripts/install-slash-commands.sh"

# A path is "safe to write through" only if it is absent, or a real (non-symlink)
# object of the expected kind. Returns 0 if usable, 1 if it must be rejected.
# A dangling symlink is NOT "absent": [ ! -e ] is true for it, so also require ! -L.
is_real_dir_or_absent() { { [ ! -e "$1" ] && [ ! -L "$1" ]; } || { [ -d "$1" ] && [ ! -L "$1" ]; }; }
is_regular_or_absent()  { { [ ! -e "$1" ] && [ ! -L "$1" ]; } || { [ -f "$1" ] && [ ! -L "$1" ]; }; }

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

# A sentinel is valid only if it is a real, non-empty regular file carrying our
# schema marker AND the recorded workspace is a present real directory.
sentinel_valid() {
  [ -f "$flag_file" ] && [ ! -L "$flag_file" ] && [ -s "$flag_file" ] || return 1
  # Require the schema and workspace as AUTHORITATIVE top-level fields, exactly as
  # emitted (two-space indent, trailing comma) and exactly once each. Matching the
  # WHOLE line (grep -Fxc) means a nested/decoy field or a duplicate cannot satisfy
  # an unanchored substring search — a planted file with wrong top-level fields but
  # matching decoy substrings is rejected. Enforces I4.
  [ "$(grep -Fxc "  \"schema\": \"$SENTINEL_SCHEMA\"," "$flag_file" 2>/dev/null)" = "1" ] || return 1
  [ "$(grep -Fxc "  \"workspace\": \"$(json_escape "$workspace_root")\"," "$flag_file" 2>/dev/null)" = "1" ] || return 1
  [ -d "$workspace_root" ] && [ ! -L "$workspace_root" ] || return 1
  return 0
}

# --- status mode -----------------------------------------------------------
if [ "$status_only" = true ]; then
  echo "ads-initialization status"
  echo "  toolkit root : $ads_root"
  echo "  host root    : $host_dir"
  echo "  .claude dir  : $claude_dir$( [ -L "$claude_dir" ] && echo ' (SYMLINK — unsafe)')"
  echo "  workspace    : $workspace_root $( [ -L "$workspace_root" ] && echo '(SYMLINK — unsafe)' || { [ -d "$workspace_root" ] && echo '(exists)' || echo '(missing)'; } )"
  if sentinel_valid; then
    echo "  initialized  : yes ($flag_file)"
  elif [ -e "$flag_file" ] || [ -L "$flag_file" ]; then
    echo "  initialized  : INVALID sentinel present (will re-init)"
  else
    echo "  initialized  : no"
  fi
  exit 0
fi

# --- reject redirected state destinations ----------------------------------
if ! is_real_dir_or_absent "$claude_dir"; then
  echo "ads-initialization: refusing — $claude_dir is a symlink or non-directory" >&2
  exit 2
fi
if ! is_real_dir_or_absent "$workspace_root"; then
  echo "ads-initialization: refusing — $workspace_root is a symlink or non-directory" >&2
  exit 2
fi

# --- fast path: already initialized (only a VALID sentinel suppresses) ------
if sentinel_valid && [ "$force" != true ]; then
  exit 0
fi

# Everything below is best-effort; never fail a session start.
errors=0

# project-knowledge workspace (safe, project-owned). Pass --workspace explicitly
# so it lands at the resolved host root regardless of layout.
if [ -f "$setup_script" ]; then
  if ! bash "$setup_script" --workspace "$workspace_root" >/dev/null 2>&1; then
    echo "ads-initialization: warning — setup-project-knowledge.sh reported an error" >&2
    errors=$((errors + 1))
  fi
else
  echo "ads-initialization: warning — setup script missing: $setup_script" >&2
  errors=$((errors + 1))
fi

# postcondition: workspace must exist as a real directory (not a symlink).
if [ ! -d "$workspace_root" ] || [ -L "$workspace_root" ]; then
  echo "ads-initialization: warning — workspace not present as a real directory: $workspace_root" >&2
  errors=$((errors + 1))
fi

# write the sentinel flag atomically; refuse a redirected/non-regular target.
if [ "$errors" -eq 0 ]; then
  if ! mkdir -p "$claude_dir" 2>/dev/null || [ -L "$claude_dir" ]; then
    echo "ads-initialization: warning — cannot use $claude_dir" >&2
    errors=$((errors + 1))
  elif ! is_regular_or_absent "$flag_file"; then
    echo "ads-initialization: warning — sentinel target is a symlink/non-regular object: $flag_file" >&2
    errors=$((errors + 1))
  else
    tmp_flag="$(mktemp "$claude_dir/.ads-initialized.XXXXXX" 2>/dev/null || true)"
    if [ -z "$tmp_flag" ]; then
      echo "ads-initialization: warning — could not create temp sentinel in $claude_dir" >&2
      errors=$((errors + 1))
    else
      if printf '{\n  "schema": "%s",\n  "initialized_at": "%s",\n  "toolkit_root": "%s",\n  "host_root": "%s",\n  "workspace": "%s",\n  "workspace_created": true,\n  "slash_commands": "not installed by init — opt-in via install-slash-commands.sh",\n  "note": "Delete (or run ads-initialization.sh --force) to re-initialize."\n}\n' \
            "$SENTINEL_SCHEMA" \
            "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            "$(json_escape "$ads_root")" \
            "$(json_escape "$host_dir")" \
            "$(json_escape "$workspace_root")" > "$tmp_flag" \
         && mv -f "$tmp_flag" "$flag_file" \
         && [ -f "$flag_file" ] && [ ! -L "$flag_file" ]; then
        :
      else
        rm -f "$tmp_flag" 2>/dev/null || true
        echo "ads-initialization: warning — could not write a regular sentinel at $flag_file" >&2
        errors=$((errors + 1))
      fi
    fi
  fi
fi

# --- one-time guidance (added to session context on first run) -------------
if [ "$errors" -eq 0 ]; then
  echo "AI Dev Shop initialized: workspace ready at $workspace_root."
  echo "Slash commands are NOT auto-installed. To enable /spec, /plan, /code-review, etc.,"
  echo "the agent should ASK first, then run a collision check before installing:"
  echo "  bash \"$install_cmds\" --check      # preview NEW / IDENTICAL / CONFLICT vs existing commands"
  echo "  bash \"$install_cmds\" --install    # install safe ones; conflicts are skipped unless --overwrite"
  echo "On hosts without custom slash commands (Codex, Gemini, Claude.ai), paste the"
  echo "relevant framework/slash-commands/<name>.md contents instead (Option B)."
else
  echo "ads-initialization: completed with ${errors} warning(s); sentinel NOT written, so this will retry next session." >&2
fi
exit 0
