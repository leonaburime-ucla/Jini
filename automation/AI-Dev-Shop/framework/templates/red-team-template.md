# Red-Team Findings: <feature-name>

- Feature: FEAT-<NNN>
- Spec version: <version>
- Spec hash: sha256:<hash>
- Red-Team completed: <ISO-8601 UTC>
- Finding count: <N> BLOCKING · <N> ADVISORY · <N> CONSTITUTION_FLAG

---

## BLOCKING Findings

Spec must be revised before Software Architect dispatch. If 3 or more BLOCKING findings exist, stop and route back to Spec Agent.

### RT-001
- Severity: BLOCKING
- Category: ambiguity | contradiction | untestable | missing-failure-mode | scope-creep
- Location: <AC ID or section reference>
- Description: <what the problem is>
- Suggested resolution: <what the spec should say to fix it>

---

## ADVISORY Findings

Spec Agent and human are informed. Human decides whether to revise or accept risk. Pipeline can advance if no BLOCKING findings remain.

### RT-002
- Severity: ADVISORY
- Category: ambiguity | contradiction | untestable | missing-failure-mode | scope-creep
- Location: <AC ID or section reference>
- Description: <what the problem is>
- Suggested resolution: <what the spec should say, or why this is acceptable risk>

---

## CONSTITUTION_FLAG Findings

Likely to require a constitution exception. Flagged for Architect awareness so Complexity Justification entries can be prepared proactively. Does not block Software Architect dispatch unless accompanied by BLOCKING findings.

### RT-003
- Severity: CONSTITUTION_FLAG
- Category: constitution
- Article: <Article number and name>
- Location: <requirement or AC reference>
- Description: <why this requirement likely creates constitution pressure>
- Architect note: <what the Software Architect should prepare in the ADR Complexity Justification>

---

## Routing Decision

`<N>` BLOCKING findings. `<decision: spec cleared for Software Architect dispatch / route back to Spec Agent>`

ADVISORY and CONSTITUTION_FLAG findings are included in Software Architect context. `<specific notes if any>`
