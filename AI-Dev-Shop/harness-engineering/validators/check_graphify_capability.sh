#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_MANAGED_DIR="$ROOT_DIR/integrations/graphify/upstream"
MANAGED_DIR="${GRAPHIFY_MANAGED_DIR:-$DEFAULT_MANAGED_DIR}"
LOCAL_GRAPHIFY_BIN="$ROOT_DIR/integrations/graphify/.venv/bin/graphify"
REPO_URL="${GRAPHIFY_REPO_URL:-https://github.com/safishamsi/graphify.git}"
DOWNLOAD=false
UPDATE=false
SYNC_SKILL=false
JSON_OUTPUT=""

usage() {
  cat <<'EOF'
Usage: check_graphify_capability.sh [--download] [--update] [--sync-skill] [--json <path>] [--managed-dir <path>] [--repo-url <url>]

Checks whether Graphify is usable for AI Dev Shop.

Default behavior is read-only:
- detects installed `graphify`
- detects Python, uv, and pipx installer support
- detects the managed upstream checkout under integrations/graphify/upstream/

Mutating behavior:
- --download clones the upstream repo into the managed checkout path when missing
- --update runs `git pull --ff-only` in the managed checkout
- --sync-skill refreshes integrations/graphify/upstream-skill/codex/ from the managed checkout
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --download)
      DOWNLOAD=true
      shift
      ;;
    --update)
      UPDATE=true
      shift
      ;;
    --sync-skill)
      SYNC_SKILL=true
      shift
      ;;
    --json)
      JSON_OUTPUT="$2"
      shift 2
      ;;
    --managed-dir)
      MANAGED_DIR="$2"
      shift 2
      ;;
    --repo-url)
      REPO_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

command_status() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    printf 'enabled'
  else
    printf 'unavailable'
  fi
}

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
GIT_STATUS="$(command_status git)"
PYTHON_STATUS="unavailable"
PYTHON_EVIDENCE="python3 not found"
if command -v python3 >/dev/null 2>&1; then
  if python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PYTHON_STATUS="enabled"
    PYTHON_EVIDENCE="$(python3 --version 2>&1)"
  else
    PYTHON_STATUS="unavailable"
    PYTHON_EVIDENCE="$(python3 --version 2>&1) is below Python 3.10"
  fi
fi

UV_STATUS="$(command_status uv)"
PIPX_STATUS="$(command_status pipx)"

if [[ "$DOWNLOAD" == true ]]; then
  if [[ "$GIT_STATUS" != "enabled" ]]; then
    echo "error: cannot download Graphify because git is not available" >&2
    exit 1
  fi
  if [[ -d "$MANAGED_DIR/.git" ]]; then
    echo "Managed Graphify checkout already exists: $MANAGED_DIR"
  elif [[ -e "$MANAGED_DIR" ]]; then
    echo "error: managed path exists but is not a git checkout: $MANAGED_DIR" >&2
    exit 1
  else
    mkdir -p "$(dirname "$MANAGED_DIR")"
    git clone "$REPO_URL" "$MANAGED_DIR"
  fi
fi

if [[ "$UPDATE" == true ]]; then
  if [[ "$GIT_STATUS" != "enabled" ]]; then
    echo "error: cannot update Graphify because git is not available" >&2
    exit 1
  fi
  if [[ ! -d "$MANAGED_DIR/.git" ]]; then
    echo "error: managed Graphify checkout is missing. Run with --download first." >&2
    exit 1
  fi
  git -C "$MANAGED_DIR" pull --ff-only
fi

