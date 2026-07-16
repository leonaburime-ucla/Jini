#!/usr/bin/env bash
# AI Dev Shop slash-command installer — opt-in and collision-checked.
#
# Slash commands are NOT installed automatically. The agent must ASK the user
# first, then run this. Before installing anything it classifies every command
# against what already exists so it never silently clobbers a command the host
# already has (e.g. an existing /code-review):
#
#   NEW       no command of that name in the target dir            -> safe to install
#   IDENTICAL same name, byte-identical content                    -> already installed, skip
#   CONFLICT  same name, DIFFERENT content                         -> would override; needs a decision
#   UNSAFE    target is a symlink / dir / non-regular file         -> never touched
# Plus a user-level note: a same-named command in ~/.claude/commands is compared
# and flagged user-dup (same), USER-SHADOW (different), or USER-UNSAFE (symlink/
# non-regular). NEW installs are atomic create-if-absent (no clobber under races);
# conflict overwrites back up the original to a UNIQUE mktemp file first.
#
# This is Claude Code-specific: only Claude Code reads <host>/.claude/commands/.
# Host resolution is name-agnostic and identical to ads-initialization.sh:
# --host-dir > $ADS_HOST_DIR > $CLAUDE_PROJECT_DIR > git toplevel > toolkit root.
#
# Usage:
#   install-slash-commands.sh --check                      # report only (no writes)
#   install-slash-commands.sh --install                    # install NEW; skip CONFLICT/project
#   install-slash-commands.sh --install --overwrite        # also replace CONFLICTs (unique backups)
#   install-slash-commands.sh --install --include-project  # also install gstack-* commands
#   install-slash-commands.sh --install --overwrite --only code-review  # exact scope (repeatable)
#   install-slash-commands.sh --host-dir /path/to/host ... # explicit host root
#
# Default action with no flags is --check (safe).

set -uo pipefail

mode="check"
overwrite=false
include_project=false
host_override=""
only_names=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check)           mode="check"; shift ;;
    --install)         mode="install"; shift ;;
    --overwrite)       overwrite=true; shift ;;
    --include-project) include_project=true; shift ;;
    --only)
      if [ "$#" -lt 2 ]; then echo "install-slash-commands: --only requires a command name" >&2; exit 2; fi
      n="${2#/}"; n="${n%.md}"
      if [ -z "$n" ]; then echo "install-slash-commands: --only name is empty" >&2; exit 2; fi
      only_names+=("$n"); shift 2 ;;
    --host-dir)
      if [ "$#" -lt 2 ]; then echo "install-slash-commands: --host-dir requires a path" >&2; exit 2; fi
      host_override="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "install-slash-commands: unknown argument: $1" >&2; exit 2 ;;
  esac
done

# --- locate toolkit + resolve host root (name-agnostic) --------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ads_root="$(cd "$script_dir/../../.." && pwd)"

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
  echo "install-slash-commands: resolved host dir is missing or a symlink: $host_dir (use --host-dir / \$ADS_HOST_DIR)" >&2
  exit 2
fi
host_dir="$(cd "$host_dir" && pwd -P)"

# Reject control characters in either operating path (keeps paths and any emitted
# diagnostics well-formed; a control-bearing path on a single-user box is
# self-inflicted, but we still refuse rather than act on a malformed path).
for p in "$host_dir" "$ads_root"; do
  if printf '%s' "$p" | LC_ALL=C grep -q '[[:cntrl:]]'; then
    echo "install-slash-commands: path contains control characters; refusing: $p" >&2
    exit 2
  fi
done

src_dir="$ads_root/framework/slash-commands"
dst_dir="$host_dir/.claude/commands"
if [ -n "${HOME:-}" ]; then user_dir="$HOME/.claude/commands"; else user_dir=""; fi

# Refuse to write through a symlinked or non-directory .claude / commands path.
# Rejecting an existing non-directory component up front keeps --check accurate
# (it would otherwise report child targets as NEW, then fail later at mkdir -p).
for d in "$host_dir/.claude" "$dst_dir"; do
  if [ -L "$d" ]; then
    echo "install-slash-commands: refusing to use symlinked directory: $d" >&2
    exit 2
  fi
  if [ -e "$d" ] && [ ! -d "$d" ]; then
    echo "install-slash-commands: refusing — path component exists and is not a directory: $d" >&2
    exit 2
  fi
done

if [ ! -d "$src_dir" ]; then
  echo "install-slash-commands: source missing: $src_dir" >&2
  exit 1
fi

