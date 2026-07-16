#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: setup-project-knowledge.sh [--dry-run] [--workspace PATH]

Creates the sibling ADS-memory/ workspace used by AI Dev Shop.

Options:
  --dry-run          Show planned actions without writing files.
  --workspace PATH   Use a custom ADS-memory path.
  -h, --help         Show this help.

Default workspace:
  <host-project-root>/ADS-memory
  (host root resolved via $ADS_HOST_DIR, $CLAUDE_PROJECT_DIR, or git toplevel)
USAGE
}

dry_run=false
workspace_override=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --workspace)
      if [ "$#" -lt 2 ]; then
        echo "ERROR: --workspace requires a path" >&2
        exit 2
      fi
      workspace_override="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ads_root="$(cd "$script_dir/../../.." && pwd)"

# Resolve the host project root the same name-agnostic way ads-initialization.sh
# does, so the default workspace lands at the host root regardless of layout
# (dev = toolkit is the repo root; subfolder = toolkit inside a host repo).
resolve_host_dir() {
  if [ -n "${ADS_HOST_DIR:-}" ]; then printf '%s' "$ADS_HOST_DIR"; return; fi
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}" ]; then
    printf '%s' "$CLAUDE_PROJECT_DIR"; return
  fi
  local top
  top="$(git -C "$ads_root" rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -n "$top" ] && [ -d "$top" ]; then printf '%s' "$top"; return; fi
  # Layout undeterminable (no git, no env): treat the toolkit itself as the host
  # root rather than its parent, so a dev-layout archive does not create a junk
  # sibling. Pass --workspace explicitly to override.
  printf '%s' "$ads_root"
}
host_root="$(resolve_host_dir)"

if [ -n "$workspace_override" ]; then
  workspace_root="$workspace_override"
else
  workspace_root="$host_root/ADS-memory"
fi

provider_file="$ads_root/framework/spec-providers/active-provider.md"
active_provider="unknown"
if [ -f "$provider_file" ]; then
  parsed_provider="$(sed -n 's/^- active_provider: `\([^`]*\)`/\1/p' "$provider_file" | head -n 1)"
  if [ -n "$parsed_provider" ]; then
    active_provider="$parsed_provider"
  fi
fi

log() {
  printf '%s\n' "$1"
}

ensure_dir() {
  dir_path="$1"
  if [ -d "$dir_path" ]; then
    log "exists: $dir_path"
    return
  fi

  if [ "$dry_run" = true ]; then
    log "would create directory: $dir_path"
  else
    mkdir -p "$dir_path"
    log "created directory: $dir_path"
  fi
}

write_file_if_missing() {
  file_path="$1"
  content="$2"

  if [ -e "$file_path" ]; then
    log "preserved existing file: $file_path"
    return
  fi

  if [ "$dry_run" = true ]; then
    log "would create file: $file_path"
  else
    mkdir -p "$(dirname "$file_path")"
    printf '%s\n' "$content" > "$file_path"
    log "created file: $file_path"
  fi
}

copy_file_if_missing() {
  source_path="$1"
  target_path="$2"

  if [ -e "$target_path" ]; then
    log "preserved existing file: $target_path"
    return
  fi

  if [ ! -f "$source_path" ]; then
    echo "ERROR: source template missing: $source_path" >&2
    exit 1
  fi

  if [ "$dry_run" = true ]; then
    log "would copy file: $source_path -> $target_path"
  else
    mkdir -p "$(dirname "$target_path")"
    cp "$source_path" "$target_path"
    log "copied file: $source_path -> $target_path"
  fi
}

workspace_readme='# ADS Memory

This is the project-owned AI Dev Shop workspace. Commit retained project artifacts here so teammates and future agents can see the same durable context.

- `governance/`: project rules and the live constitution
- `knowledge/`: stable project memory, learnings, notes, and memory-store entries
- `sessions/`: session summaries (date, participants, models, Q&A, decisions)
- `specs/`: provider-native forward specs and planning artifacts
- `reports/`: retained ADRs, reviews, benchmarks, audits, and pipeline outputs
- `specs_as_built/`: curated current-state implementation knowledge generated from reverse-spec and post-implementation capture
- `meta/`: project-owned workflow notes, migration state, and workspace metadata
- `.local-artifacts/`: local scratch output ignored by git

Do not put secrets in this workspace. Keep short-lived local scratch in `.local-artifacts/`.'

governance_readme='# Governance

Project-owned governance files live here.

The main runtime file is `constitution.md`. AI Dev Shop planning and architecture stages read it to understand project-specific constraints, principles, and exception rules.'

memory_readme='# Knowledge

Project-owned knowledge files live here.

- `project_memory.md`: stable project conventions, constraints, and gotchas
- `learnings.md`: lessons learned, postmortems, and repeated failure patterns
- `project_notes.md`: temporary notes, open questions, and parking lot items
- `memory-store.md`: structured memory entries when a workflow needs tagged retrieval'

reports_readme='# Reports

Retained AI Dev Shop artifacts live here.

Use this folder for pipeline outputs, codebase analysis, architecture decisions, reviews, test certifications, security reports, benchmark results, and other project-owned records that should be visible to teammates.'

meta_readme='# Meta

Workspace metadata and project-owned operating notes live here.

Use this folder for workflow notes, migration state, version markers, and other bookkeeping that should travel with the project.'

sessions_readme='# Sessions

One file per conversation: what was discussed, learned, asked, and answered.

## File naming
`YYYY-MM-DD-HHmmSS-<topic>.md` — UTC timestamp of when the session started.
The in-progress record is `CURRENT-SESSION.md` until it is finalized.

