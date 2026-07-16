#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CATALOG_PATH="$ROOT_DIR/framework/routing/capability-probes.tsv"
HOST_ARG=""
JSON_OUTPUT=""
MD_OUTPUT=""

usage() {
  cat <<'EOF'
Usage: resolve_subagent_mode.sh [--host <host>] [--json <path>] [--md <path>]

Resolves whether the current run should default to subagent-assisted execution
or single-agent mode using a lightweight current-host subagent probe.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST_ARG="$2"
      shift 2
      ;;
    --json)
      JSON_OUTPUT="$2"
      shift 2
      ;;
    --md)
      MD_OUTPUT="$2"
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

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

run_probe() {
  local command_name="$1"
  local probe_type="$2"
  local probe_value="$3"
  local failure_status="$4"
  local notes="$5"

  local status=""
  local verification_method="local_probe"
  local evidence=""
  local output=""

  case "$probe_type" in
    manual_only)
      status="unverified"
      verification_method="manual"
      evidence="$notes"
      printf '%s\t%s\t%s\n' "$status" "$verification_method" "$evidence"
      return 0
      ;;
  esac

  if ! command -v "$command_name" >/dev/null 2>&1; then
    status="unavailable"
    evidence="command '$command_name' not found on this host"
    printf '%s\t%s\t%s\n' "$status" "$verification_method" "$evidence"
    return 0
  fi

  case "$probe_type" in
    feature_flag_true)
      output="$("$command_name" features list 2>/dev/null || true)"
      if printf '%s\n' "$output" | awk -v key="$probe_value" '$1 == key { print $3 }' | tail -n 1 | grep -qx 'true'; then
        status="enabled"
        evidence="'$command_name features list' reported '$probe_value' true"
      else
        status="$failure_status"
        evidence="'$command_name features list' did not report '$probe_value' true"
      fi
      ;;
    help_contains_literal)
      output="$("$command_name" --help 2>/dev/null || true)"
      if printf '%s\n' "$output" | grep -Fq -- "$probe_value"; then
        status="enabled"
        evidence="'$command_name --help' contained '$probe_value'"
      else
        status="$failure_status"
        evidence="'$command_name --help' did not contain '$probe_value'"
      fi
      ;;
    *)
      status="unverified"
      verification_method="manual"
      evidence="unknown probe type '$probe_type'"
      ;;
  esac

  printf '%s\t%s\t%s\n' "$status" "$verification_method" "$evidence"
}

detect_host() {
  if [[ -n "${HOST_ARG:-}" ]]; then
    printf '%s' "$HOST_ARG"
    return 0
  fi

  if [[ -n "${AI_DEV_SHOP_HOST:-}" ]]; then
    printf '%s' "$AI_DEV_SHOP_HOST"
    return 0
  fi

  local found=()
  command -v codex >/dev/null 2>&1 && found+=("codex-cli")
  command -v claude >/dev/null 2>&1 && found+=("claude-code")
  command -v gemini >/dev/null 2>&1 && found+=("gemini-cli")

  if [[ "${#found[@]}" -eq 1 ]]; then
    printf '%s' "${found[0]}"
  else
    printf '%s' "generic-llm"
  fi
}

probe_current_host_subagent_status() {
  local target_host="$1"
  local row_found=0

  if [[ ! -f "$CATALOG_PATH" ]]; then
    echo "Capability catalog not found: $CATALOG_PATH" >&2
    exit 1
  fi

  while IFS=$'\t' read -r host command_name capability scope probe_type probe_value failure_status ttl_days notes; do
    [[ -z "${host:-}" ]] && continue
    [[ "${host:0:1}" == "#" ]] && continue
    [[ "$host" != "$target_host" ]] && continue
    [[ "$capability" != "subagent_spawning" ]] && continue

    row_found=1
    run_probe "$command_name" "$probe_type" "$probe_value" "$failure_status" "$notes"
    return 0
  done < "$CATALOG_PATH"

  if [[ "$row_found" -eq 0 ]]; then
    printf '%s\t%s\t%s\n' "unverified" "manual" "no subagent capability entry found for host '$target_host'"
  fi
}

RESOLVED_HOST="$(detect_host)"
PROBE_RESULT="$(probe_current_host_subagent_status "$RESOLVED_HOST")"
IFS=$'\t' read -r STATUS VERIFICATION_METHOD EVIDENCE <<< "$PROBE_RESULT"
EVIDENCE="$(trim_whitespace "$EVIDENCE")"

MODE="single-agent"
STARTUP_COPY=""

if [[ "$STATUS" == "enabled" ]]; then
  MODE="subagent-assisted"
  STARTUP_COPY='Sub-agent assistance is enabled on this host and defaults to automatic use for discovery, review, and safe parallel sidecar work. It usually spends more total tokens than keeping everything in one context; say "single-agent mode" or "disable subagents" if you want the cheaper sequential path.'
else
  STARTUP_COPY="Sub-agent assistance is $STATUS on this host, so the framework starts in sequential single-agent mode. Say \"re-enable subagents\" only after the host capability is verified."
fi

REPORT_TEXT=$'Subagent Mode Resolver\n----------------------\n'
REPORT_TEXT+="Host: $RESOLVED_HOST"$'\n'
REPORT_TEXT+="Capability: subagent_spawning"$'\n'
REPORT_TEXT+="Status: $STATUS"$'\n'
REPORT_TEXT+="Verification: $VERIFICATION_METHOD"$'\n'
REPORT_TEXT+="Recommended mode: $MODE"$'\n'
REPORT_TEXT+="Evidence: $EVIDENCE"$'\n'
REPORT_TEXT+="Startup copy: $STARTUP_COPY"$'\n'

if [[ -n "$MD_OUTPUT" ]]; then
  mkdir -p "$(dirname "$MD_OUTPUT")"
  cat > "$MD_OUTPUT" <<EOF
# Subagent Mode Resolution

- Host: \`$RESOLVED_HOST\`
- Capability: \`subagent_spawning\`
- Status: \`$STATUS\`
- Verification: \`$VERIFICATION_METHOD\`
- Recommended mode: \`$MODE\`
- Evidence: $EVIDENCE

$STARTUP_COPY
EOF
fi

if [[ -n "$JSON_OUTPUT" ]]; then
  mkdir -p "$(dirname "$JSON_OUTPUT")"
  cat > "$JSON_OUTPUT" <<EOF
{
  "host": "$(json_escape "$RESOLVED_HOST")",
  "capability": "subagent_spawning",
  "status": "$(json_escape "$STATUS")",
  "verification_method": "$(json_escape "$VERIFICATION_METHOD")",
  "recommended_mode": "$(json_escape "$MODE")",
  "evidence": "$(json_escape "$EVIDENCE")",
  "startup_copy": "$(json_escape "$STARTUP_COPY")"
}
EOF
fi

printf '%s' "$REPORT_TEXT"
