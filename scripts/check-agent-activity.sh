#!/usr/bin/env bash
# Reports what agent-driven work has landed or is waiting on this repo since
# the last time this script ran on this machine — regardless of when you
# last checked (there's no "overnight" assumption; run it any time of day).
#
# Two delivery mechanisms, tracked differently:
#   1. Claude Code cloud routines push straight to origin/main. Detected by
#      diffing git log against a local marker SHA, split into
#      Claude-Session-tagged commits vs everything else.
#   2. Codex Cloud tasks do NOT push to git at all — they sit as a diff in
#      Codex's own queue until explicitly applied. Detected via
#      `codex cloud list --json`, diffed against a local marker of
#      previously-seen task ids/statuses.
#
# Usage:
#   scripts/check-agent-activity.sh              # report, prompt before verifying/applying
#   scripts/check-agent-activity.sh -y           # report, verify/apply without prompting
#   scripts/check-agent-activity.sh --report-only # report only, never pull/verify/apply/advance markers
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

GIT_MARKER_FILE=".claude/last-reviewed-sha"
CODEX_MARKER_FILE=".claude/last-reviewed-codex-tasks.json"
mkdir -p .claude

AUTO_YES=false
REPORT_ONLY=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) AUTO_YES=true ;;
    --report-only) REPORT_ONLY=true ;;
  esac
done

confirm() {
  local prompt="$1"
  if [ "$REPORT_ONLY" = true ]; then
    return 1
  fi
  if [ "$AUTO_YES" = true ]; then
    return 0
  fi
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

echo "############################################"
echo "# 1. Claude Code — git history since last check"
echo "############################################"

echo "Fetching origin..."
git fetch origin --quiet

if [ ! -f "$GIT_MARKER_FILE" ]; then
  git rev-parse origin/main > "$GIT_MARKER_FILE"
  echo "No marker found (first run on this machine) — baseline set to $(cat "$GIT_MARKER_FILE")."
  echo "Nothing to report yet; re-run this script after routines have had a chance to land commits."
else
  LAST=$(cat "$GIT_MARKER_FILE")

  if ! git merge-base --is-ancestor "$LAST" origin/main 2>/dev/null; then
    echo "Marker $LAST is not an ancestor of origin/main (rebase/force-push upstream?)."
    echo "Not auto-recovering — inspect manually, then update $GIT_MARKER_FILE yourself if this is expected."
  else
    NEW_COMMITS=$(git log "$LAST"..origin/main --oneline)
    if [ -z "$NEW_COMMITS" ]; then
      echo "No new commits on origin/main since last check ($LAST)."
    else
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

      echo
      if confirm "Pull these changes and run install + guard + typecheck + test now?"; then
        git pull --ff-only origin main
        pnpm install
        pnpm guard
        pnpm -r --if-present run typecheck
        pnpm -r --if-present run test
        git rev-parse origin/main > "$GIT_MARKER_FILE"
        echo "Verification complete. Marker advanced to $(cat "$GIT_MARKER_FILE")."
      else
        echo "Skipped pull/verify — marker left at $LAST, re-run to see the same report again."
      fi
    fi
  fi
fi

echo
echo "############################################"
echo "# 2. Codex Cloud — queued/ready tasks"
echo "############################################"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found on PATH — skipping."
  exit 0
fi

CURRENT_TASKS_JSON=$(codex cloud list --json 2>/dev/null || echo '{"tasks":[]}')
PREV_TASKS_JSON=$( [ -f "$CODEX_MARKER_FILE" ] && cat "$CODEX_MARKER_FILE" || echo '{"tasks":[]}' )

node --input-type=module -e "
import { readFileSync } from 'node:fs';
const current = JSON.parse(process.argv[1]).tasks ?? [];
const prev = JSON.parse(process.argv[2]).tasks ?? [];
const prevById = new Map(prev.map(t => [t.id, t]));

const isNew = [];
const changed = [];
for (const t of current) {
  const before = prevById.get(t.id);
  if (!before) isNew.push(t);
  else if (before.status !== t.status || before.summary?.files_changed !== t.summary?.files_changed) changed.push({ t, before });
}

if (isNew.length === 0 && changed.length === 0) {
  console.log('No new or changed Codex Cloud tasks since last check.');
  process.exit(0);
}

if (isNew.length) {
  console.log('=== New tasks ===');
  for (const t of isNew) {
    console.log(\`[\${t.status.toUpperCase()}] \${t.title}  (\${t.id})\`);
    console.log(\`  \${t.url}\`);
    console.log(\`  files_changed=\${t.summary?.files_changed ?? 0} +\${t.summary?.lines_added ?? 0} -\${t.summary?.lines_removed ?? 0}\`);
  }
}
if (changed.length) {
  console.log('=== Changed tasks ===');
  for (const { t, before } of changed) {
    console.log(\`[\${before.status} -> \${t.status}] \${t.title}  (\${t.id})\`);
    console.log(\`  \${t.url}\`);
    console.log(\`  files_changed=\${t.summary?.files_changed ?? 0} +\${t.summary?.lines_added ?? 0} -\${t.summary?.lines_removed ?? 0}\`);
  }
}

const worthReviewing = [...isNew, ...changed.map(c => c.t)].filter(t => (t.summary?.files_changed ?? 0) > 0);
if (worthReviewing.length) {
  console.log();
  console.log('=== Tasks with an actual diff to review ===');
  for (const t of worthReviewing) console.log(\`  \${t.id}  (\${t.title})\`);
}
" "$CURRENT_TASKS_JSON" "$PREV_TASKS_JSON"

# Offer to show diffs / apply for anything with an actual diff, new or changed.
TASK_IDS_WITH_DIFF=$(node -e "
const data = JSON.parse(process.argv[1]);
for (const t of (data.tasks ?? [])) {
  if ((t.summary?.files_changed ?? 0) > 0) console.log(t.id);
}
" "$CURRENT_TASKS_JSON")

if [ -n "$TASK_IDS_WITH_DIFF" ]; then
  echo
  for id in $TASK_IDS_WITH_DIFF; do
    if confirm "Show diff for $id now?"; then
      codex cloud diff "$id" || true
      if confirm "Apply $id locally now (codex cloud apply)?"; then
        codex cloud apply "$id"
      fi
    fi
  done
fi

if [ "$REPORT_ONLY" = false ]; then
  echo "$CURRENT_TASKS_JSON" > "$CODEX_MARKER_FILE"
else
  echo
  echo "--report-only: Codex Cloud task marker left untouched."
fi
