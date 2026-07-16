#!/usr/bin/env bash
set -euo pipefail

# Capability check for the codegraph candidate backend.
#
# codegraph is a CANDIDATE backend: it is NOT vendored. Its managed checkout
# under integrations/codegraph/upstream/ is .gitignored, so a fresh clone does
# not contain it. This script reports whether codegraph is usable and, only when
# explicitly asked, performs the human-approved download + build.
#
# Upstream: https://github.com/colbymchenry/codegraph (MIT, 100% local, no API key).
# Built entrypoint: <managed>/dist/bin/codegraph.js (run via `node`).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_MANAGED_DIR="$ROOT_DIR/integrations/codegraph/upstream"
MANAGED_DIR="${CODEGRAPH_MANAGED_DIR:-$DEFAULT_MANAGED_DIR}"
REPO_URL="${CODEGRAPH_REPO_URL:-https://github.com/colbymchenry/codegraph.git}"
# Pinned to the commit the eval suite was validated against. Override to track HEAD.
PIN_REF="${CODEGRAPH_PIN_REF:-7a361ef16eee63ec61585c76aff6e2f7742211c0}"
DOWNLOAD=false
BUILD=false
UPDATE=false
JSON_OUTPUT=""

usage() {
  cat <<'EOF'
Usage: check_codegraph_capability.sh [--download] [--build] [--update] [--json <path>] [--managed-dir <path>] [--repo-url <url>]

Checks whether the codegraph candidate backend is usable for AI Dev Shop.

Default behavior is read-only:
- detects node (>=20 <25) and npm
- detects the managed upstream checkout under integrations/codegraph/upstream/
- detects the built entrypoint dist/bin/codegraph.js

Mutating behavior (human-approved only):
- --download clones the upstream repo into the managed checkout path when missing
- --build  runs `npm install` + `npm run build` in the managed checkout
- --update runs `git fetch` + checks out the pinned ref, then rebuilds

codegraph is a candidate backend: clone/audit-only, not vendored. Do not run the
mutating flags without explicit human approval.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --download) DOWNLOAD=true; shift ;;
    --build)    BUILD=true; shift ;;
    --update)   UPDATE=true; shift ;;
    --json)     JSON_OUTPUT="$2"; shift 2 ;;
    --managed-dir) MANAGED_DIR="$2"; shift 2 ;;
    --repo-url) REPO_URL="$2"; shift 2 ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

command_status() {
  if command -v "$1" >/dev/null 2>&1; then printf 'enabled'; else printf 'unavailable'; fi
}

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
GIT_STATUS="$(command_status git)"
NPM_STATUS="$(command_status npm)"

NODE_STATUS="unavailable"
NODE_EVIDENCE="node not found"
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version 2>&1)"
  # Require node major >=20 and <25 per upstream engines field.
  if node -e 'const m=process.versions.node.split(".") [0]|0; process.exit(m>=20 && m<25 ? 0 : 1)' 2>/dev/null; then
    NODE_STATUS="enabled"
    NODE_EVIDENCE="$NODE_VERSION"
  else
    NODE_STATUS="unverified"
    NODE_EVIDENCE="$NODE_VERSION is outside the supported range (>=20 <25)"
  fi
fi

ENTRYPOINT="$MANAGED_DIR/dist/bin/codegraph.js"

# --- mutating: download ---------------------------------------------------
if [[ "$DOWNLOAD" == true ]]; then
  if [[ "$GIT_STATUS" != "enabled" ]]; then
    echo "error: cannot download codegraph because git is not available" >&2
    exit 1
  fi
  if [[ -d "$MANAGED_DIR/.git" ]]; then
    echo "Managed codegraph checkout already exists: $MANAGED_DIR"
  elif [[ -e "$MANAGED_DIR" ]]; then
    echo "error: managed path exists but is not a git checkout: $MANAGED_DIR" >&2
    exit 1
  else
    mkdir -p "$(dirname "$MANAGED_DIR")"
    git clone "$REPO_URL" "$MANAGED_DIR"
    if [[ -n "$PIN_REF" ]]; then
      git -C "$MANAGED_DIR" checkout --quiet "$PIN_REF" || \
        echo "warning: could not check out pinned ref $PIN_REF; staying on default branch" >&2
    fi
  fi
fi

# --- mutating: update -----------------------------------------------------
if [[ "$UPDATE" == true ]]; then
  if [[ ! -d "$MANAGED_DIR/.git" ]]; then
    echo "error: managed codegraph checkout is missing. Run with --download first." >&2
    exit 1
  fi
  git -C "$MANAGED_DIR" fetch --quiet origin
  if [[ -n "$PIN_REF" ]]; then
    git -C "$MANAGED_DIR" checkout --quiet "$PIN_REF"
  fi
  BUILD=true
fi

# --- mutating: build ------------------------------------------------------
if [[ "$BUILD" == true ]]; then
  if [[ ! -d "$MANAGED_DIR" ]]; then
    echo "error: managed codegraph checkout is missing. Run with --download first." >&2
    exit 1
  fi
  if [[ "$NPM_STATUS" != "enabled" ]]; then
    echo "error: cannot build codegraph because npm is not available" >&2
    exit 1
  fi
  ( cd "$MANAGED_DIR" && npm install && npm run build )
fi

