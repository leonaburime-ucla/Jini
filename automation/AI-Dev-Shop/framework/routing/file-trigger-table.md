# File Trigger Table

This table helps the Coordinator choose the likely owner agent when the changed files or requested paths are already known.

It is a routing aid, not an absolute law. Human intent and explicit mode switches still take precedence.

## Trigger Rules

| File Pattern or Area | Likely Owner | Why |
|---|---|---|
| `agents/**`, `skills/**`, `framework/spec-providers/**`, `framework/workflows/**`, `framework/templates/**`, `framework/slash-commands/**`, `harness-engineering/**` | Coordinator + Observer maintenance flow | Toolkit source changes affect the framework itself and should trigger harness maintenance behavior. |
| `project-knowledge-template/governance/**`, `<ADS_MEMORY_ROOT>/governance/**` | Coordinator or Architect | Project-governance changes affect architectural constraints and operating rules. |
| `project-knowledge-template/knowledge/**`, `<ADS_MEMORY_ROOT>/knowledge/**` | Coordinator or Observer | Live memory surface changes affect injected context, learnings, and retained project conventions. |
| `framework/routing/**` | Coordinator | Routing docs are Coordinator-owned source-of-truth artifacts. |
| `framework/operations/**` | Coordinator | Operational quickstarts, reminders, and runtime maps are Coordinator-owned. |
| `project-knowledge-template/reports/codebase-analysis/**`, `<ADS_MEMORY_ROOT>/reports/codebase-analysis/**` | CodeBase Analyzer | Analysis artifacts belong to discovery and brownfield mapping. |
| `specs/**`, `openspec/**`, `_bmad-output/**`, `**/PRD.md`, `**/ux-spec.md`, `**/story-*.md`, `**/epic-*.md` | Spec Agent | Provider-owned planning artifacts and clarifications belong to Spec until they are handed off downstream. |
| `project-knowledge-template/reports/pipeline/**/red-team-findings.md`, `<ADS_MEMORY_ROOT>/reports/pipeline/**/red-team-findings.md` | Red-Team Agent | Adversarial preflight belongs to Red-Team. |
| `project-knowledge-template/reports/pipeline/**/adr.md`, `project-knowledge-template/reports/pipeline/**/research.md`, `<ADS_MEMORY_ROOT>/reports/pipeline/**/adr.md`, `<ADS_MEMORY_ROOT>/reports/pipeline/**/research.md` | Architect | ADRs and architecture research are Architect outputs. |
| `project-knowledge-template/reports/pipeline/**/tasks.md`, `project-knowledge-template/reports/pipeline/**/pipeline-state.md`, `<ADS_MEMORY_ROOT>/reports/pipeline/**/tasks.md`, `<ADS_MEMORY_ROOT>/reports/pipeline/**/pipeline-state.md` | Coordinator | Task generation and pipeline state are Coordinator-owned artifacts. |
| `project-knowledge-template/reports/pipeline/**/test-certification.md`, `<ADS_MEMORY_ROOT>/reports/pipeline/**/test-certification.md`, `__tests__/**`, `tests/**` (test-definition work) | TDD Agent | Test design and certification belong to TDD. |
| `src/**/*.sql`, `db/**`, `migrations/**`, `supabase/migrations/**` | Database Agent | Schema, migration, and query ownership start with Database. |
| `supabase/functions/**`, Supabase platform wiring | Database Agent -> Supabase Sub-Agent when needed | Supabase-specific implementation belongs to the platform specialist under Database. |
| frontend UI files such as `app/**`, `pages/**`, `components/**`, `src/ui/**` | Programmer or Web Design depending on task | UI implementation belongs to Programmer; design-system, UX, or visual-direction work belongs to Web Design. |
| Expo project files such as `app.config.*`, `app.json`, `eas.json`, `.eas/workflows/**`, `expo-module.config.json`, `modules/**`, `plugins/**`, and Expo Router `app/**` | Programmer, Architect, or DevOps depending on scope | Expo implementation loads `skills/expo-react-native/SKILL.md`; architecture/topology choices route to Architect; EAS workflows/deployment route to DevOps. |
| browser journey tests such as `__tests__/e2e/**`, `playwright/**` | QA/E2E Agent | Browser-level user-journey verification belongs to QA/E2E. |
| CI/CD, deployment, infra such as `.github/workflows/**`, `Dockerfile*`, `infra/**`, `terraform/**` | DevOps Agent | Delivery and environment automation belong to DevOps. |
| API docs, release notes, OpenAPI, changelog files | Docs Agent | User-facing and integrator-facing documentation belongs to Docs. |
| security reviews, authz policy reviews, threat reports | Security Agent | Threat modeling and severity classification belong to Security. |

## Brownfield Rule

If a request targets an existing codebase and the relevant file area is not yet clear, default to CodeBase Analyzer before downstream planning.

## Unknown Area Rule

If the file pattern does not clearly map to one owner:

1. run a small read-only discovery pass first
2. return the likely owner plus the evidence paths
3. then dispatch the owner agent