## Contents (each file)
- Date and time (UTC), and the user
- Model(s) used (e.g. Claude Opus 4.8, Codex 5.5 xhigh — several if more than one participated)
- Summary of what was accomplished
- Questions & Answers
- Decisions & Learnings

## How it works
`harness-engineering/hooks/session-record.sh` maintains the record. On Claude Code it runs
automatically (Stop refreshes it, SessionEnd archives it). On other hosts the AI runs it
directly. Ask the AI to "save this session" and it writes the summary and model list.
See `harness-engineering/hooks/README.md`.'

project_memory='# Project Memory

Use this file for stable project-specific conventions, constraints, gotchas, and patterns.

## Entries

- YYYY-MM-DD: <fact / convention / gotcha>'

learnings='# Learnings

Use this file for lessons learned, postmortem-style findings, and repeated failure patterns.

## Entries

- YYYY-MM-DD: <what failed or worked, why it mattered, and what to do next time>'

project_notes='# Project Notes

Use this file for temporary notes, open questions, and parking lot items.

## Entries

- YYYY-MM-DD: <open question / working note / deferred decision>'

memory_store='# Memory Store

Structured project memory entries can live here when a workflow needs tagged retrieval.

## Entries

_No entries yet._'

log "AI Dev Shop first-time project setup"
log "Toolkit root: $ads_root"
log "Workspace: $workspace_root"
log "Active provider: $active_provider"

ensure_dir "$workspace_root"
ensure_dir "$workspace_root/governance"
ensure_dir "$workspace_root/governance/adrs"
ensure_dir "$workspace_root/governance/contracts"
ensure_dir "$workspace_root/knowledge"
ensure_dir "$workspace_root/sessions"
ensure_dir "$workspace_root/specs"
ensure_dir "$workspace_root/reports"
ensure_dir "$workspace_root/specs_as_built"
ensure_dir "$workspace_root/specs_as_built/components"
ensure_dir "$workspace_root/specs_as_built/changelog"
ensure_dir "$workspace_root/specs_as_built/_meta"
ensure_dir "$workspace_root/meta"
ensure_dir "$workspace_root/.local-artifacts"

copy_file_if_missing \
  "$ads_root/framework/templates/bootstrap/workspace-gitignore.template" \
  "$workspace_root/.gitignore"

copy_file_if_missing \
  "$ads_root/framework/templates/bootstrap/constitution-template.md" \
  "$workspace_root/governance/constitution.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/adrs/README.md" \
  "$workspace_root/governance/adrs/README.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/adrs/ADR-INDEX.md" \
  "$workspace_root/governance/adrs/ADR-INDEX.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/contracts/specs-as-built-freshness.md" \
  "$workspace_root/governance/contracts/specs-as-built-freshness.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/contracts/README.md" \
  "$workspace_root/governance/contracts/README.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/contracts/computational-controls.md" \
  "$workspace_root/governance/contracts/computational-controls.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/contracts/runtime-validation.md" \
  "$workspace_root/governance/contracts/runtime-validation.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/contracts/architecture-fitness.md" \
  "$workspace_root/governance/contracts/architecture-fitness.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/governance/contracts/waivers.md" \
  "$workspace_root/governance/contracts/waivers.md"

write_file_if_missing "$workspace_root/README.md" "$workspace_readme"
write_file_if_missing "$workspace_root/governance/README.md" "$governance_readme"
write_file_if_missing "$workspace_root/knowledge/README.md" "$memory_readme"
copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs/README.md" \
  "$workspace_root/specs/README.md"
write_file_if_missing "$workspace_root/reports/README.md" "$reports_readme"
copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/README.md" \
  "$workspace_root/specs_as_built/README.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/system-overview.md" \
  "$workspace_root/specs_as_built/system-overview.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/architecture.md" \
  "$workspace_root/specs_as_built/architecture.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/dependency-graph.yaml" \
  "$workspace_root/specs_as_built/dependency-graph.yaml"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/global-ubiquitous-language.md" \
  "$workspace_root/specs_as_built/global-ubiquitous-language.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/components/README.md" \
  "$workspace_root/specs_as_built/components/README.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/changelog/README.md" \
  "$workspace_root/specs_as_built/changelog/README.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/_meta/freshness-policy.md" \
  "$workspace_root/specs_as_built/_meta/freshness-policy.md"

copy_file_if_missing \
  "$ads_root/project-knowledge-template/specs_as_built/_meta/generation-manifest.yaml" \
  "$workspace_root/specs_as_built/_meta/generation-manifest.yaml"
write_file_if_missing "$workspace_root/meta/README.md" "$meta_readme"
write_file_if_missing "$workspace_root/sessions/README.md" "$sessions_readme"
write_file_if_missing "$workspace_root/knowledge/project_memory.md" "$project_memory"
write_file_if_missing "$workspace_root/knowledge/learnings.md" "$learnings"
write_file_if_missing "$workspace_root/knowledge/project_notes.md" "$project_notes"
write_file_if_missing "$workspace_root/knowledge/memory-store.md" "$memory_store"

log ""
if [ "$dry_run" = true ]; then
  log "Dry run complete. Re-run without --dry-run to create missing files."
else
  log "Setup complete."
fi

log "Next steps:"
log "- Review and customize: $workspace_root/governance/constitution.md"
log "- Fill in stable project facts: $workspace_root/knowledge/project_memory.md"
log "- For team projects, commit ADS-memory/ so teammates share the same context."
log "- Do not commit .local-artifacts/; $workspace_root/.gitignore keeps it local."
