#!/usr/bin/env bash
# Opt-in hook installer for speckit.
# Run from the repo root: bash harness-engineering/hooks/install-hooks.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

if [[ ! -d "$GIT_HOOKS_DIR" ]]; then
  echo "Error: .git/hooks not found. Run this from the repo root."
  exit 1
fi

if [[ -f "$GIT_HOOKS_DIR/pre-commit" && ! -L "$GIT_HOOKS_DIR/pre-commit" ]]; then
  echo "Warning: existing .git/hooks/pre-commit found (not a symlink)."
  echo "Backing up to .git/hooks/pre-commit.bak"
  cp "$GIT_HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit.bak"
fi

ln -sf "$SCRIPT_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
chmod +x "$GIT_HOOKS_DIR/pre-commit"

echo "Installed pre-commit hook → harness-engineering/hooks/pre-commit"
echo "Runs: run-all.sh --profile precommit (fast checks only)"
echo ""
echo "Requirements: python3, pytest (pip install pytest)"
