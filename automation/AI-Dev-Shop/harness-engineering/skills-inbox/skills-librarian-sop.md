# Skills Librarian SOP

## Goal
Centralize skill discovery and curation through one owner agent to keep canonical skills dense, coherent, and non-overlapping.

## Locations
- Inbox: `harness-engineering/skills-inbox/`
- Inbox archive: `harness-engineering/skills-inbox/archive/`
- Canonical skills: `skills/`
- Audit reports: `<ADS_MEMORY_ROOT>/reports/skills-audit/`

## Daily Operation
1. Intake requests from Coordinator only.
2. Stage candidate external skills in inbox.
3. Diff candidate vs canonical domain skill.
4. Extract net-new, compatible guidance.
5. Propose/perform surgical merge into canonical skill.
6. Archive staged candidate with decision note.
7. Publish short audit report with adopt/reject list.

## Output Template
- Domain: `<domain>`
- Canonical file: `<path>`
- Candidate source: `<repo/path>`
- Decision: `adopt | partial-adopt | reject`
- Net-new additions: 1-5 bullets
- Conflicts found: 0-N bullets
- Follow-up needed: yes/no

## Guardrails
- Do not keep two active skills for same domain.
- Do not overwrite canonical skill with external file.
- Do not write application code.
- Do not skip audit report.