is_project_cmd() { case "$1" in gstack-*) return 0 ;; *) return 1 ;; esac; }

# --only is an exact set; validate every requested name equals a real source
# basename. An exact per-name loop (not a space-delimited membership string)
# avoids a value spanning two adjacent names — e.g. "code-review consensus" —
# passing validation while selecting nothing.
if [ "${#only_names[@]}" -gt 0 ]; then
  for n in "${only_names[@]}"; do
    found=false
    for f in "$src_dir"/*.md; do
      [ -e "$f" ] || continue
      b="$(basename "$f")"; [ "$b" = "README.md" ] && continue
      if [ "${b%.md}" = "$n" ]; then found=true; break; fi
    done
    if [ "$found" != true ]; then
      echo "install-slash-commands: --only: no such command: /$n" >&2; exit 2
    fi
  done
fi
selected() {
  [ "${#only_names[@]}" -eq 0 ] && return 0
  local x; for x in "${only_names[@]}"; do [ "$x" = "$1" ] && return 0; done
  return 1
}

# classify a project-level target path
classify() {  # -> NEW|IDENTICAL|CONFLICT|UNSAFE  (args: src target)
  local s="$1" t="$2"
  if [ -L "$t" ] || { [ -e "$t" ] && [ ! -f "$t" ]; }; then echo "UNSAFE"; return; fi
  if [ ! -e "$t" ]; then echo "NEW"; return; fi
  if cmp -s "$s" "$t"; then echo "IDENTICAL"; else echo "CONFLICT"; fi
}

# atomic create-if-absent via hardlink: never clobbers an existing target.
# returns 0 installed, 1 error, 2 target appeared (treat as conflict)
install_new_noclobber() {  # args: src dst
  local s="$1" d="$2" tmp
  tmp="$(mktemp "${d}.tmp.XXXXXX" 2>/dev/null)" || return 1
  if ! cp "$s" "$tmp"; then rm -f "$tmp" 2>/dev/null; return 1; fi
  if ln "$tmp" "$d" 2>/dev/null; then rm -f "$tmp" 2>/dev/null; return 0; fi
  rm -f "$tmp" 2>/dev/null
  # Distinguish "target appeared" (conflict, 2) from a genuine ln failure
  # (unsupported hardlinks, permissions, ENOSPC) so we don't report a real
  # failure as a benign conflict and exit 0 having installed nothing.
  if [ -e "$d" ] || [ -L "$d" ]; then return 2; fi
  return 1
}
# atomic replace (overwrite path); verifies a regular file landed.
atomic_replace() {  # args: src dst
  local s="$1" d="$2" tmp
  tmp="$(mktemp "${d}.tmp.XXXXXX" 2>/dev/null)" || return 1
  if ! cp "$s" "$tmp"; then rm -f "$tmp" 2>/dev/null; return 1; fi
  if ! mv -f "$tmp" "$d"; then rm -f "$tmp" 2>/dev/null; return 1; fi
  [ -f "$d" ] && [ ! -L "$d" ] || return 1
  return 0
}
# unique, never-clobbering backup (always a fresh mktemp file)
backup_target() {  # args: target -> prints backup path on success
  local t="$1" bak
  bak="$(mktemp "${t}.ads-bak.XXXXXX" 2>/dev/null)" || return 1
  if cp -p "$t" "$bak"; then printf '%s' "$bak"; return 0; fi
  rm -f "$bak" 2>/dev/null; return 1
}

echo "Host root: $host_dir"
echo "Target   : $dst_dir"
[ "${#only_names[@]}" -gt 0 ] && echo "Filter   : --only ${only_names[*]}"
echo ""
printf '%-22s %-10s %-9s %s\n' "COMMAND" "STATUS" "SCOPE" "NOTES"
printf '%-22s %-10s %-9s %s\n' "-------" "------" "-----" "-----"

new=0; identical=0; conflict=0; unsafe=0; project_sel=0; user_shadow=0

for f in "$src_dir"/*.md; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  [ "$base" = "README.md" ] && continue
  name="${base%.md}"
  selected "$name" || continue

  target="$dst_dir/$base"
  status="$(classify "$f" "$target")"
  scope="core"; is_project_cmd "$base" && scope="project"
  notes=""

  # user-level shadow comparison; enter even for dangling symlinks ([-e] is false
  # for those, so also test [-L]); only cmp a real regular file (a FIFO would hang).
  if [ -n "$user_dir" ] && { [ -e "$user_dir/$base" ] || [ -L "$user_dir/$base" ]; }; then
    if [ -L "$user_dir/$base" ] || [ ! -f "$user_dir/$base" ]; then
      notes="USER-UNSAFE: ~/.claude/commands/$base is a symlink/non-regular file"
      user_shadow=$((user_shadow + 1))
    elif cmp -s "$f" "$user_dir/$base"; then
      notes="user-dup (same content in ~/.claude/commands)"
    else
      notes="USER-SHADOW: different ~/.claude/commands/$base — precedence ambiguity"
      user_shadow=$((user_shadow + 1))
    fi
  fi

  if [ "$scope" = "project" ] && [ "$include_project" != true ]; then
    project_sel=$((project_sel + 1))
    [ -n "$notes" ] && notes="$notes; "
    notes="${notes}needs --include-project"
  else
    case "$status" in
      NEW)       new=$((new + 1)) ;;
      IDENTICAL) identical=$((identical + 1)) ;;
      CONFLICT)  conflict=$((conflict + 1)) ;;
      UNSAFE)    unsafe=$((unsafe + 1)) ;;
    esac
  fi

  printf '%-22s %-10s %-9s %s\n' "/$name" "$status" "$scope" "$notes"
done

echo ""
echo "Actionable now: ${new} new to install, ${identical} identical (skip), ${conflict} conflict, ${unsafe} unsafe (never touched)."
echo "Held back: ${project_sel} project-specific (need --include-project), ${user_shadow} user-level shadow(s) to review."
if [ "$conflict" -gt 0 ]; then
  if [ "$overwrite" = true ]; then
    echo "Conflicts WILL be overwritten (--overwrite set); each original is backed up to a unique *.ads-bak.* file."
  else
    echo "Conflicts are NOT installed unless you pass --overwrite (each original backed up to a unique *.ads-bak.* file)."
    echo "Scope a single conflict with --only <command> to avoid replacing others."
  fi
fi
[ "$unsafe" -gt 0 ] && echo "UNSAFE targets (symlink/dir/non-regular) are never written — inspect them manually."

if [ "$mode" = "check" ]; then
  echo ""
  echo "No changes made (--check). Re-run with --install to apply."
  exit 0
fi

# --- install mode ----------------------------------------------------------
if ! mkdir -p "$dst_dir" 2>/dev/null || [ -L "$dst_dir" ]; then
  echo "install-slash-commands: cannot use target dir: $dst_dir" >&2
  exit 1
fi
installed=0; already=0; skipped_conflict=0; skipped_project=0; skipped_unsafe=0; failed=0

for f in "$src_dir"/*.md; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  [ "$base" = "README.md" ] && continue
  name="${base%.md}"
  selected "$name" || continue
  target="$dst_dir/$base"

  if is_project_cmd "$base" && [ "$include_project" != true ]; then
    skipped_project=$((skipped_project + 1)); continue
  fi

  case "$(classify "$f" "$target")" in
    UNSAFE)
      echo "skip UNSAFE (symlink/non-regular): $target" >&2
      skipped_unsafe=$((skipped_unsafe + 1)) ;;
    NEW)
      install_new_noclobber "$f" "$target"; rc=$?
      if [ "$rc" -eq 0 ]; then installed=$((installed + 1))
      elif [ "$rc" -eq 2 ]; then
        echo "skip: $target appeared during install (now a conflict)" >&2
        skipped_conflict=$((skipped_conflict + 1))
      else echo "FAILED to install: $target" >&2; failed=$((failed + 1)); fi ;;
    IDENTICAL)
      already=$((already + 1)) ;;
    CONFLICT)
      if [ "$overwrite" != true ]; then
        skipped_conflict=$((skipped_conflict + 1))
      else
        bak="$(backup_target "$target")"
        if [ -z "$bak" ]; then
          echo "FAILED to back up, NOT overwriting: $target" >&2; failed=$((failed + 1))
        elif atomic_replace "$f" "$target"; then
          installed=$((installed + 1)); echo "overwrote $target (backup: $bak)"
        else
          echo "FAILED to overwrite (backup kept at $bak): $target" >&2; failed=$((failed + 1))
        fi
      fi ;;
  esac
done

echo ""
echo "Installed ${installed}, already present ${already}, conflicts skipped ${skipped_conflict}, project skipped ${skipped_project}, unsafe skipped ${skipped_unsafe}, failed ${failed}."
echo "Target: $dst_dir"
if [ "$skipped_conflict" -gt 0 ]; then
  echo "Re-run with --overwrite (optionally --only <command>) to replace specific conflicts."
fi
[ "$failed" -gt 0 ] && exit 1
exit 0
