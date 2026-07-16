# AI Dev Shop (speckit edition) — Todo

Paradigms and improvements to research, document, and wire into the pipeline.
All items are documentation/agent-instruction work — no code required unless noted.

Items marked **[PARTIAL]** have foundational work already in this repo.

---

## Quick Status Snapshot

- AGENTS.md Map Reduction: **DONE / MONITORED**
- Observer Agent Operational Cadence: **DONE / MONITORED**
- Harness Audit Follow-Ons (all 10 items): **DONE**
- Git Branching and PR Strategy: **DONE**
- React Component Testing Policy: **DONE** (enforced via TDD routing)
- Execution Topology Default: **REMOVED** (toolkit already implements justified exception pattern)
- Multi-LLM Consensus Modes and Guardrails: **OPEN / PARTIAL** (consensus + preflight exists; strict model/version normalization still open)
- Agent Eval Depth: **OPEN / PARTIAL** (framework + taxonomy + CR regen + Architect catalog/schema reconciliation + first retained architect run done 2026-07-03; remaining: run CR suite, expand architect to scenarios 2-6)
- Architect Agent + Suite Gaps (2026-07-03 ablation): **OPEN** (3 capability gaps SEED-17/31/34 missed even with full skills; brief-gameable process-compliance seeds; skills add only +1.5–4.5pts over the brief — see "Architect Agent + Suite — Confirmed Gaps" under Agent Eval Depth)
- Protocol Split: MCP + A2A: **OPEN** (MCP practical now; A2A defer)
- Spec-Kit Command Contract Parity: **OPEN / PARTIAL** (command templates exist; frontmatter contracts still missing)
- System Design Skill Coverage: **DONE** (all 14 depth topics in `operational-depth-patterns.md`)
- Temporal Durable Workflow Skill: **OPEN** (dedicated durable workflow guidance still needed)
- Ponytail Code-Bloat Eval: **OPEN** (download + 3-condition eval: nothing vs ponytail vs YAGNI one-liner)
- Self-Harness Research Intake: **OPEN** (evaluate trace-mined, self-proposed harness-rule improvements with regression gates)
- Garry Tan gstack Intake: **OPEN / PARTIAL** (design/iOS/release domain skills extracted; skill testing and remaining stripping/adaptation still pending)
- Anthropic Cybersecurity Skills Intake: **OPEN** (Security-owned install, consolidation into one skill, eval gate before default wiring)
- Codebase Memory MCP Intake: **OPEN** (audit/install MCP code graph server, benchmark against Graphify and current codebase-analysis workflow)
- Codebase-Search Routing + Cross-LLM Analyzer Distribution: **OPEN / DESIGNED** (2026-06-28 swarm debate: router-facade-first, `code-navigation` conditional skill + `codebase-graph` table, split install via `ads-router`, behavioral eval complements backend harness; see detailed item + retained consensus report)
- Matt Pocock Skills Re-Intake: **OPEN** (rerun engineering-skill review, dedupe against existing pipeline and imported skills)
- NVIDIA SkillSpector Intake: **OPEN** (evaluate AI-agent skill scanner as import/install guardrail)
- Init Hook — Audit Convergence Follow-Through: **OPEN / PARTIAL** (TM-INIT-SU-01 round-1 converged, R1-1 fixed; 3 decisions open — round-2 re-audit / commit / report retention. See `init-hook-audit-HANDOFF.md`)
- Web Escalation Gate (getting-unstuck): **OPEN / NEEDS-AUDIT** (first-pass: AGENTS.md rule + Claude PostToolUse hook landed; needs `/audit-work` — see detailed item below)
- Critical Internal Constraints (CIC) Skill Eval: **OPEN** (skill v1.1.0 shipped: debate-designed, 3-round `/audit-work` PASS, Fable amendments landed; needs a behavioral eval before the pipeline relies on it — see detailed item below)

---

## De-Noise and Effectiveness

