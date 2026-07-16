#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_INTEGRATION_DIR="$ROOT_DIR/integrations/codebase-memory-mcp"
INTEGRATION_DIR="${CODEBASE_MEMORY_INTEGRATION_DIR:-$DEFAULT_INTEGRATION_DIR}"
MANAGED_DIR="${CODEBASE_MEMORY_MANAGED_DIR:-$INTEGRATION_DIR/upstream}"
LOCAL_BIN="${CODEBASE_MEMORY_BIN:-$INTEGRATION_DIR/bin/codebase-memory-mcp}"
REPO_URL="${CODEBASE_MEMORY_REPO_URL:-https://github.com/DeusData/codebase-memory-mcp.git}"
DOWNLOAD=false
UPDATE=false
INSTALL_BINARY=false
JSON_OUTPUT=""

usage() {
  cat <<'EOF'
Usage: check_codebase_memory_capability.sh [--download] [--update] [--install-binary] [--json <path>] [--managed-dir <path>] [--repo-url <url>]

Checks whether Codebase Memory MCP is usable for AI Dev Shop.

Default behavior is read-only:
- detects installed `codebase-memory-mcp`
- detects the AI Dev Shop local binary under integrations/codebase-memory-mcp/bin/
- detects the managed upstream checkout under integrations/codebase-memory-mcp/upstream/

Mutating behavior:
- --download clones the upstream repo into the managed checkout path when missing
- --update runs `git pull --ff-only` in the managed checkout
- --install-binary runs upstream install.sh with --skip-config into integrations/codebase-memory-mcp/bin/
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
    --install-binary)
      INSTALL_BINARY=true
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
CURL_STATUS="$(command_status curl)"

if [[ "$DOWNLOAD" == true ]]; then
  if [[ "$GIT_STATUS" != "enabled" ]]; then
    echo "error: cannot download Codebase Memory MCP because git is not available" >&2
    exit 1
  fi
  if [[ -d "$MANAGED_DIR/.git" ]]; then
    echo "Managed Codebase Memory MCP checkout already exists: $MANAGED_DIR"
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
    echo "error: cannot update Codebase Memory MCP because git is not available" >&2
    exit 1
  fi
  if [[ ! -d "$MANAGED_DIR/.git" ]]; then
    echo "error: managed Codebase Memory MCP checkout is missing. Run with --download first." >&2
    exit 1
  fi
  git -C "$MANAGED_DIR" pull --ff-only
fi

if [[ "$INSTALL_BINARY" == true ]]; then
  if [[ ! -x "$MANAGED_DIR/install.sh" ]]; then
    echo "error: managed checkout with executable install.sh is missing. Run with --download first." >&2
    exit 1
  fi
  INSTALL_HEAD="$(git -C "$MANAGED_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "Running upstream install.sh from managed checkout at commit $INSTALL_HEAD"
  "$MANAGED_DIR/install.sh" --skip-config --dir="$INTEGRATION_DIR/bin"
fi

PATH_BIN_STATUS="unavailable"
PATH_BIN_PATH=""
PATH_BIN_VERSION=""
if command -v codebase-memory-mcp >/dev/null 2>&1; then
  PATH_BIN_PATH="$(command -v codebase-memory-mcp)"
  if PATH_BIN_VERSION="$(codebase-memory-mcp --version 2>/dev/null | head -n 1)"; then
    PATH_BIN_STATUS="enabled"
  else
    PATH_BIN_STATUS="unverified"
    PATH_BIN_VERSION="codebase-memory-mcp command exists but --version failed"
  fi
fi

LOCAL_BIN_STATUS="unavailable"
LOCAL_BIN_VERSION=""
if [[ -x "$LOCAL_BIN" ]]; then
  if LOCAL_BIN_VERSION="$("$LOCAL_BIN" --version 2>/dev/null | head -n 1)"; then
    LOCAL_BIN_STATUS="enabled"
  else
    LOCAL_BIN_STATUS="unverified"
    LOCAL_BIN_VERSION="local codebase-memory-mcp binary exists but --version failed"
  fi
