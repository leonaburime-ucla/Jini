#!/usr/bin/env bash
# Reports what landed on origin/main since the last time this script ran on
# this machine (e.g. from cloud routines that fired overnight), separating
# cloud-routine commits (tagged with a `Claude-Session:` trailer) from
# everything else, then optionally pulls + verifies (install/guard/typecheck/
# test) before advancing the local marker.
#
# Usage:
#   scripts/check-overnight.sh              # report, prompt before verifying
#   scripts/check-overnight.sh -y            # report, verify without prompting
#   scripts/check-overnight.sh --report-only # report only, never pull/verify/advance the marker
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MARKER_FILE=".claude/last-reviewed-sha"
mkdir -p .claude

AUTO_YES=false
REPORT_ONLY=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) AUTO_YES=true ;;
    --report-only) REPORT_ONLY=true ;;
  esac
done

echo "Fetching origin..."
git fetch origin --quiet

if [ ! -f "$MARKER_FILE" ]; then
  git rev-parse origin/main > "$MARKER_FILE"
  echo "No marker found (first run on this machine) — baseline set to $(cat "$MARKER_FILE")."
  echo "Nothing to report yet; re-run this script after routines have had a chance to land commits."
  exit 0
fi

LAST=$(cat "$MARKER_FILE")

if ! git merge-base --is-ancestor "$LAST" origin/main 2>/dev/null; then
  echo "Marker $LAST is not an ancestor of origin/main (rebase/force-push upstream?)."
  echo "Not auto-recovering — inspect manually, then update $MARKER_FILE yourself if this is expected."
  exit 1
fi

NEW_COMMITS=$(git log "$LAST"..origin/main --oneline)
if [ -z "$NEW_COMMITS" ]; then
  echo "No new commits on origin/main since last check ($LAST)."
  exit 0
fi

echo
echo "=== New commits since last check ($LAST) ==="
git log "$LAST"..origin/main --oneline --stat

echo
echo "=== Cloud-routine commits (have a Claude-Session: trailer) ==="
FOUND_CLOUD=false
for sha in $(git log "$LAST"..origin/main --format="%H"); do
  if git show -s --format="%B" "$sha" | grep -q "^Claude-Session:"; then
    FOUND_CLOUD=true
    git log -1 --format="%h %s%n  %b" "$sha" | grep -v '^$'
    echo
  fi
done
[ "$FOUND_CLOUD" = false ] && echo "(none)"

echo "=== Other commits (no Claude-Session trailer — manual or another tool) ==="
FOUND_OTHER=false
for sha in $(git log "$LAST"..origin/main --format="%H"); do
  if ! git show -s --format="%B" "$sha" | grep -q "^Claude-Session:"; then
    FOUND_OTHER=true
    git log -1 --oneline "$sha"
  fi
done
[ "$FOUND_OTHER" = false ] && echo "(none)"

if [ "$REPORT_ONLY" = true ]; then
  echo
  echo "--report-only: not pulling, not verifying, marker left at $LAST."
  exit 0
fi

echo
if [ "$AUTO_YES" = false ]; then
  read -r -p "Pull these changes and run install + guard + typecheck + test now? [y/N] " CONFIRM
else
  CONFIRM="y"
fi

if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
  git pull --ff-only origin main
  pnpm install
  pnpm guard
  pnpm -r --if-present run typecheck
  pnpm -r --if-present run test
  git rev-parse origin/main > "$MARKER_FILE"
  echo
  echo "Verification complete. Marker advanced to $(cat "$MARKER_FILE")."
else
  echo "Skipped pull/verify — marker left at $LAST, re-run this script to see the same report again."
fi