### Web Escalation Gate / Getting-Unstuck Enforcement **[OPEN / NEEDS-AUDIT]**
**What it is:** A cross-host operating rule + enforcement so that when an agent is operationally blocked (a tool/CLI/service fails the same way ~2×), it STOPS guessing invocations and escalates to information — minimal probe → memory/prior-runs → web + upstream docs/issues — before retrying. Born from an `agy --print` hang where ~6 blind attempts were burned before one web search found the known non-TTY bug (Antigravity #76) and the `script` pty fix.
**Shipped (first pass):**
- Portable rule in `AGENTS.md` → Shared Rules (All Agents): "When operationally stuck, escalate to information — don't thrash." Read by all hosts (Claude/Gemini/Codex via AGENTS.md).
- Web Escalation Gate section + red flags/rationalizations added to `skills/systematic-debugging/SKILL.md` (for dependency-bug-during-coding cases).
- Claude-Code enforcement: PostToolUse(Bash) hook `framework/operations/scripts/unstuck_escalation_hook.py`, registered in `.claude/settings.json`. Keys failure counts on the external **binary** (not full command, since flags vary), nudges on 2nd failure within a 30m window, fails open.
**Why it needs `/audit-work`:**
- Hook output semantics: confirm `hookSpecificOutput.additionalContext` from PostToolUse actually reaches the model in the current Claude Code version (vs needing exit-2/stderr).
- Failure-detection heuristic (`FAIL_RE`) and binary-extraction regex are approximate — risk of false positives (nudging on benign "error" strings) and false negatives. Needs adversarial fixtures.
- **Cross-host enforcement gap:** only Claude Code auto-enforces. Codex (`config.toml` hooks) and agy/Antigravity have no equivalent wired — they rely on the advisory AGENTS.md rule only. Decide whether to add per-host hooks or accept advisory-only for non-Claude primaries.
- Threshold/window (2 failures / 1800s) and the STOPLIST are guesses; validate against real transcripts.
- Decide whether the original per-agent `skills/getting-unstuck/SKILL.md` (rejected in favor of harness placement) should still exist as a loadable reference, or whether the AGENTS.md rule + systematic-debugging gate suffice.
**Acceptance:**
- Audit confirms the hook surfaces to the model, fires on true repeat-failures, and stays quiet on benign output (fixture-backed).
- A clear decision recorded on cross-host enforcement (per-host hooks vs advisory-only).

### AGENTS.md Map Reduction **[DONE / MONITORED]**

### AGENTS.md Map Reduction **[DONE / MONITORED]**
**What it is:** Shrink `AGENTS.md` into a tighter runtime map so the root instruction surface routes agents instead of re-explaining the whole framework.
**Current state:** Detailed startup/invocation/checkpoint content now lives in `framework/operations/pipeline-quickstart.md`, and the full agent roster now lives in `framework/routing/agent-index.md`. `AGENTS.md` remains the runtime map and startup contract and is back under the safer size target.
**What to add next:**
- Keep startup/mode/routing semantics at the root and move deeper operating detail into linked canonical docs.
- Remove repeated explanations that already live in `agents/`, `framework/workflows/`, `skills/`, or `harness-engineering/`.
- Re-run the doc-garden audit after the reduction and treat the root-file line count as a tracked harness metric.

### Context De-Noise Hardening
**What it is:** Reduce instruction noise and improve execution reliability by moving guardrails out of prose and into enforceable structure.
**Current state:** **Framework complete** in `maintainers/skill-md-format/` (standards, gates, tracker, failure matrix, overlays).
**Scope guardrail:** Current rollout covers `skills/vercel-*` and imported `skills/superpowers-*`; expand further only with explicit human approval.
**What to add next:**
- Skill transformation rollout: rewrite skills in phases using the new format (`Execution` / `Guardrails` / `Output` / `Reference`).
- Source preservation: keep existing long-form or imported source skills as canonical references while overlays/new versions are validated.
- Naming convention for rollout: preserve source docs as `ORIGINAL.md`; keep `SKILL.md` as AI/LLM execution-optimized; allow an optional root `README.md` for layout or usage notes; use `references/` for examples, active support docs, and preserved support-source files.
- Comparison workflow: for each rewritten skill, keep side-by-side diff notes and acceptance checks before promotion.

**Note:** Skill-MD-Format framework is complete, but the transformation still needs to be applied across the `skills/` folder in controlled rollout phases.
**Note:** `agents/*/skills.md` should be transformed in a second phase after `skills/` rollout is validated.
**Rollout safety gates:**
- Keep old or imported source files as `ORIGINAL.md` while validating new execution-format `SKILL.md`.
- Require a side-by-side promotion checklist (non-negotiable gates, routing correctness, handoff compatibility) before replacement.
- Roll out by agent cluster with pilot validation before broad replacement.

---

## External OSS Intake

### NVIDIA SkillSpector Intake and Skill-Install Guardrail **[OPEN]**
**Owner:** Security Agent with Skills Librarian and Coordinator routing oversight.
**Source repo:** `https://github.com/nvidia/skillspector`
**Upstream install note:** README lists `uv tool install git+https://github.com/NVIDIA/skillspector.git`, source install via clone + `make install`, Docker usage, and optional MCP server mode.
**Local intake target:** `/Users/la/Desktop/Multi-Agent Swarm Foundation/other-repos-to-learn-from/skillspector`
**What it is:** Security scanner for AI agent skills. It scans Git repos, URLs, zip files, directories, or single skill files for vulnerabilities, malicious patterns, and risky instructions before installing agent skills. Upstream describes static analysis plus optional LLM semantic evaluation, multiple report formats, baseline suppression, and MCP server mode exposing a `scan_skill` tool.
**Why it matters:** AI Dev Shop is adding more external skill intake work. A scanner purpose-built for agent skills could become a preflight gate before installing or adapting third-party skills, especially for prompt injection, data exfiltration, unsafe tool access, supply-chain risk, MCP least-privilege issues, and malicious instruction patterns.
**Integration intent:** Evaluate as a security and governance guardrail for external-skill intake. Do not treat a clean SkillSpector scan as sufficient approval by itself; it should feed Security/Skills Librarian review, not replace source inspection, license checks, or evals.
**What to do:**
- Clone the upstream repo into the local external-repos intake folder.
- Review `README.md`, `pyproject.toml`, Dockerfile, MCP mode, baseline format, model/provider configuration, vulnerability pattern definitions, tests, and any network calls or dependency lookups.
- Run static-only scans (`--no-llm`) against a mix of known local skills, imported gstack skills, and deliberately suspicious fixture skills.
- If LLM mode is tested, use an explicit throwaway fixture and record provider/model/env-var requirements; do not expose secrets in retained reports.
- Evaluate whether SkillSpector should become a required preflight for `skills/` imports, `skills-inbox` reviews, MCP server installs, or external skill packs such as `Anthropic-Cybersecurity-Skills` and `mattpocock/skills`.
- Define how findings map to AI Dev Shop decisions: `block`, `needs human approval`, `needs Security review`, `allow with baseline`, or `false positive`.
**Eval requirement:**
- Build a small scanner-eval fixture set with benign skills, risky-but-legitimate skills, prompt-injection skills, exfiltration attempts, dangerous shell install instructions, MCP over-permission examples, and false-positive traps.
- Compare SkillSpector findings against manual Security review and existing AI Dev Shop skill-format/skills-inbox checks.
- Score precision, recall, severity accuracy, false-positive rate, runtime, dependency/network behavior, report usability, and whether baseline suppression hides important drift.
- Test both standalone CLI output and MCP `scan_skill` output if MCP mode is considered for Coordinator or Skills Librarian workflows.
**Done when:**
- Upstream repo is cloned and audited locally.
- At least one static-only scan pass has run on local skills and suspicious fixtures.
- A retained report recommends reject, manual-only, optional preflight, or required intake gate.
- If adopted, the required integration point is named: `skills-inbox`, Skills Librarian intake, Security review, Coordinator external-skill install preflight, or CI.

### Matt Pocock Skills Re-Intake **[OPEN]**
**Source repo:** `https://github.com/mattpocock/skills`
**Upstream install note:** README lists `npx skills@latest add mattpocock/skills`.
**Local intake target:** `/Users/la/Desktop/Multi-Agent Swarm Foundation/other-repos-to-learn-from/mattpocock-skills`
**What it is:** Small, composable engineering skills from Matt Pocock's agent setup, focused on practical software delivery rather than a full process framework. The repo includes user-invoked flows such as `grill-me`, `grill-with-docs`, `triage`, `to-prd`, `to-issues`, `prototype`, and `improve-codebase-architecture`, plus model-invoked disciplines such as `tdd`, `diagnosing-bugs`, `domain-modeling`, and `codebase-design`.
**Why it matters:** Some of these ideas likely overlap with work already in AI Dev Shop, gstack extraction, Spec/TDD/CodeBase Analyzer flows, VibeCoder, and advanced frontend architecture work. A second pass should find any missed high-signal habits without duplicating existing pipeline machinery.
**Integration intent:** Re-review and selectively adapt. Do not install or vendor the whole pack into default context. Prefer small portable patterns, prompts, rubrics, and eval seeds that improve existing agents.
**What to do:**
- Clone or install the upstream repo into the local external-repos intake folder.
- Inventory every skill, classify it as `adopt`, `adapt`, `already-covered`, `covered-by-gstack`, `needs-eval`, or `skip`.
- Pay special attention to `grill-with-docs`, `domain-modeling`, `codebase-design`, `diagnosing-bugs`, `tdd`, `to-issues`, `to-prd`, `prototype`, and `improve-codebase-architecture`.
- Compare each candidate against existing AI Dev Shop surfaces: Spec, TDD, VibeCoder, CodeBase Analyzer, System Design, Software Architect, `skills/systematic-debugging`, `skills/test-design`, `skills/reverse-spec`, `skills/feature-slice-design`, and gstack-derived skills.
- Identify whether any useful pieces should become updates to existing skills rather than new standalone skills.
- Preserve source notes in an intake report before adapting content; avoid copied personal workflow assumptions, Claude-only setup assumptions, or issue-tracker-specific defaults unless deliberately converted into AI Dev Shop-native rules.
**Eval requirement:**
- Add or extend evals only for candidates that would change default agent behavior.
- For alignment/grilling/domain-model candidates, test whether agents ask better clarifying questions without creating interview fatigue.
- For TDD/debugging/design candidates, run baseline-vs-adapted comparisons on small but realistic implementation, bug diagnosis, and architecture-repair fixtures.
- Score correctness, useful clarification rate, unnecessary-question rate, token cost, implementation quality, and overlap/noise against existing skills.
**Done when:**
- Local clone or install exists for review.
- A retained intake report classifies all upstream skills and identifies overlap with current AI Dev Shop skills.
- Any adoption candidates have a concrete target file, expected behavioral improvement, and eval path.
- Coordinator can decide whether this repo contributes new material, confirms existing coverage, or should be kept as reference-only.

**Status (2026-06-30):**
- Installed `improve-codebase-architecture` into this repo at `skills/improve-codebase-architecture/` (`SKILL.md` + `HTML-REPORT.md`).
- Recommendation: keep it as useful imported reference material for now, but do not register it as a first-class AI Dev Shop skill yet.
- Overlap: substantial overlap with existing `codebase-analysis`, `codebase-graph`, `architecture-decisions`, `architecture-migration`, and `refactor-patterns` skills.
- Unique value: the "deep vs shallow module" framing, "deepening opportunities", deletion-test language, and visual HTML candidate report workflow.
- Adaptation gaps before operational use: upstream assumes `/codebase-design`, `/grilling`, `/domain-modeling`, and `subagent_type=Explore`; map those to AI Dev Shop-native skills/agents or remove the dependency before wiring it into the default skill registry.
- Likely best integration path: extract the visual report/deepening-candidate workflow into CodeBase Analyzer or Refactor Agent guidance rather than adding another standalone architecture-analysis route.

### Codebase Memory MCP Install and Eval **[OPEN]**
**Owner:** CodeBase Analyzer Agent with Coordinator routing oversight; Security Agent reviews installer/config-write risk before enablement.
**Source repo:** `https://github.com/DeusData/codebase-memory-mcp`
**Upstream install note:** README lists one-line install via `curl ... | bash`, manual release archive install, package managers, and an optional graph UI.
**Local intake target:** `/Users/la/Desktop/Multi-Agent Swarm Foundation/other-repos-to-learn-from/codebase-memory-mcp`
**What it is:** Code intelligence MCP server that indexes repositories into a persistent local knowledge graph using tree-sitter and hybrid LSP-style analysis. Upstream claims 158-language support, fast indexing, sub-ms structural queries, 14 MCP tools, static binaries, local-only processing, and optional graph visualization.
**Why it matters:** AI Dev Shop already has CodeBase Analyzer and a Graphify-backed `skills/codebase-graph/SKILL.md`, but codebase discovery still depends on choosing the right graph backend, detecting stale graphs, and falling back to targeted source reads when graph evidence is weak. A local MCP graph backend might improve live agent ergonomics or persistent memory, but it must prove value against Graphify rather than duplicating it.
**Integration intent:** Evaluate as an optional codebase-analysis backend, not as an automatic default install. Do not pipe remote installers directly into the shell during intake. Clone/audit first, then test on fixtures or disposable repos before configuring this live toolkit or other working repos. Treat Graphify as the incumbent baseline for structural graphing.
**What to do:**
- Clone the upstream repo into the local external-repos intake folder.
- Review `README.md`, `install.sh`, `install.ps1`, `server.json`, release/signing/checksum flow, local database path, generated config writes, hooks, instruction-file changes, uninstall behavior, and network/update behavior.
- Run Security review on the installer and binary trust model before enabling it in any agent host.
- Install only in an isolated test environment first, preferably with `--skip-config` or equivalent binary-only mode if available.
- Index at least two fixture repos: one small TypeScript/React repo and one larger mixed-language repo.
- Compare tool output against both Graphify and current direct CodeBase Analyzer discovery on architecture overview, route detection, impact analysis, dead-code identification, cross-file call tracing, stale-index handling, and token cost.
- Decide whether integration should be manual-only, Coordinator-invoked for brownfield analysis, CodeBase Analyzer default when verified, or rejected.
**Eval requirement:**
- Build a codebase-analysis eval or benchmark slice with at least three conditions: baseline `rg`/file-read discovery, Graphify-assisted discovery, and Codebase Memory MCP-assisted discovery.
- Minimum metrics: answer correctness, missed critical files, hallucinated relationships, source-evidence quality, token count, wall-clock time, indexing cost, query ergonomics, stale-index behavior, graph refresh reliability, and security/config side effects.
- Include adversarial fixtures for generated files, vendored code, monorepo packages, dynamic imports, framework routes, IaC manifests, renamed symbols, dead code that is intentionally kept, and stale graph state after edits.
- Add a safety regression checklist for local-only processing, no unexpected config mutation, clean uninstall, and no secret or source exfiltration.
**Done when:**
- Upstream repo is cloned and audited locally.
- Installation path and rollback/uninstall steps are documented.
- At least one isolated install/index run has completed.
- A retained eval report compares direct discovery, Graphify-assisted discovery, and MCP-assisted discovery.
- Coordinator has a clear adoption decision: reject, manual-only, keep Graphify as incumbent, conditional CodeBase Analyzer backend, or default verified backend.
**Status (2026-06-28):**
- Benchmark suite built and **committed** at `harness-engineering/retrieval-evals/benchmark-suite/` (the `fixtures/` dir — an embedded clone-able git repo — and `graphify-out/`/`__pycache__` are gitignored as local inputs; suite code + docs are tracked). **Still need to actually RUN the retrieval-evals** — see the 42-cell TODO below.
- Smoke run done on `fixtures/tier2-medium`: 6 backends (rg-control, codegraph, crg-full, graphify, ua-tree, cm-mcp-full) × 7 queries × 2 states (84 cells). Raw TSV: `/tmp/eval-full-2026-06-27.tsv`. Fixed a cm-mcp callers bug (qualified_name → file resolution) so its callers queries resolve to files.
- **TODO (only when a large token budget is available): run the full 42-cell suite** — current pass is a single-fixture slice; expand to the full query/backend matrix and retain the report. Token-expensive (LLM-executor + UA enrichment across all backends/states), so gate it on having plenty of tokens to spare — do not kick it off opportunistically.

**Where the data lives (which tool is good at what):**
- Synthetic scored harness (this run) — `tier2-medium` fixture (code-heavy TS). Clean-state avg F1: rg 0.76, codegraph 0.61, crg 0.58, cm-mcp 0.46, graphify 0.39, ua-tree 0.38.
- Per-query-class winners (clean F1, `tier2-medium`):
  - `callers` (Q2): rg/codegraph/crg = 1.00; cm-mcp 0.89 (post-fix); graphify 0.33; ua-tree 0.00.
  - `change_impact` (Q14): rg/crg 1.00; graphify 0.89; codegraph 0.80; ua-tree 0.40; cm-mcp 0.00.
  - `dependency_path`: Q5 all = 1.00; **Q3 all = 0.00** (whole row zero — likely a "no path"/grader issue to investigate, not 6 independent misses).
  - `architecture` (Q7/Q8): rg best (0.67/0.80); others mixed; codegraph/graphify drop to 0.00 on Q8.
  - `config` (Q9): rg 0.86, codegraph 0.80, everything else 0.00 (markdown/literal targets invisible to graph tools).
- Informal real-repo arm — `real-repo-comparison-results.md` (run on AI-Dev-Shop itself, markdown/prose-heavy). rg won/tied 6 of 7; graph tools only matched on pure code-symbol queries; graphify uniquely won "no transitive path" (Q3). **Cross-repo takeaway:** graph tools are competitive only on code-symbol queries in code-heavy repos; on prose/markdown/config-heavy repos rg dominates.
- Real-code arm (local-only notes, not committed) — 7 backends on `nexu-io/open-design`, ~2,300-file TS/Electron monorepo. The picture **inverts**: every graph tool crushes rg on the structural callers query (rg misses re-export bridge callers; cm-mcp finds 90 across 3 hops). Lands the "route by query class, fan out in parallel" facade design (distilled into `skills/code-navigation/reference/analyzer-capability-matrix.md`). Clean-state only — staleness untested (that's the 42-cell harness gap).

**Open questions to dig into later:**
1. **crg-full clean = 0.58 here vs 0.87 reported last session; ua-tree 0.38 vs 0.53.** Reconcile: different query subset, grading change, or a real regression? Compare against the prior `/tmp/eval-crg*.tsv` / `/tmp/eval-ua*.tsv` rows.
2. **Q3 (dependency_path) is 0.00 for all 6 backends.** Almost certainly a fixture/grader/oracle problem, not a true universal miss — verify the expected set and `_response_files` extraction for that query.
3. **Dirty-state F1 is not directly comparable** — a stateful index legitimately returns stale results after edits, so dirty F1 vs *fresh* ground truth penalizes correct staleness. Score staleness separately (the preflight dirty-edit gate already does this) instead of folding it into F1.
4. **cm-mcp callers fix (qualified_name → file)** — landed with the retrieval-evals commit (fixture gitignored).

### Codebase-Search Routing + Cross-LLM Analyzer Distribution **[OPEN / DESIGNED]**
**Source:** 2-round Swarm debate (Claude Opus 4.8 + Codex GPT-5.5 xhigh; Gemini 3.1 Pro unavailable), 2026-06-28. Retained report: `ADS-memory/reports/swarm-consensus/runs/20260628T151500Z-consensus-report.md`. ~100% agreement both rounds.
**Throughline (strongest signal):** a deterministic **router facade** (`ads-router` / `search_codebase()`) unifies all three topics. It surfaced unprompted as a Round-1 blind spot from BOTH models and became the load-bearing answer in Round 2. **Design the router contract/schema FIRST** (query classes, JSON I/O, error normalization, freshness metadata, confidence); the routing skill, install facade, and behavioral eval all bind to it.

**Topic 1 — Where routing lives (decided):**
- Put a per-query-class routing table in the shared `skills/codebase-graph/SKILL.md` (rg = terminal fallback; "graph output is a hypothesis until validated; verify critical findings with file reads/rg").
- Realign `codebase-analyzer` Phase 0 from size-only gating to the same query-class table.
- Full per-query-class routing (callers→codegraph/serena, transitive+architecture→cm-mcp, reachability→graphify, LSP-exact→serena, NL→understand-anything, literal/config/markdown/fresh→rg), NOT a binary code/markdown split.
- **Reject the global SessionStart/PreToolUse hook** (context tax + empirically wrong + can't classify NL pre-tool).

**General-behavior skill question (OPEN decision — from user):** Add a thin, CONDITIONAL (trigger-activated) `code-navigation` general skill that every agent references and that delegates deep mechanics to `codebase-graph`. Benefits: single source of truth (no per-agent drift), future agents inherit it automatically. HARD CAVEAT: must stay trigger-activated on search intent — never statically injected into every agent's base context (that recreates the removed context tax). Work = broad trigger phrasing covering how each agent phrases "look at the code"; per-agent pointer shrinks to listing `code-navigation` in each skills.md. Skill = advice (interim); router facade = enforcement (end-state) — the skill should point at the facade once it exists.

**Topic 2 — Behavioral validation eval (designed):**
- COMPLEMENTS (does not replace) the scored retrieval-evals backend harness. Backend harness = answer key (which backend wins each class); behavioral eval = did the agent select/use it.
- Spawn a subagent loaded with the routing mechanism; run a 7-class matrix (direct callers / transitive+reachability / architecture / LSP-exact / NL-semantic / literal-config / stale-index trap) against a PINNED `nexu-io/open-design` commit.
- Score DETERMINISTICALLY from the agent's tool-call trace: backend_selected, target_found (reuse `graders.py` set grader), correct_fallback (with ideal backend disabled), false_confidence, tokens/time. LLM-judge only for secondary explanation quality, never pass/fail.
- Targets from an offline oracle run where the expected backend UNIQUELY wins and the wrong tool has a documented miss. Checked-in target manifest.

**Topic 3 — Install & cross-LLM distribution (designed):**
- **SPLIT install:** shared user-level binaries (`~/.local/share/ads/analyzers/`, env-overridable `ADS_ANALYZER_HOME`, project-local fallback when home unwritable) + per-repo indexes under `ADS-memory/` + an `analyzers.lock.json` manifest (versions, build params, repo fingerprint).
- **One canonical `ads-router` CLI facade** wraps `mcp_probe.py` so Codex/agy/Claude invoke MCP analyzers (cm-mcp, serena) identically as shell calls; native Claude MCP stays optional, NEVER canonical (that is what makes it cross-host).
- **Tiered profiles framed as a latency/storage/privacy BUDGET:** Minimal (rg) / Standard (+codegraph) / Graph (+cm-mcp) / Advanced (+graphify/serena/UA) / Custom. rg-only default for markdown/prose repos. Repo-profile-detected first, audited + capability-checked + reversible; no piped remote installers.

**Open forks (not yet decided):**
1. Router facade vs skill-layer prose — prototype both; if agents don't follow prose reliably (the main risk both models raised), the facade wins.
2. The "complete enough" recall contract (triage vs proof vs refactor-safety vs review) — changes both routing and eval pass/fail thresholds. Must be an input to the router schema.
3. Whether the heavy analyzers (serena LSP, crg torch, UA enrichment) are justified at all, or whether to ship rg+codegraph and make the rest documented manual opt-in.

### Anthropic Cybersecurity Skills Intake and Consolidation **[OPEN]**
**Owner:** Security Agent
**Source repo:** `https://github.com/mukul975/Anthropic-Cybersecurity-Skills`
**Upstream install note:** README lists `npx skills add mukul975/Anthropic-Cybersecurity-Skills` and direct git clone as options.
**Local intake target:** `/Users/la/Desktop/Multi-Agent Swarm Foundation/other-repos-to-learn-from/Anthropic-Cybersecurity-Skills`
**What it is:** Large cybersecurity skill library for AI agents: 817 structured skills across 29 security domains with mappings to MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, MITRE D3FEND, NIST AI RMF, and MITRE F3.
**Why it matters:** The Security agent currently has strong review guidance, secure-input handling, architecture trust-boundary support, and web-compliance screening, but it does not have a broad practitioner playbook for DFIR, threat hunting, malware analysis, cloud security, red team, SOC, vulnerability management, AI security, and related security operations.
**Integration intent:** Learn from and selectively adapt. Do not bulk-import 817 separate skills into this repo. Distill the useful workflows into one consolidated Security-owned skill, then wire that one skill into `agents/security/skills.md` only after eval evidence supports it.
**Candidate target skill:** `skills/cybersecurity-practitioner/SKILL.md`
**Support files if needed:** Keep deep references under `skills/cybersecurity-practitioner/references/`; avoid one upstream domain becoming one local skill unless the eval proves the consolidated skill is too dense to use reliably.
**What to do:**
- Clone or install the upstream repo into the local external-repos intake folder.
- Inventory domains, frontmatter schema, framework mappings, license, generated files, scripts, and any unsafe tool assumptions.
- Identify overlap with existing local skills: `security-review`, `secure-input-handling`, `web-compliance`, `observability-implementation`, `incident-response`, `framework/governance/tool-permission-policy.md`, and data-classification guidance.
- Build a consolidation map that classifies upstream material as `adopt`, `summarize`, `reference-only`, `already-covered`, or `skip`.
- Create one consolidated Security skill focused on agent-executable security fieldcraft: when to apply a workflow, required evidence, safe tool-use boundaries, verification steps, and report shape.
- Keep offensive, dual-use, malware, credential, and exploit material under explicit defensive/authorized-use guardrails. The skill should help the Security agent review and investigate, not silently turn normal code tasks into offensive operations.
- Add `skills/cybersecurity-practitioner/SKILL.md` to the skills registry and `agents/security/skills.md` only after the eval gate passes.
**Eval requirement:**
- Build a Security-agent eval slice before default adoption, preferably under `harness-engineering/agent-evals/security-evals/benchmark-suite/`.
- Run an ablation: Security agent baseline vs consolidated cybersecurity skill loaded.
- Include seeds for at least: incident triage, cloud misconfiguration, web-app vuln review, dependency/CVE response, suspicious logs/threat hunting, AI-security prompt/tool boundary risk, and a negative-control benign case.
- Score detection quality, severity accuracy, evidence grounding, false positives, safe refusal/authorization boundaries, context cost, and whether the skill over-activates on ordinary code-review work.
- Add at least one harm probe for unsafe offensive detail, one prompt-injection/conflicting-instruction probe, and one context-overload probe.
**Done when:**
- Upstream repo is cloned or otherwise installed locally for review.
- A retained intake report exists with license, structure, overlap, safety risks, and consolidation recommendations.
- One consolidated Security skill exists and passes skill-format checks.
- Security eval seeds and scoring rubric exist.
- At least one baseline-vs-skill ablation run is recorded.
- The Coordinator has enough evidence to decide whether to wire the consolidated skill into Security by default, keep it conditional/manual, or reject it.

### Ponytail Download and Code-Bloat Eval **[OPEN]**
**Source repo:** `https://github.com/DietrichGebert/ponytail`
**What it is:** Download Ponytail (CLAUDE.md / system-prompt addon focused on code minimalism) and run a controlled eval comparing agent output quality under three instruction conditions.
**Why it matters:** Quantifies whether terse system-prompt rules actually reduce bloat and improve outcomes, or whether they trade correctness for brevity. Provides evidence for which CLAUDE.md instructions (if any) to adopt into AI Dev Shop's pipeline.
**What to do:**
- Clone Ponytail into `/Users/la/Desktop/Multi-Agent Swarm Foundation/other-repos-to-learn-from/ponytail`
- Design a multi-condition eval comparing three system-prompt treatments across several agents:
  1. **Nothing** — bare agent, no minimalism instructions
  2. **Ponytail** — full Ponytail CLAUDE.md content loaded
  3. **One-liner** — only the line: "Follow YAGNI principles, and one-liner solutions"
- Run each condition across multiple agents (minimum 3 distinct models/agent configs)
- Score each run on the following dimensions:
  - **Correctness** — does the output actually solve the problem correctly?
  - **Bloat** — lines of code, unnecessary abstractions, over-engineering, dead code
  - **Tokens** — total input + output token count for the run
  - **Cost** — dollar cost of the run
  - **Time** — wall-clock duration
  - **Safe** — no security vulnerabilities, no unsafe patterns introduced
- Use identical task fixtures across all conditions for fair comparison
- Record results in a structured format (TSV or JSONL) with condition, agent, task, and all six scores
**Eval design notes:**
- Task fixtures should include a mix of: small utility function, medium feature implementation, refactor of existing code, and bug fix — enough variety to avoid one-trick results
- Each condition × agent × task combination is one run; aim for at least 3 tasks × 3 agents × 3 conditions = 27 minimum runs
- "Correctness" is binary or near-binary (tests pass / requirements met); bloat and safety require rubric-based scoring
- Report aggregate scores per condition and per agent, plus interaction effects (does Ponytail help model X but hurt model Y?)
**Done when:**
- Ponytail is cloned locally
- Eval suite exists with task fixtures, scoring rubric, and run harness
- At least one full comparison run is completed and results are retained
- A summary report exists showing which condition(s) produce the best correctness-to-bloat ratio without sacrificing safety

### Garry Tan `gstack` Intake and Decomposition **[OPEN / PARTIAL]**
**Source repo:** `https://github.com/garrytan/gstack`
**Local clone:** `/Users/la/Desktop/Multi-Agent Swarm Foundation/other-repos-to-learn-from/gstack`
**Current checkout inspected:** `cab774cc` on `main`
**Review intent:** Learn from and selectively adapt. Do not vendor gstack wholesale, install its runtime assumptions, or copy generated skill preambles into AI Dev Shop.
**What it is:** Garry Tan's open-source AI engineering workflow stack: a large skill pack plus browser daemon, QA/review/ship workflows, setup scripts for multiple agent hosts, memory/gbrain sync, and test/eval infrastructure.
**Why it matters:** It overlaps with AI Dev Shop's goal of turning an LLM coding session into a structured software team, but it takes a different product shape: skill-first, Claude Code oriented, strong browser tooling, generated `SKILL.md` files, and many practical workflow commands.
**Completed first extraction:**
- `skills/gstack-design/` plus `/gstack-design` slash command.
- `skills/gstack-ios/` plus `/gstack-ios` slash command.
- `skills/gstack-release/` plus `/gstack-release` slash command.
- `framework/routing/skills-registry.md` entries for all three, marked manual/slash-invoked and not wired into the default pipeline.
- Peer-reviewed through `/cowork` with Claude Opus 4.6 and Gemini 3.1 Pro Preview. Both approved with no blockers or should-fix items; post-implementation audit also approved.

**Do not redo as standalone gstack-domain skills unless new evidence changes the decision:**
- `gstack-design`
- `gstack-ios`
- `gstack-release`

**Follow-up: test the new skills before promotion:**
- Run `/gstack-design consultation`, `/gstack-design shotgun`, `/gstack-design html`, and `/gstack-design review` on small sample tasks. Confirm each mode reads only one reference and produces useful output.
- Run `/gstack-ios qa`, `/gstack-ios fix`, `/gstack-ios design-review`, `/gstack-ios clean`, and `/gstack-ios sync` against either a real iOS project or a fixture. Confirm unavailable device/simulator paths fail gracefully.
- Run `/gstack-release ship`, `/gstack-release setup-deploy`, `/gstack-release landing-report`, `/gstack-release canary`, and `/gstack-release land-and-deploy` on a safe fixture or dry-run repo. Confirm push/merge/deploy actions stop for explicit approval.
- Add lightweight validation checks for these skills: frontmatter, reference existence, one-reference routing language, no banned runtime assumptions outside `upstream-notes.md`, and destructive-action approval language.
- Decide after testing whether any of these graduate from `0.1.0` manual/slash-invoked skills to default pipeline integration.

**Remaining gstack stripping/adaptation targets:**
- Skill taxonomy and workflow shape: compare `/office-hours`, `/autoplan`, `/plan-*`, `/review`, `/qa`, `/ship`, `/cso`, `/learn`, and `/context-*` against AI Dev Shop's Coordinator pipeline and agents.
- Browser daemon architecture: study `ARCHITECTURE.md`, `browse/src/`, `BROWSER.md`, and browser tests for persistent Chromium, refs, logs, screenshots, cookies, auth, and tunnel security.
- Skill generation system: study `SKILL.md.tmpl`, per-skill templates, `scripts/gen-skill-docs.ts`, and resolver modules under `scripts/resolvers/` for token reduction, generated docs, and host overlays.
- Host integration: study `setup`, `hosts/`, `docs/ADDING_A_HOST.md`, and Codex/OpenCode/Cursor/Kiro adapters for cross-host install and command naming patterns.
- Safety and scoping: inspect `/careful`, `/freeze`, `/guard`, prompt-injection defenses, path validation, token registry, dual-listener tunnel design, and security tests.
- Memory and continuity: inspect `/learn`, `/context-save`, `/context-restore`, gbrain docs/scripts, timeline/review/question logs, and project slug/state path conventions.
- QA/review/release loop: release has a first extraction; continue inspecting `/review`, `/qa`, `/qa-only`, `/benchmark`, and tests for ideas that could strengthen AI Dev Shop's post-code stages without duplicating the new `gstack-release` skill.
- Evaluation and regression infrastructure: inspect `package.json` scripts, `test/`, `browse/test/`, skill evals, free/eval test splits, parity/size checks, and slop scanning.

**Stripping rule for future adaptations:**
- Keep portable workflow ideas, mode maps, safety gates, validation checks, and useful operator UX.
- Strip generated preambles, telemetry/config hooks, `~/.gstack` state assumptions, gbrain wiring, hardcoded local binaries, Claude-only AskUserQuestion plumbing, and daemon/runtime dependencies unless deliberately reimplemented as AI Dev Shop-native tooling.

**Questions to answer during review:**
- Which gstack ideas are superior to our current framework and should be adapted?
- Which ideas are redundant because AI Dev Shop already has a stronger pipeline equivalent?
- Which ideas are too Claude-Code-specific or too operationally heavy for this repo?
- Where does gstack use generated artifacts or executable tests to enforce things we currently enforce only by prose?
- What would a small, low-risk adaptation look like before any larger port?
**Suggested review order:**
1. Read or refresh `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CLAUDE.md`, `SKILL.md.tmpl`, and `package.json`.
2. Build a command/skill inventory from all root skill folders and summarize their purpose, inputs, outputs, and state writes.
3. Trace the browser daemon call path from CLI to server to Chromium using `browse/src/cli.ts`, `browse/src/server.ts`, `browse/src/browser-manager.ts`, and `browse/src/snapshot.ts`.
4. Trace generated-skill plumbing through `scripts/gen-skill-docs.ts` and `scripts/resolvers/`.
5. Compare remaining gstack workflows against AI Dev Shop pipeline stages and mark each idea as `adopt`, `adapt`, `already-covered`, or `skip`.
6. Produce a retained report in the project knowledge area with concrete recommendations, file references, risks, completed adaptations, and next implementation candidates.
**Done when:**
- A decomposition report exists with architecture map, skill inventory, safety model notes, and testing/eval summary.
- The report includes a direct comparison table against AI Dev Shop stages.
- The three new domain skills are tested on sample tasks and either promoted, revised, or explicitly kept experimental.
- At least 5 remaining concrete ideas are classified as `adopt/adapt/already-covered/skip`, with rationale.
- Any future adaptation has a small first task and a clear no-vendor/no-drift policy.

### Arbor HTR Mode Integration **[OPEN]**
**Source:** 3-model debate (Claude Opus 4.6, Gemini 3.1 Pro, Codex GPT-5.5 xhigh) on 2026-06-20.
**Paper:** "Toward Generalist Autonomous Research via Hypothesis-Tree Refinement" (Jin et al., Renmin University + Microsoft Research, arXiv:2606.11926, June 2026).
**Local paper copy:** `/Users/la/Downloads/arbor htr.pdf`
**Debate report:** `ADS-memory/reports/swarm-consensus/runs/20260620-arbor-htr-mode-debate.md`
**What it is:** Add an opt-in "Arbor HTR Mode" to the Coordinator — a persistent hypothesis-tree-driven optimization loop that achieves 2.5x verified gains over flat coding agents on autonomous optimization tasks.
**Why it matters:** The existing linear pipeline is excellent for spec→implement→review, but has no mechanism for iterative, multi-hypothesis optimization of an existing artifact (e.g., improving a RAG pipeline, tuning a prompt suite, evolving a harness). Arbor fills that gap with structured exploration, cumulative learning, and held-out validation.
**Debate consensus (3/3):**
- Build as opt-in Coordinator mode, not external tool (reuses existing dispatch, skills, worktrees, governance)
- Enforce no-edit boundary via tool restriction when in Arbor HTR Mode (paper's core invariant)
- Implement <200-word insight propagation (ablation: more important than tree structure alone)
- Add convergence sensor (warn → paradigm_shift → stop)
- Leverage existing `skills/` for domain plugins
- Require pilot before production promotion
- Separate artifact root from pipeline state (zero coupling to linear pipeline)
**Files to create:**
- `skills/arbor-htr/SKILL.md` — mode lifecycle, tree protocol, convergence rules, tool boundary spec
- `skills/arbor-htr/references/hypothesis-tree-schema.md` — node schema (h_n, ι_n, μ_n)
- `skills/arbor-htr/references/coordinator-prompt.md` — adapted from paper Appendix B.1.1
- `skills/arbor-htr/references/executor-prompt.md` — adapted from paper Appendix B.1.2
- `framework/workflows/arbor-htr-mode.md` — mode entry/exit, budget, promotion
- `framework/templates/htr-node-template.md` — 4-field hypothesis (Mechanism, Hypothesis, Observable, Conflicts)
- `framework/templates/htr-run-report-template.md`
- `framework/templates/merge-gate-report-template.md`
- `framework/slash-commands/optimize.md` — `/optimize` entrypoint
- `harness-engineering/sensors/htr-convergence.md` — stagnation detection
- `harness-engineering/validators/validate_arbor_isolation.py`
- `harness-engineering/validators/validate_arbor_eval_split.py`
- `harness-engineering/harness-evals/arbor-htr/` — eval suite
- `AGENTS.md` update — add Arbor HTR Mode to Coordinator mode table
- `framework/routing/agent-index.md` — reserve `Optimizer` and `Optimization Executor` names
**Artifact layout per run:** `<ADS_MEMORY_ROOT>/reports/optimization/<run-slug>/` with `htr-tree.jsonl`, per-node dirs, budget ledger, merge-gate reports.
**Eval targets:** merge-gate integrity, attribution purity, repeat-failure suppression, token efficiency, resume fidelity, zero main-worktree contamination, cross-task transfer, insight quality, convergence behavior.
**Risks to monitor:** insight hallucination poisoning, worktree I/O bottlenecks on local machines, paradigm-shift prompt effectiveness, token budget governance (paper reports 20M–43M tokens/run).
**Done when:**
- Skill, workflow, and mode definition files exist and pass structural validators
- Coordinator can enter/exit Arbor HTR Mode with correct tool restriction
- At least one pilot optimization run completes end-to-end with a retained tree and merge-gate evidence
- Eval suite exists with seeded failure modes (executor contamination, insight drift, false promotion)
- Convergence sensor detects stagnation and escalates correctly

### Self-Harness Research Intake **[OPEN]**
**Source article:** `https://venturebeat.com/orchestration/researchers-introduce-self-harness-a-framework-that-lets-ai-agents-rewrite-their-own-rules-boosting-performance-up-to-60`
**Source paper:** `https://arxiv.org/abs/2606.09498`
**What it is:** Research on letting an LLM-based agent improve its own operating harness through a loop of Weakness Mining, Harness Proposal, and Proposal Validation.
**Why it matters:** AI Dev Shop already treats harness engineering as a first-class workflow, but most rule changes are still human-authored. Self-Harness is directly relevant because it turns execution traces into model-specific, regression-tested harness modifications instead of adding generic instructions.
**Reported result to verify:** The paper reports held-out pass-rate gains on Terminal-Bench-2.0 across MiniMax M2.5, Qwen3.5-35B-A3B, and GLM-5; the largest relative gain is about 60%.
**What to add:**
- Read the paper and extract the concrete protocol: trace inputs, weakness mining, minimal harness edit proposal, validation split, regression test criteria, and accept/reject rules.
- Compare Self-Harness against existing AI Dev Shop work: State-of-the-Art Harness Engineering Gaps, Context De-Noise Hardening, Ponytail evals, Arbor HTR Mode, and loop engineering.
- Design an AI Dev Shop-safe variant where the agent can propose harness edits but cannot auto-land them without validators, eval evidence, and an explicit Coordinator or human gate.
- Add seeded eval cases for overfitted harness edits, unsafe self-permission expansion, prompt bloat, instruction drift, and cross-model regression.
- Test whether proposed harness improvements transfer across at least two model families or whether they should stay model-specific.
**Done when:**
- A retained research report classifies Self-Harness ideas as `adopt`, `adapt`, `already-covered`, or `skip`.
- The report maps any adoption candidates to existing pipeline, harness, skill-format, eval, and artifact surfaces.
- A candidate workflow exists for trace capture, weakness mining, proposal storage, validation evidence, approval, and rollback.
- At least one pilot run produces an accepted or rejected harness proposal with retained evidence.

### Loop Engineering **[OPEN]**
**Source video:** `https://www.youtube.com/watch?v=RVEaDvh6f5A`
**Source repo:** `https://github.com/owainlewis/youtube-tutorials/tree/main/tutorials/loop-engineering`
**Reference site (starting point, not canonical):** `https://signals.forwardfuture.ai/loop-library/`
**What it is:** Loop engineering patterns for AI agent workflows — structured approaches to iterative agent loops, feedback cycles, and convergence strategies.
**Why it matters:** The pipeline already uses retry budgets and convergence checks, but dedicated loop engineering patterns could strengthen how agents iterate, self-correct, and know when to stop.
**What to add:**
- Watch the video and extract key loop engineering concepts, patterns, and anti-patterns.
- Review the tutorial repo for concrete implementations and compare against current pipeline loop behavior.
- Review the Forward Future Loop Library as one useful reference source only; do not treat it as the main taxonomy because stronger loop libraries likely exist and loop patterns will keep improving.
- Survey broader loop-pattern sources before adopting names, categories, or implementation guidance into AI Dev Shop.
- Identify which patterns are already covered by existing harness work (retry budgets, narrowing-first gates, loop-until-dry) and which are genuinely new.
- Determine adoption candidates: patterns that could improve agent iteration quality, convergence speed, or resource efficiency.
**Done when:**
- Key patterns are extracted and classified as `adopt/adapt/already-covered/skip`.
- Any adopted patterns have a clear integration point in the existing pipeline or harness docs.

### Code Report Video Intake Queue
**Source video:** `https://www.youtube.com/watch?v=Xn-gtHDsaPY`
**What it is:** Curated list of outside open-source agent/tooling repos mentioned in a March 12, 2026 Code Report video that are worth evaluating for future adoption.
**Why it matters:** These projects may improve agent staffing, prompt evaluation, context management, UI quality, forecasting, and model control. They should be reviewed systematically instead of getting installed ad hoc.
**Current state:** `agency-agents` has already been downloaded for review. Several other repo names came from auto-transcript text and need exact repo confirmation before installation.
**What to add next:**
- Create a lightweight intake checklist for external repos: exact repo URL, license, maintenance status, install method, security risk, overlap with current toolkit, and likely integration point.
- Separate `adopt soon`, `learn from only`, and `skip` outcomes after review so the repo folder does not become a dumping ground.
- Capture findings in a dedicated external-repos evaluation doc once the review pass starts.

**Review queue:**
- `agency-agents`
  - Why it is useful: broad agent-role starter kit that can accelerate experimentation with specialist personas and startup-like multi-agent staffing patterns.
  - Likely value here: role ideas, agent templates, and prompt structure comparisons against this toolkit's current agent set.
- `archon` — `https://github.com/coleam00/archon`
  - Why it is useful: open-source harness/workflow engine for AI coding with YAML-defined workflows, validation gates, isolated git worktrees, and mixed deterministic + AI execution nodes.
  - Likely value here: compare its workflow engine, worktree isolation model, approval gates, artifact flow, and repo-local workflow definitions against AI Dev Shop's coordinator/pipeline design.
  - Review intent: `learn from only` for now. Revisit later to extract concrete ideas worth adopting or explicitly rejecting after a focused comparison pass.
- `squad`
  - Why it is useful: multi-agent team runtime with persistent in-repo agent state, routing, orchestration logs, skills, templates, and sample projects.
  - Likely value here: go through the repo's projects/samples/templates and extract anything useful for coordinator routing, persistent agent memory, context hygiene, observability, and team bootstrap patterns.
- `promptfoo` (transcript said "Prompt Fu")
  - Why it is useful: prompt testing and evaluation framework for model/prompt comparisons, regressions, and adversarial red-team checks.
  - Likely value here: could strengthen prompt, rubric, and red-team validation workflows for agent prompts and user-facing AI features.
- `Mirofish` / `Mirrorish` / `Micro Fish` (exact repo name to confirm from transcript)
  - Why it is useful: described as a multi-agent prediction engine that ingests trend/news data and simulates agent discussion around it.
  - Likely value here: idea source for trend analysis, market-sensing agents, or multi-agent forecasting patterns.
- `Impeccable` (exact repo name to confirm from transcript)
  - Why it is useful: frontend-design-oriented command/skill set focused on simplifying and improving AI-generated UI.
  - Likely value here: possible source material for VibeCoder, Web Design, or frontend quality skills, especially around simplification and visual polish.
- `Open Viking` (exact repo name to confirm from transcript)
  - Why it is useful: described as an AI-agent memory/context database organized around filesystem-based resources, skills, and tiered loading.
  - Likely value here: directly relevant to context hygiene, tiered loading, token reduction, and long-term memory organization for agents.
- `Heretic` (exact repo name and safety posture to confirm before any install)
  - Why it is useful: described as a tool for removing model guardrails via "obliteration".
  - Likely value here: mostly research value around model-control techniques; high safety/governance review required before touching it.
- `Nano Chat` / `nanochat` (exact repo name to confirm from transcript)
  - Why it is useful: end-to-end small-LLM training pipeline including tokenization, pretraining, fine-tuning, evaluation, and UI.
  - Likely value here: useful for learning the full LLM stack and evaluating whether a small controllable local model could support narrow internal tasks.

**Do not prioritize from this video:**
- `Recall AI`
  - Sponsor mention, not part of the open-source install queue.

---

## Pipeline Gaps

### Graphify `--agent-cache` RFC **[OPEN]**
**What it is:** Add `--agent-cache` flag to graphify that produces a greppable JSONL of chunk-level summaries with namespace inheritance and line pointers — precomputed cache so agents skip the grep/read/assess/repeat loop. Debate consensus (3/3): no vector DB, no BM25 for MVP, no community rollups — just chunked summaries + grep. See `ADS-memory/.local-artifacts/swarm-consensus/runs/20260609T-agent-cache-debate-report.md` for full spec. PR branch exists on fork: `leonaburime-ucla/graphify` (`docs/node-summaries-rfc`); upstream PR #1166 covers file-level summaries; this extends to chunk-level.

### Critical Internal Constraints (CIC) Skill Eval **[OPEN]**
**Owner:** Coordinator with Software Architect/TDD/Programmer personas as eval subjects.
**Mandatory pre-reads (per CLAUDE.md, before any fixture/seed/scoring work):** `harness-engineering/agent-evals/bug-taxonomy.md`, `harness-engineering/agent-evals/eval-design-playbook.md`, `harness-engineering/agent-evals/README.md`.
**What it is:** Behavioral eval suite for the new `skills/critical-internal-constraints/` skill (v1.1.0) and its wiring — does the Software Architect designate the right units (and only those), does the combined Design Readiness gate behave, do TDD/Programmer honor Binding constraints and the `[CIC_*]` protocol, and does the anti-scope-creep design actually hold under realistic pressure.
**Why it matters:** The skill was debate-designed (Codex+Gemini consensus 2026-07-03), passed a 3-round `/audit-work` (TM-CIC-001, converged 9.6/10.0), and absorbed a same-family Fable review's six amendments (incl. cross-feature persistence) — but every check so far was static/textual. No agent has ever produced a real `critical-internal-constraints.md`, and the known residual risk is exactly behavioral: over-designation (classic-LLD creep), lazy NOT TRIGGERED lines, TDD writing mock-order tests anyway, `[CIC_PROPOSED]` becoming an "I'm stuck" button. These were the debate's explicit watch items; the eval is how they get measured instead of assumed.
**Suggested location:** `harness-engineering/agent-evals/cic-evals/benchmark-suite/` (follow existing agent-evals conventions).
**Seed classes (positive + negative controls + traps):**
- One positive seed per trigger (7): a spec/ADR fixture where exactly one unit genuinely warrants designation under that trigger, with an oracle designation (unit, plausible wrong implementation, broken property, required constraint).
- Negative controls: plain CRUD/glue features where the correct output is a NOT TRIGGERED record — score evidence quality (candidate units + surfaces + why), not just presence of the line.
- Over-designation traps: "complex-looking" units (nested config mapping, long switch, big DTO transforms) with no breakable property — any designation = scope-creep failure.
- Default-marker traps: a security-sequencing unit where `ESCALATE_SECURITY` must be applied by default (or a reason recorded); a money-movement recovery unit for `ESCALATE_IRREVERSIBLE`.
- Under-designation escalation: artifact produced but a triggering unit omitted — does TDD/Programmer raise a well-formed `[CIC_REQUESTED]` (exact 6-field format, deterministic regex check)?
- TDD verification-surface compliance: a designated unit with a state machine — does TDD test observable outcomes/persisted state, or assert mock call order / private structure (fail)?
- Programmer deviation protocol: a Binding constraint that implementation evidence genuinely invalidates — recorded `[CIC_DEVIATION]` vs silent deviation; pause-for-`[CIC_DEVIATION_APPROVED]` on escalation-marked constraints.
- Cross-feature persistence: a prior feature's CIC artifact designates a unit the current feature touches — does the architect's reverse lookup find and re-affirm/supersede/promote it?
- Gate seeds: STALE detection (renamed outline `C-xxx` ID), an outline file with `Status: SKIPPED` present (must not pass as PRODUCED), NOT TRIGGERED mirrored into tasks.md.
**Scoring:**
- Designation precision/recall vs oracle — over-designation rate is the primary metric (the skill's central promise is restraint).
- Four-part-test completeness and trace validity (deterministic field checks).
- Protocol-format compliance for all `[CIC_*]` tokens (regex; no LLM judge).
- Gate correctness per seed (pass / route-back decisions vs expected).
- TDD structural-test violations (count of private-structure assertions).
- Token/ceremony cost per condition (skill loaded vs baseline) so the context tax is measured, not assumed.
- LLM-judge only for secondary quality (constraint usefulness), never pass/fail.
**Ablation:** run at least the architect-designation seeds baseline-vs-skill-loaded to prove the skill changes behavior rather than just adding tokens.
**Done when:**
- Suite exists with fixtures, oracle manifests, deterministic graders, and a run harness following agent-evals conventions.
- At least one full run is retained with per-seed-class scores.
- Each debate watch item (over-designation, NOT TRIGGERED laziness, mock-order tests, `[CIC_PROPOSED]` abuse) maps to a measured metric.
- Coordinator has evidence to decide: keep CIC wired as-is, tighten triggers/wording, or downgrade to manual-only.

### Temporal Durable Workflow Skill **[OPEN]**
**What it is:** Add a dedicated skill for Temporal-style durable workflow systems and related durable orchestration patterns.
**Why it matters:** Existing skills cover queues, async jobs, outbox, saga, retries, idempotency, and orchestration, but they do not provide focused guidance for when a workflow engine is the right abstraction, how to model durable workflow state, how to version workflows, or how to test/resume long-running executions.
**What to add:**
- Create a durable workflow skill covering Temporal-style workflows, cloud state machines, durable functions, activity idempotency, workflow IDs, timers, signals, cancellation, compensation, replay/versioning, observability, and worker failure recovery.
- Include decision guidance for queue vs job worker vs event bus vs durable workflow engine.
- Add test guidance for retries, timeout paths, crash/resume behavior, compensation, duplicate activity execution, and in-flight workflow version changes.
- Add routing guidance for which agents should load it: likely Software Architect, Programmer, TDD, QA/E2E, TestRunner, DevOps, and Code Review when durable workflow requirements are present.
**Done when:**
- A new skill exists under `skills/` with concise execution guidance and references.
- `framework/routing/skills-registry.md` maps the skill to the right agents conditionally.
- Relevant agent `skills.md` files mention the skill only as conditional context.
- A small fixture/eval or checklist validates that agents distinguish simple async jobs from durable workflows.

### Harness Audit Follow-Ons **[DONE]**
**Completed 2026-05-18/19.** All 10 items resolved. Key deliverables:
- `framework/contracts/` — computational controls, runtime validation, architecture fitness, enforcement, bootstrap
- `harness-engineering/sensors/` — dead-code, dependency-drift, coverage-quality
- `harness-engineering/quality/code-documentation-standards.md`
- `harness-engineering/quality/model-upgrade-program.md`
- `framework/workflows/git-strategy.md`
- `framework/templates/evaluator-contract-template.md` (strengthened with Evidence Surfaces + Fail Conditions)
- `harness-engineering/validators/validate_contracts.py`
- `harness-engineering/harness-evals/` — 3 suites, 20 seeds, structured JSON grading
- Items 9-10 closed (existing surfaces sufficient, terminology already correct)

### Claude Audit Follow-Ups: `audit-work` + `specs_as_built` Patch Set **[OPEN]**
**Source:** Claude external audit on 2026-05-25, raw result at `ADS-memory/.local-artifacts/external-audit/offloads/20260525T040204Z-needed-audit/claude/claude-audit.result.md`.
**Audit outcome:** No blockers or high-risk fixes. Claude marked both findings as medium and non-blocking.
**What to add:**
- `harness-engineering/validators/validate_contracts.py`: reject angle-bracket template placeholders in live host declarations. `field_has_content()` should treat values like `<HOST_PROJECT_ROOT>` and `<ADS_MEMORY_ROOT>` as unfilled placeholders, matching the placeholder behavior in `validate_specs_as_built_freshness.py`.
- `harness-engineering/validators/validate_specs_as_built_freshness.py`: validate `status` against the allowed enum: `generated`, `hybrid`, `stale`, `rewriting`. Emit a clear warning such as `INVALID_STATUS_VALUE` when metadata uses an unknown status.
**Done when:**
- Targeted validator tests or fixtures prove placeholder host declarations are rejected.
- Targeted validator tests or fixtures prove invalid specs-as-built status values are reported clearly.
- `python3 harness-engineering/validators/validate_contracts.py`, `python3 harness-engineering/validators/validate_specs_as_built_freshness.py`, and `bash harness-engineering/validators/run-all.sh` pass.

### State-of-the-Art Harness Engineering Gaps From 2026 Video Review **[OPEN]**
**Source:** User-provided transcript of "Rethinking AI Agents: The Rise of Harness Engineering"; gap list consolidated from Coordinator, Claude, and Gemini review passes.
**What it is:** Advanced harness concepts that go beyond the current repo's strong NLH-style pipeline, contracts, state files, validators, evaluator loops, and load-bearing audit doctrine.
**Why it matters:** The repo already matches much of the video's baseline advice. These items target the next maturity layer: trace-driven optimization, measurable pruning, cross-model transfer, programmatic safety, and cost-aware orchestration.
**Current state:** **[PARTIAL]** Many foundations exist in `harness-engineering/`, `framework/workflows/`, `framework/contracts/`, and `skills/swarm-consensus/`, but most of these gaps are policy/manual today rather than automated, benchmark-backed harness behavior.
**Eval requirement:** Every item below needs an explicit evaluation path before it is treated as implemented. Add seeded evals, ablation tasks, adversarial fixtures, or validator regression cases that can show quality, safety, cost, latency, or transferability deltas before and after the harness change.
**What to add:**
- **Meta-Harness trace-driven optimizer:** Add a workflow where failed raw traces are mined by a proposer that suggests harness edits, produces a patch branch or retained proposal, runs benchmark/eval packs, and records accept/reject evidence. Keep human or Coordinator approval before landing harness changes.
- **Raw trace preservation for optimization:** Strengthen `harness-engineering/runtime/context-offloading.md` and trace docs so optimization runs preserve raw execution traces, tool outputs, stderr, prompts, and failure artifacts. Summaries are allowed for chat, but must not replace raw traces as optimizer input when raw evidence exists.
- **Acceptance-gated narrowing-first attempt loop:** Add a runtime policy that starts with the narrowest plausible context/tool surface, accepts only evidence-backed progress, and broadens scope/tools/delegation only after explicit failure signals. This should upgrade flat retry budgets into "stay narrow until the evidence justifies widening."
- **Cross-model harness transfer testing:** Extend `harness-engineering/quality/model-upgrade-program.md` so a harness improvement proven on one model is tested against other available models, including cheaper models, and reported as a transferable harness asset when it improves multiple model families.
- **NLH representation-quality ablations:** Add guidance and evals for testing whether rewriting the same harness logic in clearer natural-language harness form improves results. Treat representation shape, wording, layer boundaries, and file structure as measurable performance drivers.
- **Verifier and multi-candidate harm warnings:** Update load-bearing audit guidance to explicitly test whether added verifiers, broad evaluator gates, or multi-candidate search reduce quality, latency, or cost. Do not assume more verification is always better.
- **Programmatic safety DSL / action-veto layer:** Move high-risk markdown-only rules toward machine-enforced policy where feasible: agent permission manifests, command/path validators, destructive-command deny rules, write-scope leases, secret-read blocking, and tests that prove unsafe actions are vetoed before execution.
- **Shared harness artifact and skill vulnerability scanning:** Extend `skills-inbox` and registry validation with explicit checks for prompt-injection text, dangerous tool instructions, hidden network/write behavior, ambiguous authority claims, and vulnerable community-contributed skills before adoption.
- **Cost/token-aware harness selection:** Add run-level budget capture and selection guidance so the Coordinator can choose between simple, evaluator, multi-agent, or consensus paths based on expected value, quality risk, latency, token cost, and user budget.
- **NLH three-layer separation:** Formalize the current implicit split into swappable layers: backend/tools, runtime charter/policy, and task-specific agent logic. Use this to enable cleaner ablations: swap one layer while holding the others fixed.
- **Trace mining and observability dashboard:** Build on `framework/workflows/trace-schema.md` with an aggregator that reports failure rate by stage, retry clusters, token/cost trends, slow stages, stale dispatches, and recurring harness-rule violations.
- **Harness-model co-evolution watch item:** Track as a research frontier rather than immediate implementation: whether harness strategies should inform model fine-tuning or model selection, and whether model behavior changes should feed back into harness pruning.
**Evaluation work to add alongside the gaps:**
- Create a dedicated harness-gap eval suite under `harness-engineering/harness-evals/` or `harness-engineering/agent-evals/` for these state-of-the-art gaps.
- For each new harness rule, define at least one positive seed that should pass, one negative/adversarial seed that should be blocked or caught, and one regression seed from a prior real failure when available.
- For optimization and pruning work, require before/after ablation runs that record quality first, then token count, wall-clock latency, tool-call count, and failure recovery.
- For cross-model transfer work, run the same seed pack across at least two model families or tiers and report whether the harness change transfers, regresses, or is model-specific.
- For programmatic safety work, include executable validator tests that prove unsafe commands, out-of-scope writes, secret reads, and prompt-injection-shaped artifacts are rejected.
- For trace-driven work, keep raw trace fixtures as eval inputs so the evaluator can compare raw-trace optimization against summary-only optimization.
**Likely files to inspect/update first:**
- `harness-engineering/runtime/context-offloading.md`
- `harness-engineering/runtime/tripwires.md`
- `framework/workflows/job-lifecycle.md`
- `framework/workflows/trace-schema.md`
- `harness-engineering/quality/load-bearing-harness-audit.md`
- `harness-engineering/quality/model-upgrade-program.md`
- `harness-engineering/quality/evaluation-loops.md`
- `harness-engineering/harness-evals/`
- `harness-engineering/agent-evals/`
- `harness-engineering/quality/scripts/score_eval_suite.py`
- `harness-engineering/validators/validate_eval_suite.py`
- `harness-engineering/skills-inbox/skills-librarian-policy.md`
- `framework/governance/tool-permission-policy.md`
- `harness-engineering/validators/`
**Done when:**
- At least one retained meta-harness proposal is generated from raw failure traces and accepted or rejected with benchmark evidence.
- Raw trace retention is a hard rule for optimization runs.
- Retry behavior has an explicit narrowing-first gate before broadening context/tools/delegation.
- Harness changes can be compared across at least two model families or model tiers.
- Load-bearing audits explicitly evaluate verifier/search overhead as potentially harmful.
- High-risk agent actions have at least one machine-enforced veto path instead of markdown-only instruction.
- External skill ingestion includes vulnerability/prompt-injection scanning before adoption.
- Run summaries include cost/token/latency data sufficient to compare harness variants.
- Each added gap has at least one retained eval, ablation report, or validator regression test proving the harness change works and does not create an obvious regression.

### Specialized Harness Follow-Ons From Video **[OPEN]**
**Source video:** `https://www.youtube.com/watch?v=I2K81s0OQto`
**What it is:** Follow-up ideas from a harness-engineering video focused on specialized multi-stage business workflows, deterministic rails, subagents, observability, and checkpointed execution.
**Why it matters:** Most repo-level harness work is now in place, but these items push the framework further toward specialized downstream harnesses for compliance, legal, financial, and other long-running business processes.
**What to add:**
- ~~Stage-output schema enforcement:~~ **DONE** — `harness-engineering/quality/stage-output-schema.md` (machine-validated output contracts with required fields, validation modes, failure behavior, schema versioning, trace integration).
- ~~Model-tier routing policy:~~ **DONE** — `framework/routing/model-routing.md` (tier recommendations per agent role with cost/quality guidance).
- ~~Phase-checkpoint template for downstream harnesses:~~ **DONE** — `harness-engineering/quality/phase-checkpoint-template.md` (resumable checkpoint artifacts with staleness, invalidation, sensitive-state handling).
- Specialized non-code validation-loop templates: add downstream templates for things like clause-vs-playbook checks, fact-check loops, and rule-based business validation beyond software testing.
- Fixed-plan vs dynamic-plan design guidance: document when a workflow should stay on deterministic fixed rails versus when dynamic replanning is acceptable.
- Tool-approval patterns for risky actions: add stronger downstream guidance for actions that should always require explicit human approval before write/push/send/publish behavior.
- ~~Observability and trace design for specialized harnesses:~~ **DONE** — `framework/workflows/trace-schema.md` + `skills/observability-implementation/SKILL.md`.

### React Component Testing Policy **[DONE]**
**Completed.** Policy at `harness-engineering/quality/react-component-testing-policy.md` is enforced through TDD agent routing (`agents/tdd/skills.md` loads it directly).

### Debug Playbook
**What it is:** Agents need a structured debug loop (reproduce, isolate, instrument, hypothesize, fix) to prevent thrashing.
**Current state:** Added to `harness-engineering/quality/debug-playbook.md`.
**What to add:** Enforce trace requirements and escalation rules across Programmer and QA roles.

### Observer Agent Operational Cadence
**What it is:** The Observer role and output format are well-defined but its trigger is not. Currently it "runs alongside" the pipeline with no specified cadence — making it easy to never dispatch in practice.
**Current state:** **[PARTIAL]** Observer behavior is documented in multiple places (`framework/workflows/multi-agent-pipeline.md`, scorecard docs), but Coordinator dispatch trigger rules are still not explicit.
**What to add:**
- Define trigger conditions in `agents/coordinator/skills.md`: dispatch Observer after every 3rd feature completion, after any convergence escalation, and on explicit Coordinator request
- Define what "weekly pattern report" means: manual trigger via slash command or Coordinator initiates after N features
- Add Observer dispatch to the Coordinator's post-Done workflow

### Git Branching and PR Strategy
**What it is:** The pipeline produces merge-ready code but says nothing about git workflow — feature branches, PR naming, review process, or merge strategy. The human is left to figure this out.
**Current state:** Still valid gap (no canonical branching/PR policy in coordinator workflow docs).
**What to add:**
- Recommended branch naming convention per feature: `feature/<SPEC-ID>-<feature-name>`
- PR description template that references spec hash, ADR path, and security sign-off status
- Coordinator guidance: when to create a branch (at TDD dispatch), when to signal PR-ready (at Done State)
- Note on merge strategy trade-offs (squash vs merge commit vs rebase) relative to spec traceability

### Testability Anti-Pattern Reporting
**What it is:** Ensure code anti-patterns that make testing hard are consistently surfaced to humans during implementation and review.
**Current state:** Catalog added in quality docs; enforcement across rewrite/rollout flow still pending.
**What to add:**
- Use `harness-engineering/quality/testability-antipatterns.md` as the canonical catalog.
- Require anti-pattern findings to be reported in handoff summaries with location, impact, and remediation route.
- Treat repeated unresolved anti-patterns as escalation candidates instead of silently continuing.

### Programmer Ambient Fast-Feedback Testing **[DONE]**
**Completed.** Policy at `harness-engineering/quality/programmer-fast-feedback.md`. Defines watcher scope, signal-only payloads (40-line max, 120-char errors), debounce (10s), stable-failure alerts (2 consecutive), alert budget (3/15min), suppression state machine, stale-watcher resets, and clear TestRunner boundary.
**Remaining:** Wire into `agents/programmer/skills.md` as conditional awareness and update coordination docs.

---

## Consensus Orchestration

### Multi-LLM Consensus Modes and Guardrails **[PARTIAL]**
**What it is:** `/consensus` and `skills/swarm-consensus/SKILL.md` exist, but they need stronger orchestration rules for architecture/data-modeling debates and reproducible runs with explicit mode control.
**Current state:** Core orchestration flow is implemented; this section now tracks only remaining gaps.
**Known issue:** Consensus runs can still misreport exact peer model/version identifiers in some environments; preflight/version capture needs stricter normalization and verification.
**What to add:**
- Normalize and verify peer model/version reporting across CLI outputs so preflight and reports always show accurate model IDs and versions.
- i think we should have in /cowork /debate and /audit have heartbeats to make sure something is fine and maybe extend the
  times to let the other LLMs finish.

---

## Interoperability

### Protocol Split: MCP + A2A
**What it is:** Two distinct integration patterns for extending the pipeline.
- **MCP (Model Context Protocol):** Tool and resource provisioning standard. Already the de-facto standard for connecting agents to external tools/data.
- **A2A (Agent-to-Agent, Google):** Protocol for agent-to-agent collaboration across systems/orgs. Still early — limited adoption as of early 2026.
**Why it matters:** MCP hardening is practical now. A2A is worth tracking but not worth building to yet.
**What to add:**
- `interop/` docs folder
- MCP integration guide — how to add MCP tools to each agent role, what permissions each role needs, security surface
- External Agent Gateway role definition — a lightweight broker agent that validates incoming A2A requests before they touch the pipeline
- A2A watch notes — revisit when adoption signal is clearer
**Defer:** Full A2A implementation until protocol stabilizes

---

## Polish

### Spec-Kit Command Contract Parity **[PARTIAL]**
**What it is:** Command files (`.claude/commands/`) currently lack machine-readable frontmatter. Spec-kit's command format includes `handoffs:` and `scripts:` fields that enable automated contract validation — e.g., checking that `/plan` references an approved spec before executing.
**Current state:** Command files exist in `framework/slash-commands/` (including `spec`, `clarify`, `plan`, `tasks`, `implement`, `review`, `consensus`, `agent`). Frontmatter contracts are still not present.
**What to add:**
- Frontmatter schema for command files — `description`, `requires`, `handoffs`, `produces`, and optional `mode`
- Update all command files in `framework/slash-commands/` to include frontmatter
- Coordinator skills update — teach it to validate command preconditions against frontmatter `requires` fields before dispatch
**References:** github/spec-kit command format (`github-spec-kit/framework/templates/commands/specify.md`)

---

### System Design Skill Coverage Hardening **[DONE]**
**Completed.** All 14 depth topics added in `skills/system-design/references/operational-depth-patterns.md`: hot keys/rows, precomputation, batching, async depth (backpressure/DLQ/ordering/exactly-once), idempotency, deduplication, transaction tradeoffs (saga/outbox/compensation), concurrency failure modes (7 patterns), health checks (liveness/readiness/cascading), graceful degradation (circuit breaker/load shedding/bulkhead), authn/authz depth (token lifecycle/RBAC vs ABAC/zero-trust), secrets management (rotation/envelope encryption/injection), rate limiting depth (4 algorithms/distributed/per-tenant), abuse detection (anomaly signals/progressive enforcement/reputation). SKILL.md load strategy updated to reference the new file.

---

## Agent Eval Depth

### Deep-Dive: Production-Level Complexity for Agent Evals **[PARTIAL]**
**What it is:** The current agent evals (Architect, Code Review) are shallow — they test process compliance and textbook bugs, not the production-level failures that LLMs actually struggle with. The Programmer evals are the exception and already have more depth.
**Why it matters:** Shallow evals give false confidence and don't surface agent skill gaps. The evals should tell you what skills to build next by revealing what classes of failure the agents cannot reason about.
**What was done:**
- Added a **Domain Complexity Taxonomy** to `eval-coverage-model.md` with five tiers: `textbook`, `production`, `staff`, `principal`, `distinguished`
- **80% of seeds must be staff/principal/distinguished** (85% for Architect/CR)
- Defined 14 complexity categories (concurrency composition, distributed state divergence, scale threshold collapse, retry amplification, data loss windows, security escalation chains, invariant erosion, observability blind spots, configuration interaction, temporal coupling, migration hazards, resource exhaustion leaks, consensus violations, type system escapes)
- Added a full **Engineering Concept Taxonomy** (~50 concept codes across 6 domains: Systems & Infrastructure, Data & Storage, Concurrency & Performance, Security & Trust, Correctness & Logic, Architecture & Design, Testing & Quality)
- Added **concept probing rules**: Architect must touch 15+ concepts, Code Review 20+, Programmer 25+
- Added **seed design criteria** to `function-quality-seeded-evals.md` with concrete examples at each tier (staff through distinguished)
- Updated `seed-catalog.tsv` schema with `domain_complexity`, `complexity_category`, and `engineering_concepts` columns
- Added per-concept and per-category catch rates as primary diagnostics
- Added **skill gap diagnostic reporting**: concepts with < 50% catch rate are confirmed gaps, reported with full context for human decision-making (no automatic skill creation)
- **Eval-driven development** available as optional human-initiated workflow: write seeds → verify failure → build skill → re-eval
- Minimum seed count for Architect/CR/Security: **72+ seeds**
**What still needs to happen:**
- ~~Regenerate Architect eval seeds with emergent-tier defects~~ **DONE 2026-07-03** — the "59 textbook seeds" claim was stale; the real suite was 33 judgment-focused seeds whose catalog was out of sync (10 rows, pre-depth schema). Catalog backfilled with all 33 seeds at staff+ depth (92.9% staff+), coverage-matrix rebuilt on the standard schema, suite-level seed-ledger.md added with structured staff+ entries, 5 NCs + 2 regression controls designated. Validator passes (pilot label).
- ~~Regenerate Code Review eval seeds with production and emergent defects~~ **DONE** (earlier session) — 91 seeds across 14 evals with depth columns at staff/principal tiers.
- ~~Add `domain_complexity` and `complexity_category` columns to existing seed-catalog TSVs~~ **DONE** for CR + Architect suites.
- ~~Update the scorer (`score_eval_suite.py`) to compute per-complexity-category catch rates~~ **DONE** (earlier session).
- ~~Update the validator (`validate_eval_suite.py`) to enforce the depth floors~~ **DONE** (earlier session; 2026-07-03 fix: `is_architect_or_code_review()` in both scorer and validator now recognizes `software-architect`, so the stricter 85% Architect/CR floors actually apply to the architect suite).
- Run the new suites and use the category-level miss data to prioritize new skills — **ARCHITECT DONE 2026-07-03; CR still open.** Ran a 3-arm Opus 4.8 skills ablation on arch-eval-1 (bare / brief-only / brief+skills): self 78.8 / 90.9 / 95.5%, blind Opus judge 80.3 / 92.4 / 93.9% (94.9% grader agreement). Key result: the structured brief is the dominant lever (+12.1 pts, identical for both graders); the heavy skill files add only +1.5–4.5 pts beyond the brief. Raw Opus 4.8 already ~79%. Skill-gap candidates (missed even with full skills): actor-identity-through-migration-boundaries (SEED-31), current-state-baseline (SEED-34), new-schema perf-confidence calibration (SEED-17). First retained `run-manifest.tsv`/`run-results.tsv`; report at `harness-engineering/agent-evals/architect-evals/ABLATION-2026-07-03-opus48-3arm.md`. CR suite still has 0 retained runs.
- Expand architect suite per its TODO roadmap: arch-eval-2 flash-sale ticketing through arch-eval-6 (~40 seeds each). arch-eval-1 needs ~3 more seeds to cross the 36-seed benchmark-label floor.
**Likely files to inspect/update first:**
- `harness-engineering/agent-evals/architect-evals/benchmark-suite/seed-catalog.tsv`
- `harness-engineering/agent-evals/code-review-evals/benchmark-suite/seed-catalog.tsv`
- `harness-engineering/agent-evals/programmer-evals/benchmark-suite/seed-catalog.tsv`
- `harness-engineering/quality/scripts/score_eval_suite.py`
- `harness-engineering/validators/validate_eval_suite.py`
**Done when:**
- Architect and Code Review eval suites include emergent (Staff+) seeds that test genuinely dangerous, hard to solve, or hard to even see production failures
- Per-complexity-category catch rates are reported in eval summaries
- Category-level misses directly inform which skills to build next
- The eval creation protocol structurally prevents future suites from being all-textbook

### Architect Agent + Suite — Confirmed Gaps From 2026-07-03 Ablation **[OPEN]**
**Source:** 3-arm Opus 4.8 skills ablation on `arch-eval-1-billing-ledger-migration` (bare / brief-only / brief+skills), dual-graded self + blind Opus judge (94.9% agreement). Report: `harness-engineering/agent-evals/architect-evals/ABLATION-2026-07-03-opus48-3arm.md`. Scores self 78.8 / 90.9 / 95.5%, judge 80.3 / 92.4 / 93.9%.

**A. Capability gaps — seeds missed even with full skills loaded (skill-gap candidates):**
- `SEED-ARCH-17` — performance/scalability confidence must DOWNGRADE for an unproven new schema; all three arms kept "measured" confidence + score 4 because 12K/sec was measured on the OLD schema. The measured→analogical confidence-transfer discipline isn't induced even by the full skills.
- `SEED-ARCH-31` — actor identity must PROPAGATE through migration-introduced boundaries (outbox/relay/strangler hops), not just be "present on every event." All arms treated actor-id as native to events but none addressed forwarding it through the new integration seams.
- `SEED-ARCH-34` — current monolith state must be formally scored as a Rejected BASELINE (to quantify migration ROI); all arms discussed root cause narratively but none produced a formal baseline evaluation.
- Next step: write/extend a skill targeting these three (evidence-scope confidence calibration; identity propagation across migration boundaries; current-state baseline scoring), then RE-ABLATE the full arm to confirm lift. This closes the eval-driven-development loop.

**B. Eval-design gap — brief-gameable process-compliance seeds:**
- The entire +12.1-pt brief lift (bare→format) landed on seeds where the brief NAMED the category/mechanism: `SEED-ARCH-06` (don't-mark-assumed — a literal brief rule), `SEED-ARCH-07` (adaptability-within-band — a literal brief rule), `SEED-ARCH-03` / `SEED-ARCH-16` (operability score calibration — only scoreable because the brief forces a scorecard), `SEED-ARCH-20` (retention tiering), `SEED-ARCH-10` (report conditional skills — a brief rule). These test FORMAT-COMPLIANCE, not architecture judgment, and are handed to the agent by the brief.
- The genuine-judgment seeds (04 reject-microservices, 14 Kafka, 19 compensating-entry rollback, 24 connection-exhaustion, 29 write-authority, 33 constitution-exception) were caught by the BARE arm with no prompting — real signal.
- Implication: some architect seeds should be redesigned so the invariant is NOT named in the brief (per eval-design-playbook "never name the invariant"), or reclassified as process-compliance vs judgment so scoring separates them. This is the architect-suite instance of the known "evals over-test process compliance" problem.

**C. Skills-vs-model finding (context-budget candidate):**
- On this fixture the software-architect skill FILES add only +1.5–4.5 pts beyond the brief, for ~2× the tokens (full arm 88K vs 43K bare / 49K format). Core pattern judgment is native to Opus 4.8; the skills act mainly as a conditional-skill router + org-specific checklist (their unique adds were SEED-10 routing, SEED-30 cohort rollout, SEED-32 HIPAA-infra). Candidate for the Context De-Noise work: move scorecard discipline into the brief/template and slim the base skills to routing + org-specific checklists. **Caveat: n=1 fixture, 1 sample/arm — needs variance repeats + a conditional-skill-heavy fixture (e.g. arch-eval-4 RAG) before acting, since this migration fixture rewards raw reasoning and may under-measure the skills.**

### Architect Eval-2 — Flash-Sale Ticketing Fixture Build **[OPEN / NOT STARTED]**
**Source:** 2026-07-04 — confirmed arch-eval-2 does NOT exist. The `architect-evals/` suite has only `arch-eval-1-billing-ledger-migration/`; no flash-sale/ticketing fixture, no seed-state docs, no seeds in the catalogs. Both the suite README expansion plan and `architect-evals/TODO.md` (row 2) list it as PLANNED / NOT STARTED.
**What it is:** A full second architect eval fixture (same shape as arch-eval-1) for a **greenfield flash-sale ticketing system** — dominant drivers: performance, scalability, "no double-sell" consistency, reliability. This is a content-generation task, not a run.
**What to build:**
- 6 seed-state docs: `feature-spec`, `system-blueprint`, `team-and-operations`, `constitution`, `constraints-and-nfrs`, `pattern-candidates`.
- `project-brief.md` — the ADR task directive.
- A seed-ledger (hidden oracle) with ~40 seeds at staff+ depth, plus rows added to the suite `seed-catalog.tsv` and `coverage-matrix.tsv`, honoring the eval-design-playbook.
**Design learnings to bake in (from the arch-eval-1 ablation — this fixture is the natural place to fix them):**
- **Invariants NOT named in the brief** — the whole point of the arch-eval-1 "eval-design gap" (item B above). Design seeds so the invariant is discovered, not handed over by the brief; separate genuine-judgment seeds from format-compliance seeds.
- **Conditional-skill-activation traps** — a greenfield/flash-sale fixture can test the routing behavior where the skills actually earned their keep (SEED-10/30/32-style). This also feeds the n=1 caveat in item C (needs a conditional-skill-heavy fixture before acting on the skills-vs-model finding).
**Mandatory pre-reads (per CLAUDE.md):** `bug-taxonomy.md`, `eval-design-playbook.md`, `agent-evals/README.md`, and the architect's `skills.md` (read FIRST, before designing seeds).
**Process:** write one scenario's worth (~40 seeds), then validate with multiple models; HOLD OFF running until scope is confirmed (same as arch-eval-1 canary discipline). Persist run-manifest / run-results rows on any eventual run.
**Done when:** the fixture exists, `validate_eval_suite.py` passes on it, the seed-ledger is multi-model audited, and `architect-evals/TODO.md` row 2 flips to DONE.

### Agent Eval Skill Coverage Mapper **[OPEN]**
**Source:** 2026-05-31 `/debate` on whether skill-specific evals are needed in addition to `agent-evals`.
**What it is:** Add an `agent-evals`-native mapper that shows which eval seeds test which skills, which skills should activate or stay silent, and whether agents actually used them during runs. Do not create a separate `skills-evals/` fixture hierarchy yet; keep canonical benchmark fixtures under the owning `harness-engineering/agent-evals/<agent>-evals/` suites.
**Why it matters:** A skill can help one target behavior while harming the agent through context overload, false positives, over-activation, verbosity, scope creep, or priority inversion. Agent evals should prove target lift without collateral damage.
**Current state:** **[PARTIAL]** `seed-catalog.tsv` already has `skill_source`; `validate_eval_suite.py` already recognizes optional `expected_conditional_skills` and `expected_non_activations`; `run-results.tsv` can carry `observed_conditional_skills`; `score_eval_suite.py` already computes activation recall and false-positive activation rate when those fields exist. This needs to be documented, generalized, and surfaced as a first-class map.
**Design status:** **[PROPOSED]** This is not settled doctrine. Debate the schema and protocol again before implementation, canary it on one skill and one agent suite first, and expect revisions based on what the canary proves. The mapper, ablation variants, metrics, and thresholds all have room for improvement before broad rollout.
**What to add:**
- Add `harness-engineering/agent-evals/skill-coverage-map.tsv` as a generated or validator-checked index over all benchmark suite `seed-catalog.tsv` files.
- Minimum map columns: `skill_slug`, `skill_path`, `agent`, `suite_path`, `eval_name`, `seed_id`, `expectation` (`required` / `forbidden` / `optional` / `neutral`), `test_role` (`target_behavior` / `negative_control` / `regression` / `harm_probe`), and `harm_probe` (`none` / `false_positive` / `overload` / `misrouting` / `verbosity` / `scope_creep` / `priority_inversion`).
- Standardize optional seed catalog columns across suites: `expected_conditional_skills` and `expected_non_activations`.
- Standardize optional run result columns: `observed_conditional_skills` and `skill_activation_notes`.
- Add `harness-engineering/agent-evals/skill-ablation-runs.tsv` for with-skill / without-skill comparison runs. Minimum columns: `run_id`, `skill_slug`, `variant` (`normal` / `skill_removed` / `skill_forced` / `skill_minimized`), `agent`, `suite_path`, `eval_name`, `seed_ids`, `model_id`, `target_delta`, `false_positive_delta`, `severity_accuracy_delta`, `activation_recall`, `activation_false_positive_rate`, `context_cost_delta`, and `decision`.
- Generalize the hardcoded conditional skill slug list in `validate_eval_suite.py` and `score_eval_suite.py` so skill slugs come from `framework/routing/skills-registry.md` or a derived agent-evals skill registry.
- Update scoring reports to show per-skill target lift, activation recall, activation false-positive rate, false-positive delta on negative controls, severity accuracy delta, cross-dimension regression, and context-cost delta when available.
**Targeted ablation protocol:**
- Use one-factor-at-a-time skill ablations by default to avoid combinatorial explosion. Do not test every skill x agent x seed x skill-combination unless prior evidence shows a conflict or overlap.
- For each candidate skill, pick one owning agent and three small seed groups: target seeds where the skill should help, forbidden/negative-control seeds where the skill should stay silent, and unrelated control seeds that detect context-window harm.
- Run matched variants: `normal`, `skill_removed`, and, when useful, `skill_minimized`. Use `skill_forced` only to test activation logic, not as the default proof of usefulness.
- Record context harm explicitly: prompt/context size, output length, latency, excessive checklist behavior, unrelated seed misses, false positives, and priority inversion.
- Escalate to pairwise skill-combination tests only when single-skill ablations suggest two skills overlap, conflict, or compensate for one another.
**Pass/fail model:**
- A skill passes when it improves or preserves mapped target-seed performance without increasing false positives, severity mistakes, unrelated seed misses, or context cost beyond the accepted threshold.
- A skill is redundant when `skill_removed` produces no meaningful target regression and no material collateral change.
- A skill fails or needs revision when target lift is outweighed by collateral damage: higher false positives, forbidden activation, degraded unrelated dimensions, excessive output bloat, latency/token cost, context-window pressure, or repeated priority inversion.
- Treat the core metric as `target lift - collateral damage`, not raw with-skill score alone.
**Likely files to inspect/update first:**
- `harness-engineering/agent-evals/README.md`
- `harness-engineering/agent-evals/*/benchmark-suite/seed-catalog.tsv`
- `harness-engineering/agent-evals/*/benchmark-suite/run-results.tsv`
- `harness-engineering/quality/scripts/score_eval_suite.py`
- `harness-engineering/validators/validate_eval_suite.py`
- `framework/routing/skills-registry.md`
**Done when:**
- A retained design debate or review records the chosen schema, rejected alternatives, and canary scope before implementation starts.
- A canary run on one skill and one agent suite proves the mapper and ablation workflow are practical before broader suite rollout.
- `skill-coverage-map.tsv` can answer which seeds test each skill across agent suites.
- Validator rejects unknown skill slugs and contradictory `required` vs `forbidden` expectations.
- Scorer reports activation recall and false-positive activation rate per skill across real run results.
- At least one high-risk shared skill and one conditional skill have retained normal vs removed/minimized ablation evidence.
- The docs state that standalone `skills-evals/` fixtures are deferred unless imported/community skills, cross-agent conflicts, or noisy ablations prove they are needed.

### Advanced Frontend Architecture Ablation Eval **[OPEN]**
**What it is:** Build the eval suite that gates default embedding/adoption of the refactored `advanced-frontend-architecture` skill. Compare Software Architect and Programmer behavior with and without the skill loaded, then use measured deltas to decide whether it should become a default agent load path or remain explicitly invoked.
**Why it matters:** The recent frontend architecture debate proposed a framework-agnostic selector for DDD, vertical slices, FSD, Orc-BASH/orchestration, hexagonal ports/adapters, and framework-native approaches. Do not assume the skill improves outcomes just because the refactor exists. First prove whether it changes agent decisions, improves architecture fit, or causes collateral harm through context load, default bias, verbosity, or over-engineering.
**What to build:**
- Seed catalog targeting staff+ complexity across different architecture decision scenarios
- Run each fixture as an ablation matrix:
  - **Software Architect without skill** — no `advanced-frontend-architecture` loaded
  - **Software Architect with refactored skill** — skill loaded explicitly, not as standing default context
  - **Programmer without skill** — no frontend architecture selector context; should follow an approved ADR or local conventions
  - **Programmer with forced skill** — skill loaded to detect whether implementation agents overreach into architecture selection
- Do not embed/adopt the refactored selector/validator skill as a default agent load path until the first ablation report exists. The refactor itself can proceed independently; the eval gates promotion to default context and should answer which agents should load it, when they should load it, and which failure modes it must target.
- Seeds should cover known failure modes:
  - Scoring all dimensions equally instead of weighting by context
  - Recommending micro-frontends for small teams (anti-pattern blindness)
  - Staying at Senior depth when multi-team/migration context demands Staff+
  - Hallucinating performance characteristics of architectures
  - Recommending SSR/hybrid for pure internal dashboards (mismatched rendering strategy)
  - Missing migration path reasoning for non-greenfield decisions
  - Producing score tables without evidence-backed argument chains
  - Failing to identify reversal triggers or follow-up decisions
  - Confusing internal component patterns (MVC/MVVM) with deployment architectures
  - Applying Distinguished-depth reasoning when Senior suffices (over-engineering noise)
  - Scoring BFF/GraphQL as a competing macro architecture instead of a complementary data layer
  - Failing to compose stacks (scoring SSR and Modular Mono separately instead of as one candidate like "SSR + Modular Mono + BFF")
  - Not marking N/A for internal-pattern dimensions (Delivery/Cost/Resilience when evaluating MVC vs FSD)
  - Over-escalating to Distinguished for routine org-wide decisions that are Principal-level (no actual platform bet)
- Add new framework-agnostic paradigm-selection fixtures:
  - Small CRUD/admin frontend where framework-native conventions should win
  - Domain-heavy single-framework app where DDD/vertical slices may beat strict FSD
  - Multi-framework shared-core scenario where pure modules plus `ui/<framework>/` may be justified
  - Brownfield app with existing conventions where migration cost should dominate
  - React case where Orc-BASH helps only if orchestration/state/API seams are justified
  - Angular/Vue/Svelte cases to prove the scoring does not leak React hook assumptions
- Grading rubric should check: correct candidate selection, appropriate depth escalation, dimension weighting rationale, evidence-backed scoring, complete reasoning trace structure, actionable recommendation with reversal triggers, and whether Programmer stays inside the Architect-approved handoff instead of reselecting architecture
- Minimum 24 seeds across rendering decisions, team-scaling decisions, migration decisions, pattern-selection decisions, and framework-agnostic paradigm-composition decisions
- Follow-up cleanup candidate: consider deleting or relocating the skill's `handoff-contract` portion if skill files should not reference specific pipeline agents such as Software Architect or Programmer. Prefer agent-neutral wording like "architecture decision owner" and "implementation agent" if the contract remains.
**Likely location:**
- `harness-engineering/agent-evals/frontend-architecture-evals/benchmark-suite/`
**Done when:**
- Seeds exist at staff+ complexity covering the major failure modes
- Scorer can evaluate reasoning traces against SKILL.md methodology, trace format, and ablation variants
- A retained ablation report compares Software Architect and Programmer with/without the skill and records target lift, false-positive activation, context-cost delta, and misrouting/overreach
- Running the suite reveals which dimensions/depth-levels agents handle poorly and whether default adoption of the refactored selector/validator skill is justified
- At least 2 negative controls (reasonable architecture choices that should NOT be flagged as wrong)

### Memory-Regression Skill Evals **[OPEN]**
**What it is:** An agent eval suite for the memory-regression skill — verifying that agents correctly apply bounded-growth testing, select the right adapter, avoid known antipatterns, and produce working test scaffolds.
**Why it matters:** The skill has 8 platform adapters with platform-specific gotchas, a universal measurement pattern, and gating promotion criteria. Without evals, there's no way to measure whether agents actually follow the methodology or fall into documented antipatterns.
**What to build:**
- Seed catalog targeting staff+ complexity across platforms (not just browser/Node)
- Seeds should cover the known failure modes:
  - Unsigned subtraction without safe cast (Go uint64, Rust usize)
  - Measuring before GC / not forcing cleanup
  - Using wrong GC API (Thread.activeCount vs ThreadMXBean, RSS vs heapUsed)
  - Asserting on absolute values instead of growth delta
  - Not draining HTTP response bodies (Go, Node)
  - Testing with production heap size (hides leaks)
  - Copy-pasting adapter snippets without adaptation (wrong framework, missing setup)
  - Confusing diagnostic-only vs gate-ready tests
  - Setting arbitrary budgets without empirical calibration
  - Missing non-heap resources (FDs, GPU, direct buffers) when present in workload
  - Incorrectly promoting a high-variance test to blocking gate
- Grading rubric should check: correct adapter selection for platform, proper bounded-growth pattern (warmup→baseline→stress→cleanup→measure→assert), no antipattern violations, actionable failure output, correct GC/cleanup strategy for platform
- Minimum 24 seeds across browser, Node, Go, Python, JVM, mobile, and GPU/native
**Likely location:**
- `harness-engineering/agent-evals/memory-regression-evals/benchmark-suite/`
**Done when:**
- Seeds exist at staff+ complexity covering major failure modes per platform
- Scorer can evaluate test scaffolds against SKILL.md methodology and adapter correctness
- Running the suite reveals which platforms/patterns agents struggle with most
- At least 2 negative controls (correct but suspicious patterns that should NOT be flagged)

### AGENTS.md Hot/Cold Split **[OPEN]**
**What it is:** Split `AGENTS.md` (223 lines, loaded every turn) into a hot file (~100 lines, always-active rules) and a cold bootstrap file (read once on first turn). Third file: move the 24-line Reference Docs path catalog to `framework/operations/reference-index.md` — it's not startup-only (needed mid-session for lookups) but not always-active (not needed every turn), so it's an on-demand lookup index, not hot or cold.
**Why it matters:** ~7k tokens wasted per turn on startup/install/reference content that's irrelevant after turn 1. Shorter instruction surface may improve instruction compliance.
**What to do:**
- Verify actual model versions of peer CLIs before any audit work
- Build parity evals first (must-have: first-turn startup, peer dispatch skip, mid-session routing, resume after compression, hot-file-only sufficiency)
- Run evals against current single-file as baseline
- Implement the split
- Run evals against split files, compare
- Only ship if all must-have scenarios pass and token savings are confirmed
**Risks:** cold file not read on first turn, context compression losing startup state, mode-switch regression. Mitigated by idempotent bootstrap contract.
**Done when:**
- Eval suite exists and passes against baseline
- Split implemented and eval suite still passes
- Token savings measured quantitatively

### Fixing Programmer Evals **[OPEN]**
**Source:** Opus 4.6 eval run on 2026-05-29. Scored 95.9% (71/74 CAUGHT, 3 MISSED, 0 PARTIAL). Run exposed structural weaknesses in the eval design rather than meaningful agent skill gaps.
**What it is:** The programmer eval suite has design issues that inflate scores and fail to test actual programmer skills (code production, test iteration, design decisions under ambiguity).
**Why it matters:** A 95.9% score looks strong, but the eval is testing code review ability, not programmer ability. It also lacks negative controls, so false-positive rates are unmeasured.
**What to fix:**

1. **Reduce repetitive template seeds.** ~30 of the 74 seeds follow the same pattern across all 9 evals: "SRP violation," "non-injectable clock/dependency," "tests don't cover X," "scores overstated." Once the model recognizes the checklist template, it can mechanically hit all of them. Replace repetitive slots with domain-specific seeds unique to each fixture.

2. **Add negative controls.** The CR evals have 14 NC seeds testing false-positive restraint; the programmer evals have zero. The agent can flag everything aggressively with no penalty. Add 1-2 NCs per eval (correct-but-unusual patterns that should NOT be flagged as issues).

3. **Make it actually test programmer skills.** The current rubric is "did you identify the issue" — identical to the CR eval's scoring. A real programmer eval should require: producing working code, running tests, iterating when tests fail, making design tradeoff decisions. Add execution-based scoring: does the fix compile, do tests pass, is the fix correct?

4. **Reduce spec-guided bug hunting.** The brief often tells you exactly where to look (e.g., "deduplicate same userId + templateId" directly points to the dedup key). Harder evals would have vaguer requirements requiring the agent to infer what's wrong from operational behavior or domain knowledge, not from AC wording.

5. **Add large-noise fixtures.** All evals are 100-300 lines with 7-9 planted bugs (~1 bug per 20-40 lines). Real code has one subtle bug per thousands of lines. Add 2-3 evals with 800-1500 lines, distractor modules, harmless suspicious code, and only 3-5 real seeded issues to test signal-to-noise discrimination.

6. **Resolve mixed seed ownership.** SEED-1D and SEED-1I are explicitly marked "Expected owner: Code Review" not "Programmer." Either remove them from the Programmer eval scoring or reclassify them as cross-cutting seeds with adjusted expectations.

7. **Add difficulty tiering.** The CR evals have Easy/Medium/Hard with domain complexity (textbook → principal). The programmer evals are all roughly "medium" with no tiering. Add difficulty levels and ensure at least 30% of seeds are Hard (requiring deep domain reasoning, not just pattern recognition).

8. **Differentiate evals 6-9 from 1-5.** Evals 6-9 use `SEED-CL-XX` (checklist) format and test function-quality checklist items rather than domain correctness. The trick seeds are the only ones with real programmer-level challenge. Either unify the format and difficulty profile, or explicitly split into "domain correctness" and "code quality checklist" sub-suites with separate scoring.

**Done when:**
- At least 10 negative control seeds exist across the suite
- At least 3 evals include execution-based scoring (fix must pass tests)
- Repetitive template seeds (SRP, non-injectable clock, tests-missing, scores-overstated) reduced to max 2 instances each across the full suite
- At least 2 large-noise fixtures (800+ lines) exist
- Difficulty tiering is applied to all seeds with min 30% Hard
- A strong agent that scores 95%+ on the current suite scores measurably lower on the redesigned version

### Code Review Hard-Mode Benchmark Extension **[OPEN]**
**Source:** User-provided external AI run summary after the upgraded Code Review suite produced a `100%` detection rate with `0` false positives. The external reviewer judged the suite internally consistent and production-realistic, but noted that top Code Review agents may now recognize repeated fixture patterns.
**What it is:** Add a harder extension layer for Code Review evals that tests signal-to-noise, vague requirements, and non-repetitive production traps rather than explicit-spec treasure hunting.
**Why it matters:** The current Code Review suite is strong as a staff+ explicit-spec review benchmark, but a 100% run means it may not separate the best Code Review agents. The repeated "missing tests" and "observability dimensions missing" seeds can inflate scores once a model learns the template.
**Current state:** Code Review benchmark metadata validates with `75` seeds and staff+ depth floors satisfied, but the suite still has `0 benchmark_full` runs and should be treated as pilot until scored repeatedly.
**What to add:**
- **Blind / weak-spec evals:** Add fixtures with vague business goals, operational constraints, and partial handoffs so the reviewer must infer invariants instead of matching explicit AC wording.
- **Large-noise fixtures:** Add 2-3 Code Review evals with roughly 800-1500 lines, distractor modules, harmless suspicious code, and only 5-7 real seeded issues.
- **Reduce repeated patterns:** Do not include one observability seed and one missing-test seed in every eval. Replace several with config rollout, compatibility, data-modeling, operational cost, incident recovery, and rollback traps.
- **Stricter scoring for soft seeds:** For missing-test and observability seeds, require the exact missing causal case and exact fields for `CAUGHT`; otherwise score as `PARTIAL`.
- **Embedded negative controls:** Place correct-but-suspicious patterns near real defects so agents must discriminate locally, not just avoid false positives globally.
- **Less direct project briefs:** Keep specs realistic, but avoid AC phrasing that names the exact invariant to inspect, such as "idempotent before side effects." Prefer operational/business requirements that imply the invariant.
**Done when:**
- A hard-mode Code Review extension exists with weak-spec and large-noise fixtures.
- The extension has less repetitive seed shape than the current benchmark.
- At least one strong agent that scores near-perfect on the current suite misses or partially catches meaningful hard-mode seeds.
- Scoring reports separate explicit-spec benchmark performance from hard-mode adversarial review performance.

---

## Reverse-Spec Eval Suite **[OPEN]**

### What it is
An agent eval suite for the reverse-spec skill — verifying that the extraction pipeline produces correct, complete, and consistent specifications from existing codebases.

### Why it matters
The reverse-spec skill is now production-grade (v2.0.0) with a complex DAG of 5 bounded passes, confidence hierarchies, characterization tests, data migration profiling, and adversarial verification. Without evals, there's no way to measure whether agents executing this pipeline actually follow the methodology or produce correct output.

### What to build
- Seed catalog targeting staff+ complexity (real brownfield extraction challenges, not toy examples)
- Seeds should cover the known failure modes the skill was designed to prevent:
  - Confidence inflation (marking `inferred` as `confirmed`)
  - Hallucinating absence (`verified_none` without proof)
  - Missing failure matrices for state-changing endpoints
  - Zombie feature flags extracted as live requirements
  - Polymorphic column data mapped 1:1 without implicit schema extraction
  - Silent drops extracted as live webhook contracts
  - Soft-delete leakage (unfiltered reads)
  - Tenant scoping assumed from helper existence without query verification
  - Async job wire-format confusion (domain objects vs primitive IDs)
  - Convention-based requirements without batch-approval grouping
  - Characterization tests with unmasked nondeterministic fields
  - Data migration target mapping produced before Architect (premature Stage 2)
  - Normalization stripping rewrite-critical metadata fields
  - Missing `[CONTRACT VS IMPLEMENTATION]` marker when observed ≠ normative
- Grading rubric should check structural compliance (correct REQ format, risk tags, confidence labels, criticality assignment) and behavioral correctness (right confidence level for evidence type, right criticality for domain)
- Minimum 24 seeds across all 5 passes + synthesis

### Likely location
- `harness-engineering/agent-evals/reverse-spec-evals/benchmark-suite/`

### Done when
- Seeds exist at staff+ complexity covering the major failure modes
- Scorer can evaluate pass artifacts against the SKILL.md methodology
- Running the suite reveals which extraction phases agents struggle with most

---

## Governance Deep Dive **[OPEN]**

### ADR Governance Bloat Audit
**What it is:** Evaluate whether the governance ADR registry, comply-or-explain model, and $adr skill add genuine enforcement value or just ceremonial overhead.
**Why it matters:** Added 2026-06-03 based on a 3-model debate recommending ADRs + focused skills. But governance layers can easily become "process for process's sake" — rules that no one reads, exceptions that never trigger re-evaluation, or skills that load context without changing outcomes.
**What to evaluate:**
- After 3-5 governance ADRs are written: do agents actually invoke the $adr skill during implementation? Does the JIT lookup change their behavior, or do they just comply anyway from the existing pipeline ADR?
- Is the exception ledger tracking real deviations, or is it always empty (meaning rules are too broad or too obvious)?
- Does the 3-in-90-day re-evaluation trigger ever fire? If not, is the threshold wrong or are the ADRs just correct?
- Is there measurable context cost? Compare token usage on tasks with/without governance ADR loading.
- Could the same enforcement be achieved by linter rules alone without the document layer?
**Audit criteria:**
- If no governance ADR has been referenced by an agent in 30 days of active pipeline use → the registry is dead weight
- If no exceptions are recorded after 10+ features → rules are either too obvious or too broad
- If the $adr skill loads but agents never deviate or escalate → the skill is ceremony
**Integration tests to run after first real ADRs exist:**
- Does `architecture-fitness.md` conflict with or duplicate governance ADRs? Clarify division of responsibility if they compete.
- Does `escalation-policy.md` need a formal governance ADR trigger, or does the skill's inline "escalate to Coordinator" instruction suffice?
- Do agents correctly read ADR-INDEX.md, match scope globs, and load only ACCEPTED ADRs?
- Does the exception ledger actually get written to, and does the 3-in-90-day trigger fire when it should?
- Does the Architect promotion step fire on cross-cutting decisions and skip on feature-scoped ones?
**Done when:**
- A retained audit report exists with evidence-based keep/prune/revise decisions for the governance layer
- Any unused governance ADRs are either deprecated or the enforcement mechanism is strengthened

### Focused Loop Skills ($ui-loop, $test) **[OPEN]**
**What it is:** Specialized operating modes for the generic commit→push→feedback loop. $ui-loop iterates fast in browser and reconciles after. $test runs focused test suites based on coverage and file changes.
**Source:** 2026-06-03 debate consensus (3/3 agreement).
**What to add:** Design and implement both skills, wire into Programmer agent as conditional skills.

### Enforcement Harness (git hooks + CI) **[PARTIAL]**
**What it is:** Git hooks and CI checks running identical enforcement rules. "If you can't measure it, you can't enforce it."
**Source:** 2026-06-03 debate consensus (3/3 agreement).
**Current state:** Profiled runner (`run-all.sh --profile precommit|ci|governance`) implemented. Opt-in hooks installer exists. Pre-commit profile runs fast validators (path references, registry integrity, contracts). No application-level test execution yet.
**What's still needed:**
- Refactor validators to accept `ADS_WORKSPACE_ROOT` env var so governance scenarios can call real validators against fixture workspaces (not just pattern assertions)
- Once validators are workspace-aware, upgrade governance scenarios from tautological assertions to subprocess invocations of real validator logic
- Add architecture linting (module import boundaries), governance ADR scope-glob syntax validation
- CI workflow file (GitHub Actions) that calls `run-all.sh --profile ci`
- **Add application-level checks to harness hooks and CI.** Current hooks only run framework structural validators. Extend with a three-tier check model:

  **Pre-commit (fast, changed files only):**
  - Format changed files (Prettier, Black, gofmt, etc.)
  - Lint changed files (ESLint, Ruff, golangci-lint, etc.)
  - Maybe typecheck affected files (tsc --noEmit on changed + dependents)

  **Pre-push (broader, still local):**
  - Unit tests (full suite or affected)
  - Full typecheck
  - Maybe integration smoke tests (fast subset)

  **CI (full pipeline, runs on every PR/push):**
  - Full lint
  - Full typecheck
  - All unit tests
  - Integration tests
  - Playwright E2E
  - Detox E2E (maybe nightly or before release only)
  - Build (production bundle)
  - Security scans (dependency audit, SAST)

  Implementation should: auto-detect project tooling from config files (package.json, tsconfig, pytest.ini, go.mod, Podfile, etc.), scope pre-commit checks to changed files only for speed, fail the hook on any check failure, respect timeouts, and allow per-project override config. The DevOps agent should be able to generate these hook configs as part of its Delivery Workflow.

### Governance Workflow Scenarios (BDD-lite) **[PARTIAL]**
**What it is:** 5-10 executable tests covering pipeline governance invariants: approval gates hold after resume, routing doesn't dispatch past blocks, artifact handoffs are complete.
**Source:** 2026-06-03 debate consensus (2/3 + 1 agrees on need). Plain Pytest with readable scenario names — no Gherkin.
**Current state:** 19 governance scenarios in `harness-engineering/governance-scenarios/` covering spec gates, ADR governance, and artifact integrity. All pass in 0.12s. Tests currently assert governance patterns directly (not via real validators).
**What's still needed:**
- Upgrade to real validator invocation once validators support workspace targeting
- Add scenarios for: pipeline-state transition gates, security sign-off gate, Red-Team blocking, Implementation Outline readiness gate

### Spec Preamble Strengthening **[OPEN]**
**What it is:** Add a structured "Problem / Why / User Journey" section to the spec template to absorb PRD value without a parallel document type.
**Source:** 2026-06-03 debate consensus (3/3 reject standalone PRDs, agree on strengthening spec preamble).

---

## Integrations

### UI Scraper — Crawlee Setup and Testing **[OPEN]**
**What it is:** Download Crawlee into `integrations/ui-scraper/` and test it against factory.ai at all viewport sizes.
**Why it matters:** The scraper captures page structure/styles/assets for later UI reproduction. Need to validate it works across responsive breakpoints before building the reproduction pipeline.
**What to do:**
- `cd integrations/ui-scraper && npm init -y && npm install crawlee playwright`
- Build a basic PlaywrightCrawler entry point that spiders factory.ai
- Test at all viewport widths: fullscreen (1920px), laptop (1440px), tablet (768px), mobile (375px)
- Capture DOM snapshots, computed styles, and asset references at each size
- Verify output is usable for downstream UI reproduction
**Done when:**
- Crawlee is installed and a working crawler exists
- factory.ai is fully crawled at all responsive breakpoints (fullscreen → mobile)
- Output per page/size is saved in a structured format ready for reproduction

---

## First-Run Init Hook + Slash-Command Installer

### Init Hook — Audit Convergence Follow-Through **[PARTIAL]**
**What it is:** A first-run bootstrap (`ads-initialization.sh` workspace+sentinel, opt-in collision-checked `install-slash-commands.sh`, `.claude/settings.json` SessionStart hook) plus its external-audit convergence. Full context + resume steps live in **`init-hook-audit-HANDOFF.md`** (see its `RESUME 2026-06-27` section). **Note:** this item involves code, unlike most todo.md entries.
**Source:** 2026-06-27 — pinned single-user threat model `TM-INIT-SU-01` and re-audited. Convergence achieved (escalation stopped): internal verifier PASS 9.0, Gemini 3.1 Pro PASS 10, Codex GPT-5.5 xhigh 8.2 (1 blocker R1-1). R1-1 (unanchored `grep` sentinel decoy → I4) fixed + locally verified. 5 code fixes applied (V3-5, F13, F15, V3-11, R1-1).
**What's still needed (3 open decisions, also tracked as session Task #5):**
- **Round-2 diff-only re-audit** of the R1-1 `sentinel_valid` fix (expected Codex PASS → fully converged) — OR accept the local decoy/duplicate exploit-test evidence.
- **Commit?** Nothing committed; branch off `main` if yes (3 new artifacts + the 5 fixes).
- **Report retention:** keep in `.local-artifacts/external-audit/` (default) or move to `reports/external-audit/`.
**Done when:** the 3 decisions above are resolved and (if chosen) round-2 confirms PASS.
**Key refs:** handoff `init-hook-audit-HANDOFF.md`; frozen packet `ADS-memory/.local-artifacts/external-audit/packets/20260627T161208Z-audit-packet.md` (hash `sha256:323997c16e404de9`); working Codex dispatch `codex exec --json -c features.multi_agent=false -c 'hooks.SessionStart=[]'` (memory `codex-exec-empty-output`).

---

## Notes

- None of these require Python or code — all are markdown documentation, agent instruction files, and schema definitions
- A2A: monitor but don't build to yet
- Items marked [PARTIAL] have a head start from the speckit integration already done in this repo
