#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CATALOG_PATH="$ROOT_DIR/framework/routing/capability-probes.tsv"
MD_OUTPUT=""
JSON_OUTPUT=""
HOST_FILTER=""
CAPABILITY_FILTER=""

usage() {
  cat <<'EOF'
Usage: probe_host_capabilities.sh [--host <host>] [--capability <capability>] [--md <path>] [--json <path>] [--catalog <path>]

Runs local host capability probes from the capability catalog and prints a concise report.
Optionally writes markdown and JSON artifacts.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST_FILTER="$2"
      shift 2
      ;;
    --capability)
      CAPABILITY_FILTER="$2"
      shift 2
      ;;
    --md)
      MD_OUTPUT="$2"
      shift 2
      ;;
    --json)
      JSON_OUTPUT="$2"
      shift 2
      ;;
    --catalog)
      CATALOG_PATH="$2"
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

if [[ ! -f "$CATALOG_PATH" ]]; then
  echo "Capability catalog not found: $CATALOG_PATH" >&2
  exit 1
fi

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
    mcp_list_contains_literal)
      output="$("$command_name" mcp list 2>/dev/null || true)"
      if printf '%s\n' "$output" | grep -Fq -- "$probe_value"; then
        status="enabled"
        evidence="'$command_name mcp list' contained '$probe_value'"
      else
        status="$failure_status"
        evidence="'$command_name mcp list' did not contain '$probe_value'"
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

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
VERIFIED_ON="$(date -u +"%Y-%m-%d")"

REPORT_TEXT=$'Harness Host Capability Probe\n-----------------------------\n'
REPORT_TEXT+="Generated: $GENERATED_AT"$'\n'
REPORT_TEXT+="Catalog: ${CATALOG_PATH#$ROOT_DIR/}"$'\n'
if [[ -n "$HOST_FILTER" ]]; then
  REPORT_TEXT+="Host filter: $HOST_FILTER"$'\n'
fi
if [[ -n "$CAPABILITY_FILTER" ]]; then
  REPORT_TEXT+="Capability filter: $CAPABILITY_FILTER"$'\n'
fi

MD_TABLE=$'# Host Capability Report\n\n'
MD_TABLE+="Generated: $GENERATED_AT"$'\n\n'
MD_TABLE+="Catalog: \`${CATALOG_PATH#$ROOT_DIR/}\`"$'\n\n'
if [[ -n "$HOST_FILTER" ]]; then
  MD_TABLE+="Host filter: \`$HOST_FILTER\`"$'\n\n'
fi
if [[ -n "$CAPABILITY_FILTER" ]]; then
  MD_TABLE+="Capability filter: \`$CAPABILITY_FILTER\`"$'\n\n'
fi
MD_TABLE+='| Host | Capability | Scope | Status | Verification | Evidence | TTL (days) |'
MD_TABLE+=$'\n'
MD_TABLE+='|---|---|---|---|---|---|---|'
MD_TABLE+=$'\n'

JSON_ITEMS=()
ENTRY_COUNT=0

while IFS=$'\t' read -r host command_name capability scope probe_type probe_value failure_status ttl_days notes; do
  [[ -z "${host:-}" ]] && continue
  [[ "${host:0:1}" == "#" ]] && continue
  [[ -n "$HOST_FILTER" && "$host" != "$HOST_FILTER" ]] && continue
  [[ -n "$CAPABILITY_FILTER" && "$capability" != "$CAPABILITY_FILTER" ]] && continue

  probe_result="$(run_probe "$command_name" "$probe_type" "$probe_value" "$failure_status" "$notes")"
  IFS=$'\t' read -r status verification_method evidence <<< "$probe_result"
  evidence="$(trim_whitespace "$evidence")"

  REPORT_TEXT+="$host $capability: $status ($verification_method; $evidence)"$'\n'
  MD_TABLE+="| $host | $capability | $scope | $status | $verification_method | $evidence | $ttl_days |"$'\n'

  JSON_ITEMS+=("  {\"host\":\"$(json_escape "$host")\",\"command\":\"$(json_escape "$command_name")\",\"capability\":\"$(json_escape "$capability")\",\"scope\":\"$(json_escape "$scope")\",\"status\":\"$(json_escape "$status")\",\"verification_method\":\"$(json_escape "$verification_method")\",\"evidence\":\"$(json_escape "$evidence")\",\"verified_on\":\"$VERIFIED_ON\",\"ttl_days\":$ttl_days}")
  ENTRY_COUNT=$((ENTRY_COUNT + 1))
done < "$CATALOG_PATH"

REPORT_TEXT+="Entries: $ENTRY_COUNT"$'\n'
REPORT_TEXT+="ADVISORY: treat 'unverified' as unknown, not unsupported."$'\n'

if [[ -n "$MD_OUTPUT" ]]; then
  mkdir -p "$(dirname "$MD_OUTPUT")"
  printf '%s' "$MD_TABLE" > "$MD_OUTPUT"
fi

if [[ -n "$JSON_OUTPUT" ]]; then
  mkdir -p "$(dirname "$JSON_OUTPUT")"
  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$GENERATED_AT"
    printf '  "catalog": "%s",\n' "$(json_escape "${CATALOG_PATH#$ROOT_DIR/}")"
    printf '  "entries": [\n'
    for i in "${!JSON_ITEMS[@]}"; do
      printf '%s' "${JSON_ITEMS[$i]}"
      if (( i + 1 < ${#JSON_ITEMS[@]} )); then
        printf ',\n'
      else
        printf '\n'
      fi
    done
    printf '  ]\n'
    printf '}\n'
  } > "$JSON_OUTPUT"
fi

printf '%s' "$REPORT_TEXT"
