#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PROFILE="${1:-ci}"

# Strip --profile flag if passed as --profile=X or --profile X
if [[ "$PROFILE" == "--profile" ]]; then
  PROFILE="${2:-ci}"
elif [[ "$PROFILE" == --profile=* ]]; then
  PROFILE="${PROFILE#--profile=}"
fi

run_hard_checks() {
  echo "==> Harness hard checks"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_eval_suite_regressions.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_contracts.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_path_references.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_registry_integrity.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_evaluator_artifacts.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_load_bearing_audits.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_debate_routing_guard.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_slash_command_parity.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_swarm_model_identity_guard.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_specs_as_built_freshness.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_backend_manifest.py"
}

run_advisory_checks() {
  echo
  echo "==> Harness advisory audit"
  python3 "$ROOT_DIR/harness-engineering/validators/doc_garden_audit.py"
  python3 "$ROOT_DIR/harness-engineering/validators/doc_staleness_audit.py"
  bash "$ROOT_DIR/harness-engineering/validators/probe_host_capabilities.sh"
  bash "$ROOT_DIR/harness-engineering/validators/check_graphify_capability.sh"
  bash "$ROOT_DIR/harness-engineering/validators/check_codebase_memory_capability.sh"
  bash "$ROOT_DIR/harness-engineering/validators/check_codegraph_capability.sh"
}

run_precommit_checks() {
  echo "==> Pre-commit checks (fast)"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_path_references.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_registry_integrity.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_contracts.py"
  python3 "$ROOT_DIR/harness-engineering/validators/validate_slash_command_parity.py"
}

run_governance_scenarios() {
  echo
  echo "==> Governance scenarios"
  python3 -m pytest "$ROOT_DIR/harness-engineering/governance-scenarios/" -v --tb=short 2>&1
}

case "$PROFILE" in
  precommit)
    run_precommit_checks
    ;;
  ci)
    run_hard_checks
    run_advisory_checks
    run_governance_scenarios
    ;;
  governance)
    run_governance_scenarios
    ;;
  hard)
    run_hard_checks
    ;;
  advisory)
    run_advisory_checks
    ;;
  *)
    echo "Usage: run-all.sh [--profile] <precommit|ci|governance|hard|advisory>"
    echo "  precommit   — fast checks for git hooks (<5s)"
    echo "  ci          — full suite: hard + advisory + governance scenarios"
    echo "  governance  — governance scenario tests only"
    echo "  hard        — hard validators only (legacy default)"
    echo "  advisory    — advisory audits only"
    exit 1
    ;;
esac

echo
echo "==> Profile '$PROFILE' complete"