# --- read-only: assess ----------------------------------------------------
MANAGED_STATUS="unavailable"
MANAGED_EVIDENCE="managed checkout not found"
MANAGED_REMOTE=""
MANAGED_HEAD=""
if [[ -d "$MANAGED_DIR/.git" ]]; then
  MANAGED_REMOTE="$(git -C "$MANAGED_DIR" remote get-url origin 2>/dev/null || true)"
  MANAGED_HEAD="$(git -C "$MANAGED_DIR" rev-parse --short HEAD 2>/dev/null || true)"
  MANAGED_STATUS="enabled"
  MANAGED_EVIDENCE="git checkout at $MANAGED_DIR"
elif [[ -e "$MANAGED_DIR" ]]; then
  MANAGED_STATUS="unverified"
  MANAGED_EVIDENCE="path exists but is not a git checkout: $MANAGED_DIR"
fi

CLI_STATUS="unavailable"
CLI_EVIDENCE="built entrypoint not found"
CLI_VERSION=""
if [[ -f "$ENTRYPOINT" ]]; then
  if [[ "$NODE_STATUS" == "enabled" ]] && CLI_VERSION="$(node "$ENTRYPOINT" --version 2>/dev/null | head -n 1)"; then
    CLI_STATUS="enabled"
    CLI_EVIDENCE="$ENTRYPOINT"
  else
    CLI_STATUS="unverified"
    CLI_EVIDENCE="entrypoint exists but did not run (check node version): $ENTRYPOINT"
  fi
fi

# Overall status + next-step recommendation form the guided-install ladder.
OVERALL_STATUS="unavailable"
RECOMMENDATION="codegraph is not installed. Ask the user before installing; then run this script with --download --build."
if [[ "$CLI_STATUS" == "enabled" ]]; then
  OVERALL_STATUS="enabled"
  RECOMMENDATION="Use codegraph via: node $ENTRYPOINT <command> -p <target> --json"
elif [[ "$MANAGED_STATUS" == "enabled" && ! -f "$ENTRYPOINT" ]]; then
  OVERALL_STATUS="unverified"
  RECOMMENDATION="Managed checkout exists but is not built. Run this script with --build."
elif [[ "$CLI_STATUS" == "unverified" ]]; then
  OVERALL_STATUS="unverified"
  RECOMMENDATION="Built entrypoint exists but did not run. Verify node is >=20 <25, then retry."
fi

REPORT_TEXT=$'codegraph Capability Check\n--------------------------\n'
REPORT_TEXT+="Generated: $GENERATED_AT"$'\n'
REPORT_TEXT+="Tier: candidate (clone/audit-only, not vendored)"$'\n'
REPORT_TEXT+="Overall: $OVERALL_STATUS"$'\n'
REPORT_TEXT+="CLI: $CLI_STATUS ($CLI_EVIDENCE)"
if [[ -n "$CLI_VERSION" ]]; then REPORT_TEXT+="; $CLI_VERSION"; fi
REPORT_TEXT+=$'\n'
REPORT_TEXT+="Managed checkout: $MANAGED_STATUS ($MANAGED_EVIDENCE)"$'\n'
if [[ -n "$MANAGED_REMOTE" ]]; then REPORT_TEXT+="Managed remote: $MANAGED_REMOTE"$'\n'; fi
if [[ -n "$MANAGED_HEAD" ]]; then REPORT_TEXT+="Managed head: $MANAGED_HEAD"$'\n'; fi
REPORT_TEXT+="node: $NODE_STATUS ($NODE_EVIDENCE)"$'\n'
REPORT_TEXT+="npm: $NPM_STATUS"$'\n'
REPORT_TEXT+="git: $GIT_STATUS"$'\n'
REPORT_TEXT+="Recommendation: $RECOMMENDATION"$'\n'

if [[ -n "$JSON_OUTPUT" ]]; then
  mkdir -p "$(dirname "$JSON_OUTPUT")"
  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$GENERATED_AT"
    printf '  "backend": "codegraph",\n'
    printf '  "tier": "candidate",\n'
    printf '  "overall_status": "%s",\n' "$OVERALL_STATUS"
    printf '  "cli": {\n'
    printf '    "status": "%s",\n' "$CLI_STATUS"
    printf '    "entrypoint": "%s",\n' "$(json_escape "$ENTRYPOINT")"
    printf '    "version": "%s"\n' "$(json_escape "$CLI_VERSION")"
    printf '  },\n'
    printf '  "managed_checkout": {\n'
    printf '    "status": "%s",\n' "$MANAGED_STATUS"
    printf '    "path": "%s",\n' "$(json_escape "$MANAGED_DIR")"
    printf '    "remote": "%s",\n' "$(json_escape "$MANAGED_REMOTE")"
    printf '    "head": "%s"\n' "$(json_escape "$MANAGED_HEAD")"
    printf '  },\n'
    printf '  "requirements": {\n'
    printf '    "node": {"status": "%s", "evidence": "%s"},\n' "$NODE_STATUS" "$(json_escape "$NODE_EVIDENCE")"
    printf '    "npm": {"status": "%s"},\n' "$NPM_STATUS"
    printf '    "git": {"status": "%s"}\n' "$GIT_STATUS"
    printf '  },\n'
    printf '  "recommendation": "%s"\n' "$(json_escape "$RECOMMENDATION")"
    printf '}\n'
  } > "$JSON_OUTPUT"
fi

printf '%s' "$REPORT_TEXT"
