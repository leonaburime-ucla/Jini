# GOV-ADR-<NNN>: <short title>

- **Status:** PROPOSED | ACCEPTED | SUPERSEDED | DEPRECATED
- **Enforcement:** DEFAULT | MANDATORY | ADVISORY
- **Date:** <YYYY-MM-DD>
- **Author:** <agent or human>
- **Scope Globs:** <semicolon-separated file patterns, e.g. `src/domain/**; src/application/**`>

## Rule

State the rule in one or two sentences. Be direct and unambiguous.

## Why

Why does this rule exist? What recurring problem, drift, or incident motivated it? This section must survive context compaction — write it so a future agent or engineer with no history understands the constraint.

## Enforcement

How is this rule checked?

- [ ] Linter rule: <rule name or config>
- [ ] CI check: <pipeline step>
- [ ] Code review checklist item
- [ ] adr-governance skill path-match lookup
- [ ] Manual review only

## Comply-or-Explain (DEFAULT rules only)

Valid reasons to deviate:
- The rule's assumptions don't hold for this specific case (explain which)
- A newer technology or pattern makes the rule obsolete here (cite evidence)
- The rule conflicts with a MANDATORY governance ADR (cite which)

Exception record goes in `<ADS_MEMORY_ROOT>/governance/adrs/ADR-EXCEPTIONS.md`.

3+ exceptions against this ADR within 90 days triggers mandatory re-evaluation.

## Consequences

**Positive:** What this rule prevents or enables.

**Negative:** What friction or limitation this rule introduces.

## Re-evaluation Triggers

- <Calendar, scale, technology, or exception-count triggers>

## Related

- Origin: `<ADS_MEMORY_ROOT>/reports/pipeline/<NNN>-<feature>/adr.md` (if promoted from pipeline)
- Supersedes: GOV-ADR-<id> (if any)
- See also: <related governance ADRs>
