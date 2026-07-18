# `@jini/memory` — provenance

**New package, not yet in the locked §3 package set in
`docs/jini-port/extraction-plan.md`.** Same precedent as `@jini/deploy` and
`@jini/registry`: flagged here for Coordinator/Software-Architect sign-off
before being folded into the locked list.

Built per the task-6 audit's PART B brief off `docs/jini-port/recon/
r1-daemon.md`'s TASK 1 MIXED classification for the daemon's top-level
`memory*.ts`: "memory subsystem... generic capability with OD-shaped
payloads." This is the daemon-side backend capability (extraction/rules/
verification), a completely different thing from `packages/ui/src/features/
memory/`'s `MemorySection.tsx` (the frontend presentation layer, ported
separately in an earlier session).

## Discrepancy in the task brief, flagged rather than silently resolved

The task brief named 7 files: `memory-cleanup.ts`, `memory-connectors.ts`,
`memory-extractions.ts`, `memory-llm.ts`, `memory-rules.ts`,
`memory-verify.ts`, `memory.ts`. On a fresh clone of `leonaburime-ucla/
open-design`'s `refactor/web-memory-slice` branch (the branch the recon doc
itself was written against) and a full-history search (`git log --all
--oneline -- '**/memory-cleanup.ts'` across every branch), **`memory-
cleanup.ts` does not exist anywhere in the OD repository.** Only 6 of the 7
named files are real. This source-map documents what was actually read and
ported/skipped for those 6 — `memory-cleanup.ts` is not addressed because
there is nothing to address.

## Read all 6 files in full; classification per file (not one blanket verdict)

The recon's "generic capability with OD-shaped payloads" description turned
out to fit **only about a third** of this directory's actual content once
read end-to-end. The rest is materially more OD-product-specific than a
one-line recon summary could capture — memory type taxonomies, an
OpenDesign-branded connector-mining assistant, and coding-agent-CLI process
execution, not just "payload shape."

| Origin file | Verdict | Why |
|---|---|---|
| `memory.ts` | **Split: generic mechanism ported, OD payload/business-logic left behind** | See "What was ported" below. |
| `memory-extractions.ts` | **Ported in full**, as `src/extraction-log.ts` | Already fully generic in the origin — verified zero `@open-design/*` imports; its only coupling was importing `memoryEvents` from `memory.ts`, replaced with the log's own independent `EventEmitter`. |
| `memory-verify.ts` | **Ported: pure algorithm + record log**, as `src/verify.ts` | `enforceVerify`'s rule-coverage matching (`rowCoversRule`, `significantWords`, the STOPWORDS list) is a generic "does this row's text cover this rubric item" algorithm with zero OD content. Its one real coupling — extracting a scorecard from output text via OD's `<od-card type="verify-scorecard">` markup (`splitOnOdCards` from `@open-design/contracts`) — was generalized into a host-supplied `extractScorecard: (output: string) => VerifyScorecard \| null` callback instead of a hardcoded parser. |
| `memory-connectors.ts` | **NOT ported — correctly OD-product, not "generic with OD payload"** | This is an OpenDesign-branded connector-mining assistant: a ~30-pattern regex list of *design-specific* vocabulary (`design system`, `figma`, `typography`, `dark mode`, Chinese design terms) used to filter what counts as "design-relevant," a system prompt literally titled "You are a design-memory extractor for OpenDesign connected-app context," and Notion-specific page-opening heuristics. There is no generic "connector fact-mining" mechanism left over once the design-topic filtering and OD branding are removed — the whole file *is* that filtering. Skipped, not forced. |
| `memory-llm.ts` | **NOT ported — deeply OD-coupled, not cleanly separable in this pass** | Three intertwined concerns: (1) a genuinely generic "call one of N LLM HTTP APIs with a system+user prompt, parse strict JSON" sub-pattern (`callAnthropic`/`callOpenAI`/`callAzure`/`callGoogle`) — a real future extraction candidate, noted here for whoever picks this up next; (2) OD-branded system prompts ("personal AI design assistant") and memory-config provider-override shape; (3) local coding-agent-CLI execution (`claude`/`codex`/`opencode` one-shot invocation via `@open-design/platform`'s `createCommandInvocation`, agent env building) that has nothing to do with memory extraction generically — it's "run one of OD's supported coding CLIs headlessly." Attempting to port this file in the time available for this task risked exactly the failure mode called out in the audit-lessons section of the task brief (a declared port whose implementation doesn't hold up); skipped rather than forced. |
| `memory-rules.ts` | **NOT ported — thin wrapper entirely dependent on the skipped `memory-llm.ts`** | `distillRulesFromAnnotations`'s heuristic pass is a few lines of generic templating, but its LLM pass calls `suggestWithLLM` from the skipped `memory-llm.ts`, and its system prompt is OD-specific ("distil a designer's review annotations..."). Not portable independent of the file above. |

## What was ported from `memory.ts`

The filesystem fact-store *mechanism* — frontmatter-backed entry files, a
human-editable `INDEX.md` of link bullets as the "active set" source of
truth, a minimal `.config.json`, change events, deterministic id derivation
(slugify + FNV-1a hash fallback for non-ASCII names) — is genuinely generic
and was ported as `src/note-store.ts` (`createNoteStore`). **Not ported**
(left as OD product/business logic, not mechanism):

- **The type taxonomy itself.** OD's `MEMORY_TYPES` (`profile`/`user`/
  `feedback`/`project`/`reference`/`rule`) is a fixed, OD-chosen bucket set
  imported from `@open-design/contracts`. Generalized into
  `NoteStoreConfig.validTypes`/`defaultType` — entirely host-supplied.
- **`composeMemoryBody`** (prompt-composition rendering: profile as a
  structured key/value block, rules as a verify-rubric, others as
  `**name** — description` bullets) — this is OD's specific system-prompt UX
  for *how* memory gets injected into a chat turn, not a store capability. A
  host composes its own prompt from `listActiveEntries`/`readEntry`.
- **`listActiveRuleEntries`** — a one-line OD-specific wrapper (`rule`-type
  filter over the active set) now trivially expressible by a host as
  `(await store.listActiveEntries(dataDir)).filter(e => e.type === 'rule')`.
- **The onboarding→profile capture** (`captureProfileFromForm`,
  `parseFormAnswers`, `CANONICAL_PROFILE_LABELS` — OD's specific discovery-
  form field labels like "Organization size"/"Aesthetic / taste") — OD
  product UX, not a store concern.
- **The heuristic regex extraction pack** (`REMEMBER_PATTERNS`,
  `extractFromMessage`) — this is content classification ("does this
  sentence mean 'remember this'?"), not a reusable mechanism; the English/
  Chinese trigger phrases are themselves the entire value of the file.
- **`maskMemoryExtractionConfig`** and the `.config.json` extraction-
  provider-override fields (`chatExtractionEnabled`/`profileEnabled`/
  `rewriteEnabled`/`verifyEnabled`/`extraction`) — these are OD chat-hook
  toggles paired 1:1 with the skipped `memory-llm.ts`/onboarding features.
  The ported config keeps only the generic on/off master switch (`enabled`).

**One deliberate design change beyond de-branding:** the origin's `memory.ts`
shared one module-level `EventEmitter` (`memoryEvents`) across every call
site, which only worked because OD ran exactly one memory store per daemon
process. `createNoteStore`/`createExtractionLog`/`createVerifyLog` are
factories that each return their own independent `EventEmitter` instance, so
multiple stores in one process (or in tests) never cross-fire events.

## `entry-frontmatter.ts` — a new, narrower helper, not the ported
`design-systems/frontmatter.ts`

The note-store entry format needs exactly three flat scalar frontmatter
fields (`name`/`description`/`type`) plus a body. OD's actual frontmatter
parser (`apps/daemon/src/design-systems/frontmatter.ts`) is a fuller
YAML-subset parser (nested objects, arrays, block-literal `|` strings) that
belongs to the `design-systems/` subsystem — a different area, out of this
task's brief (registry/memory/services/migration), and porting the whole
subsystem to satisfy one small caller would be scope creep. `entry-
frontmatter.ts` is a small, self-contained, purpose-built parser/renderer
for exactly the note-store's shape — not a copy or subset extraction of the
design-systems parser, and not a duplicate of it (different scope, no
shared code).

## Dependencies

None beyond Node builtins (`node:fs/promises`, `node:path`, `node:events`,
`node:crypto`).