elif [[ -e "$LOCAL_BIN" ]]; then
  LOCAL_BIN_STATUS="unverified"
  LOCAL_BIN_VERSION="local binary path exists but is not executable"
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
RECOMMENDATION="Ask before downloading Codebase Memory MCP; then run this script with --download."
if [[ "$LOCAL_BIN_STATUS" == "enabled" ]]; then
  OVERALL_STATUS="enabled"
  RECOMMENDATION="Use local binary at $LOCAL_BIN. Index with HOME=<ADS_MEMORY_ROOT>/.local-artifacts/codebase-memory-mcp-home $LOCAL_BIN cli index_repository '{\"repo_path\":\"<target>\"}'."
elif [[ "$PATH_BIN_STATUS" == "enabled" ]]; then
  OVERALL_STATUS="enabled"
  RECOMMENDATION="Use codebase-memory-mcp on PATH at $PATH_BIN_PATH."
elif [[ "$MANAGED_STATUS" == "enabled" ]]; then
  OVERALL_STATUS="unverified"
  RECOMMENDATION="Managed checkout exists. Install binary without agent config mutation using: bash harness-engineering/validators/check_codebase_memory_capability.sh --install-binary"
fi

REPORT_TEXT=$'Codebase Memory MCP Capability Check\n------------------------------------\n'
REPORT_TEXT+="Generated: $GENERATED_AT"$'\n'
REPORT_TEXT+="Overall: $OVERALL_STATUS"$'\n'
REPORT_TEXT+="Local binary: $LOCAL_BIN_STATUS"
if [[ -n "$LOCAL_BIN_VERSION" ]]; then
  REPORT_TEXT+=" ($LOCAL_BIN; $LOCAL_BIN_VERSION)"
fi
REPORT_TEXT+=$'\n'
REPORT_TEXT+="PATH binary: $PATH_BIN_STATUS"
if [[ -n "$PATH_BIN_PATH" ]]; then
  REPORT_TEXT+=" ($PATH_BIN_PATH; $PATH_BIN_VERSION)"
fi
REPORT_TEXT+=$'\n'
REPORT_TEXT+="Managed checkout: $MANAGED_STATUS ($MANAGED_EVIDENCE)"$'\n'
if [[ -n "$MANAGED_REMOTE" ]]; then
  REPORT_TEXT+="Managed remote: $MANAGED_REMOTE"$'\n'
fi
if [[ -n "$MANAGED_HEAD" ]]; then
  REPORT_TEXT+="Managed branch/head: ${MANAGED_BRANCH:-detached}/$MANAGED_HEAD"$'\n'
fi
REPORT_TEXT+="git: $GIT_STATUS"$'\n'
REPORT_TEXT+="curl: $CURL_STATUS"$'\n'
REPORT_TEXT+="Recommendation: $RECOMMENDATION"$'\n'

if [[ -n "$JSON_OUTPUT" ]]; then
  mkdir -p "$(dirname "$JSON_OUTPUT")"
  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$GENERATED_AT"
    printf '  "overall_status": "%s",\n' "$OVERALL_STATUS"
    printf '  "local_binary": {\n'
    printf '    "status": "%s",\n' "$LOCAL_BIN_STATUS"
    printf '    "path": "%s",\n' "$(json_escape "$LOCAL_BIN")"
    printf '    "version": "%s"\n' "$(json_escape "$LOCAL_BIN_VERSION")"
    printf '  },\n'
    printf '  "path_binary": {\n'
    printf '    "status": "%s",\n' "$PATH_BIN_STATUS"
    printf '    "path": "%s",\n' "$(json_escape "$PATH_BIN_PATH")"
    printf '    "version": "%s"\n' "$(json_escape "$PATH_BIN_VERSION")"
    printf '  },\n'
    printf '  "managed_checkout": {\n'
    printf '    "status": "%s",\n' "$MANAGED_STATUS"
    printf '    "path": "%s",\n' "$(json_escape "$MANAGED_DIR")"
    printf '    "remote": "%s",\n' "$(json_escape "$MANAGED_REMOTE")"
    printf '    "branch": "%s",\n' "$(json_escape "$MANAGED_BRANCH")"
    printf '    "head": "%s"\n' "$(json_escape "$MANAGED_HEAD")"
    printf '  },\n'
    printf '  "tools": {\n'
    printf '    "git": {"status": "%s"},\n' "$GIT_STATUS"
    printf '    "curl": {"status": "%s"}\n' "$CURL_STATUS"
    printf '  },\n'
    printf '  "recommendation": "%s"\n' "$(json_escape "$RECOMMENDATION")"
    printf '}\n'
  } > "$JSON_OUTPUT"
fi

printf '%s' "$REPORT_TEXT"