if [[ "$SYNC_SKILL" == true ]]; then
  if [[ ! -d "$MANAGED_DIR/.git" ]]; then
    echo "error: managed Graphify checkout is missing. Run with --download first." >&2
    exit 1
  fi
  SKILL_SRC="$MANAGED_DIR/graphify/skill-codex.md"
  REFS_SRC="$MANAGED_DIR/graphify/skills/codex/references"
  SKILL_DST="$ROOT_DIR/integrations/graphify/upstream-skill/codex/SKILL.md"
  REFS_DST="$ROOT_DIR/integrations/graphify/upstream-skill/codex/references"
  if [[ ! -f "$SKILL_SRC" || ! -d "$REFS_SRC" ]]; then
    echo "error: managed checkout does not contain the expected Codex skill files" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$SKILL_DST")" "$REFS_DST"
  cp "$SKILL_SRC" "$SKILL_DST"
  rm -rf "$REFS_DST"
  mkdir -p "$REFS_DST"
  cp "$REFS_SRC"/*.md "$REFS_DST"/
fi

CLI_STATUS="unavailable"
CLI_PATH=""
CLI_VERSION=""
if command -v graphify >/dev/null 2>&1; then
  CLI_PATH="$(command -v graphify)"
  if CLI_VERSION="$(graphify --version 2>/dev/null | head -n 1)"; then
    CLI_STATUS="enabled"
  else
    CLI_STATUS="unverified"
    CLI_VERSION="graphify command exists but --version failed"
  fi
elif [[ -x "$LOCAL_GRAPHIFY_BIN" ]]; then
  CLI_PATH="$LOCAL_GRAPHIFY_BIN"
  if CLI_VERSION="$("$LOCAL_GRAPHIFY_BIN" --version 2>/dev/null | head -n 1)"; then
    CLI_STATUS="enabled"
  else
    CLI_STATUS="unverified"
    CLI_VERSION="local graphify command exists but --version failed"
  fi
fi

MANAGED_STATUS="unavailable"
MANAGED_EVIDENCE="managed checkout not found"
MANAGED_REMOTE=""
MANAGED_BRANCH=""
MANAGED_HEAD=""
if [[ -d "$MANAGED_DIR/.git" ]]; then
  MANAGED_REMOTE="$(git -C "$MANAGED_DIR" remote get-url origin 2>/dev/null || true)"
  MANAGED_BRANCH="$(git -C "$MANAGED_DIR" branch --show-current 2>/dev/null || true)"
  MANAGED_HEAD="$(git -C "$MANAGED_DIR" rev-parse --short HEAD 2>/dev/null || true)"
  MANAGED_STATUS="enabled"
  MANAGED_EVIDENCE="git checkout at $MANAGED_DIR"
elif [[ -e "$MANAGED_DIR" ]]; then
  MANAGED_STATUS="unverified"
  MANAGED_EVIDENCE="path exists but is not a git checkout: $MANAGED_DIR"
fi

OVERALL_STATUS="unavailable"
RECOMMENDATION="Ask before downloading Graphify; then run this script with --download."
if [[ "$CLI_STATUS" == "enabled" ]]; then
  OVERALL_STATUS="enabled"
  RECOMMENDATION="Use Graphify CLI at $CLI_PATH. Run it with update <target> for the default code-only pass."
elif [[ "$MANAGED_STATUS" == "enabled" ]]; then
  OVERALL_STATUS="unverified"
  if [[ "$UV_STATUS" == "enabled" ]]; then
    RECOMMENDATION="Managed checkout exists. Install CLI with: uv tool install graphifyy"
  elif [[ "$PIPX_STATUS" == "enabled" ]]; then
    RECOMMENDATION="Managed checkout exists. Install CLI with: pipx install graphifyy"
  else
    RECOMMENDATION="Managed checkout exists, but no uv or pipx was found. Install uv/pipx or use a local Python venv."
  fi
fi

REPORT_TEXT=$'Graphify Capability Check\n-------------------------\n'
REPORT_TEXT+="Generated: $GENERATED_AT"$'\n'
REPORT_TEXT+="Overall: $OVERALL_STATUS"$'\n'
REPORT_TEXT+="CLI: $CLI_STATUS"
if [[ -n "$CLI_PATH" ]]; then
  REPORT_TEXT+=" ($CLI_PATH; $CLI_VERSION)"
fi
REPORT_TEXT+=$'\n'
REPORT_TEXT+="Managed checkout: $MANAGED_STATUS ($MANAGED_EVIDENCE)"$'\n'
if [[ -n "$MANAGED_REMOTE" ]]; then
  REPORT_TEXT+="Managed remote: $MANAGED_REMOTE"$'\n'
fi
if [[ -n "$MANAGED_HEAD" ]]; then
  REPORT_TEXT+="Managed branch/head: ${MANAGED_BRANCH:-detached}/$MANAGED_HEAD"$'\n'
fi
REPORT_TEXT+="Python: $PYTHON_STATUS ($PYTHON_EVIDENCE)"$'\n'
REPORT_TEXT+="uv: $UV_STATUS"$'\n'
REPORT_TEXT+="pipx: $PIPX_STATUS"$'\n'
REPORT_TEXT+="Recommendation: $RECOMMENDATION"$'\n'

if [[ -n "$JSON_OUTPUT" ]]; then
  mkdir -p "$(dirname "$JSON_OUTPUT")"
  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$GENERATED_AT"
    printf '  "overall_status": "%s",\n' "$OVERALL_STATUS"
    printf '  "cli": {\n'
    printf '    "status": "%s",\n' "$CLI_STATUS"
    printf '    "path": "%s",\n' "$(json_escape "$CLI_PATH")"
    printf '    "version": "%s"\n' "$(json_escape "$CLI_VERSION")"
    printf '  },\n'
    printf '  "managed_checkout": {\n'
    printf '    "status": "%s",\n' "$MANAGED_STATUS"
    printf '    "path": "%s",\n' "$(json_escape "$MANAGED_DIR")"
    printf '    "remote": "%s",\n' "$(json_escape "$MANAGED_REMOTE")"
    printf '    "branch": "%s",\n' "$(json_escape "$MANAGED_BRANCH")"
    printf '    "head": "%s"\n' "$(json_escape "$MANAGED_HEAD")"
    printf '  },\n'
    printf '  "installers": {\n'
    printf '    "python3": {"status": "%s", "evidence": "%s"},\n' "$PYTHON_STATUS" "$(json_escape "$PYTHON_EVIDENCE")"
    printf '    "uv": {"status": "%s"},\n' "$UV_STATUS"
    printf '    "pipx": {"status": "%s"}\n' "$PIPX_STATUS"
    printf '  },\n'
    printf '  "recommendation": "%s"\n' "$(json_escape "$RECOMMENDATION")"
    printf '}\n'
  } > "$JSON_OUTPUT"
fi

printf '%s' "$REPORT_TEXT"
