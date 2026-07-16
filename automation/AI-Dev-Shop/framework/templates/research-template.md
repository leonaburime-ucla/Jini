# Research: <feature-name>

- Spec: SPEC-<id> v<version> (hash: <sha256>)
- Date: <ISO-8601 UTC>
- Author: Software Architect Agent
- ADR: ADR-<id> (links here once written)

## Trigger

This research was required because the spec involves the following library or technology choices:

- <choice 1 — e.g., "message queue library for async job processing">
- <choice 2 — e.g., "ORM vs raw SQL for persistence layer">

## Candidate Evaluation

### Option A: <library/technology name>

- **Version evaluated**: <version>
- **License**: <license>
- **Maintenance status**: Last commit <date>, <open issues> open issues
- **Weekly downloads / adoption**: <metric>
- **Compatibility**: Works with <language version>, <platform>, existing deps? Yes / No / Partial — detail any conflicts
- **Performance**: <measured or referenced benchmark, not assumed>
- **Security**: Known CVEs: <none / list>. Last security audit: <date or unknown>. Dependency chain depth: <n>
- **Fit for spec requirements**: <maps to which FRs/ACs>

### Option B: <library/technology name>

- **Version evaluated**: <version>
- **License**: <license>
- **Maintenance status**: Last commit <date>, <open issues> open issues
- **Weekly downloads / adoption**: <metric>
- **Compatibility**: <detail>
- **Performance**: <detail>
- **Security**: <detail>
- **Fit for spec requirements**: <detail>

### Option C: Custom implementation

- **Justification for considering**: <why no library option is sufficient>
- **Estimated complexity**: <lines of code, modules, maintenance burden>
- **Risk**: <what can go wrong>

## Decision

**Selected**: <Option A / B / Custom>

**Rationale** (mapped to spec requirements):
- REQ-0X → satisfied by <feature of selected option>
- REQ-0Y → satisfied by <feature of selected option>
- Constitution Article I check: <COMPLIES because X / EXCEPTION — see ADR Complexity Justification>

**Rejected options and why**:

| Option | Rejection Reason |
|--------|-----------------|
| Option B | <specific disqualifying factor> |
| Custom | <why a library is preferred per Article I> |

## Open Questions

- <question — what additional data would resolve it — who decides>
