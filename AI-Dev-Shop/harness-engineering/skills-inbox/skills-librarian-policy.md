---
name: skills-librarian-policy
version: 1.0.0
last_updated: 2026-03-04
description: Centralized policy for external skill discovery, audit, merge, and pruning.
---

# Skills Librarian Policy

## Purpose
Prevent instruction drift by enforcing one canonical skill per domain while still ingesting useful improvements from external skills.

## Scope
Applies to any external skill source, including `skills.sh`, GitHub skill repos, and curated/community skill packs.

## Ownership
- `Skills Librarian` is the only owner of external skill discovery and ingestion.
- All other agents must route skill-gap requests through Coordinator to `Skills Librarian`.

## Hard Rules
1. One canonical skill per domain in repo `skills/`.
2. External overlap skills are never activated as parallel domain authorities.
3. `find-skills` usage is restricted to `Skills Librarian` only.
4. External skills are staged in `harness-engineering/skills-inbox/` before review.
5. Reviewed inputs are moved to `harness-engineering/skills-inbox/archive/` with decision notes.
6. Merge by extraction and rewrite, never blind overwrite.
7. Every ingestion produces an audit artifact in `<ADS_MEMORY_ROOT>/reports/skills-audit/`.

## Request Contract (From Other Agents)
When an agent detects a capability gap, it submits:
- Gap summary (what is missing)
- Task impact (what could not be done well)
- Urgency (`low`, `medium`, `high`)
- Candidate domains or sources (optional)

## Ingestion Workflow
1. Discovery: Librarian searches candidate skills.
2. Stage: Pull candidate skill docs into inbox.
3. Audit: Compare against canonical skill for overlap/conflict/net-new signal.
4. Decision: `adopt`, `partial-adopt`, or `reject`.
5. Merge: Add only net-new compatible guidance to canonical skill.
6. Archive: Move staged files to archive and log rationale.
7. Report: Publish audit summary under `<ADS_MEMORY_ROOT>/reports/skills-audit/`.

## Decision Criteria
Adopt only when guidance is:
- Net-new (not already covered)
- Compatible with constitution/governance
- Actionable and testable
- Non-conflicting with pipeline contracts

Reject when guidance is:
- Duplicate or low signal
- Contradictory to governance
- Tooling-specific noise without reusable value

## Conflict Resolution
If external guidance conflicts with local canonical guidance:
- Local canonical guidance wins by default.
- Escalate only if external guidance offers measurable improvement and no governance conflict.
- Record decision and rationale in audit report.

## Cadence
- Run ingestion monthly, or ad hoc before major feature phases.
