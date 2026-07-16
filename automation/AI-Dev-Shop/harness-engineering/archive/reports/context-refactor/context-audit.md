# Context Audit (SMF.1)

- Date: 2026-03-03T20:05:34Z
- Scope: agents/*/skills.md, skills/**/*.md, key workflow docs
- Status: Initial baseline audit (v1)
- Scope note: `skills/vercel-*` content is frozen for Skill-MD-Format refactor work (keep in report for visibility; do not modify during execution).

## Method
- Automated baseline tagging of non-empty lines into EXECUTE, RATIONALE, DUPLICATE, OTHER.
- DUPLICATE = normalized line appears in >=3 files.
- This is a first-pass triage; manual pass still required for precision on borderline lines.

## Scope Summary
- Files audited:      199
- Total duplicate normalized lines (unique):      202

## Directory Summary
| Directory | Files | Total Non-Empty Lines | EXECUTE | RATIONALE | DUPLICATE | OTHER |
|---|---:|---:|---:|---:|---:|---:|
| agents | 19 | 1262 | 596 | 41 | 17 | 608 |
| skills | 175 | 18708 | 4454 | 322 | 847 | 13085 |
| workflows | 5 | 584 | 259 | 17 | 4 | 304 |

## File-by-File Counts
| File | Total Non-Empty Lines | EXECUTE | RATIONALE | DUPLICATE | OTHER |
|---|---:|---:|---:|---:|---:|
| `agents/architect/skills.md` | 70 | 27 | 7 | 2 | 34 |
| `agents/code-review/skills.md` | 50 | 22 | 0 | 1 | 27 |
| `agents/codebase-analyzer/skills.md` | 94 | 33 | 5 | 1 | 55 |
| `agents/coordinator/skills.md` | 162 | 88 | 5 | 1 | 68 |
| `agents/database/skills.md` | 58 | 28 | 1 | 2 | 27 |
| `agents/database/supabase/skills.md` | 47 | 30 | 0 | 1 | 16 |
| `agents/devops/skills.md` | 47 | 27 | 0 | 0 | 20 |
| `agents/docs/skills.md` | 36 | 22 | 0 | 0 | 14 |
| `agents/observer/skills.md` | 84 | 34 | 3 | 1 | 46 |
| `agents/programmer/skills.md` | 103 | 46 | 4 | 1 | 52 |
| `agents/qa-e2e/skills.md` | 44 | 26 | 1 | 0 | 17 |
| `agents/red-team/skills.md` | 65 | 23 | 1 | 1 | 40 |
| `agents/refactor/skills.md` | 43 | 22 | 2 | 1 | 18 |
| `agents/security/skills.md` | 42 | 15 | 0 | 1 | 26 |
| `agents/spec/skills.md` | 85 | 43 | 3 | 1 | 38 |
| `agents/system-blueprint/skills.md` | 53 | 17 | 7 | 1 | 28 |
| `agents/tdd/skills.md` | 69 | 38 | 2 | 1 | 28 |
| `agents/testrunner/skills.md` | 70 | 37 | 0 | 1 | 32 |
| `agents/vibecoder/skills.md` | 40 | 18 | 0 | 0 | 22 |
| `skills/agent-evaluation/SKILL.md` | 107 | 44 | 3 | 0 | 60 |
| `skills/api-contracts/SKILL.md` | 45 | 13 | 0 | 0 | 32 |
| `skills/architecture-decisions/SKILL.md` | 134 | 45 | 7 | 0 | 82 |
| `skills/architecture-migration/SKILL.md` | 105 | 29 | 5 | 0 | 71 |
| `skills/change-management/SKILL.md` | 47 | 23 | 0 | 0 | 24 |
| `skills/code-review/SKILL.md` | 99 | 40 | 2 | 0 | 57 |
| `skills/codebase-analysis/SKILL.md` | 215 | 67 | 7 | 0 | 141 |
| `skills/context-engineering/SKILL.md` | 145 | 56 | 16 | 0 | 73 |
| `skills/coordination/SKILL.md` | 225 | 97 | 24 | 0 | 104 |
| `skills/design-patterns/SKILL.md` | 43 | 7 | 0 | 0 | 36 |
| `skills/design-patterns/references/README.md` | 85 | 11 | 0 | 0 | 74 |
| `skills/design-patterns/references/api-patterns.md` | 118 | 17 | 9 | 0 | 92 |
| `skills/design-patterns/references/caching-patterns.md` | 131 | 79 | 1 | 0 | 51 |
| `skills/design-patterns/references/clean-architecture.md` | 130 | 45 | 6 | 1 | 78 |
| `skills/design-patterns/references/cqrs.md` | 141 | 63 | 1 | 1 | 76 |
| `skills/design-patterns/references/ddd-tactical-patterns.md` | 172 | 38 | 0 | 0 | 134 |
| `skills/design-patterns/references/event-driven-architecture.md` | 120 | 30 | 2 | 0 | 88 |
| `skills/design-patterns/references/event-sourcing.md` | 131 | 36 | 2 | 0 | 93 |
| `skills/design-patterns/references/hexagonal-architecture.md` | 152 | 27 | 1 | 2 | 122 |
| `skills/design-patterns/references/layered-architecture.md` | 101 | 22 | 0 | 0 | 79 |
| `skills/design-patterns/references/microservices.md` | 104 | 30 | 1 | 0 | 73 |
| `skills/design-patterns/references/modular-monolith.md` | 76 | 25 | 0 | 0 | 51 |
| `skills/design-patterns/references/multi-tenant-architecture.md` | 136 | 51 | 4 | 1 | 80 |
| `skills/design-patterns/references/pipeline-batch-architecture.md` | 120 | 51 | 0 | 0 | 69 |
| `skills/design-patterns/references/reliability-patterns.md` | 159 | 39 | 5 | 4 | 111 |
| `skills/design-patterns/references/repository-pattern.md` | 143 | 77 | 1 | 2 | 63 |
| `skills/design-patterns/references/resilience-patterns.md` | 167 | 33 | 1 | 0 | 133 |
| `skills/design-patterns/references/serverless-architecture.md` | 90 | 30 | 2 | 0 | 58 |
| `skills/design-patterns/references/strangler-fig.md` | 147 | 41 | 4 | 0 | 102 |
| `skills/design-patterns/references/vertical-slice-architecture.md` | 87 | 42 | 1 | 0 | 44 |
| `skills/devops-delivery/SKILL.md` | 39 | 21 | 0 | 0 | 18 |
| `skills/e2e-test-architecture/SKILL.md` | 48 | 25 | 0 | 0 | 23 |
| `skills/enterprise-spec/SKILL.md` | 347 | 104 | 3 | 0 | 240 |
| `skills/evaluation/eval-rubrics.md` | 107 | 23 | 4 | 0 | 80 |
| `skills/frontend-accessibility/SKILL.md` | 47 | 12 | 0 | 0 | 35 |
| `skills/frontend-react-orcbash/SKILL.md` | 359 | 85 | 1 | 22 | 251 |
| `skills/frontend-react-orcbash/references/feature-slice-drop-in-template.md` | 78 | 16 | 1 | 0 | 61 |
| `skills/frontend-react-orcbash/references/post-feature-example.md` | 312 | 77 | 0 | 29 | 206 |
| `skills/frontend-react-orcbash/references/typedoc-return-types-example.md` | 175 | 39 | 0 | 16 | 120 |
| `skills/infrastructure-as-code/SKILL.md` | 37 | 14 | 1 | 0 | 22 |
| `skills/memory-systems/SKILL.md` | 70 | 27 | 7 | 0 | 36 |
| `skills/observability-implementation/SKILL.md` | 35 | 18 | 0 | 0 | 17 |
| `skills/performance-engineering/SKILL.md` | 36 | 14 | 0 | 0 | 22 |
| `skills/postgresql/SKILL.md` | 370 | 139 | 3 | 5 | 223 |
| `skills/rag-ai-integration/SKILL.md` | 49 | 16 | 7 | 0 | 26 |
| `skills/refactor-patterns/SKILL.md` | 86 | 34 | 6 | 0 | 46 |
| `skills/security-review/SKILL.md` | 121 | 40 | 0 | 0 | 81 |
| `skills/spec-writing/SKILL.md` | 200 | 69 | 1 | 0 | 130 |
| `skills/sql-data-modeling/SKILL.md` | 218 | 105 | 4 | 1 | 108 |
| `skills/supabase/SKILL.md` | 443 | 140 | 2 | 0 | 301 |
| `skills/swarm-consensus/SKILL.md` | 149 | 48 | 5 | 0 | 96 |
| `skills/system-blueprint/SKILL.md` | 72 | 32 | 7 | 0 | 33 |
| `skills/test-design/SKILL.md` | 212 | 76 | 2 | 0 | 134 |
| `skills/testable-design-patterns/SKILL.md` | 90 | 28 | 3 | 0 | 59 |
| `skills/testable-design-patterns/references/function-signature-patterns.md` | 47 | 4 | 1 | 1 | 41 |
| `skills/testable-design-patterns/references/testability-patterns-example.md` | 76 | 10 | 2 | 1 | 63 |
| `skills/tool-design/SKILL.md` | 138 | 52 | 3 | 0 | 83 |
| `skills/vercel-composition-patterns/AGENTS.md` | 752 | 69 | 24 | 33 | 626 |
| `skills/vercel-composition-patterns/README.md` | 44 | 3 | 4 | 10 | 27 |
| `skills/vercel-composition-patterns/SKILL.md` | 65 | 8 | 5 | 5 | 47 |
| `skills/vercel-composition-patterns/rules/_sections.md` | 19 | 1 | 2 | 2 | 14 |
| `skills/vercel-composition-patterns/rules/_template.md` | 17 | 0 | 0 | 2 | 15 |
| `skills/vercel-composition-patterns/rules/architecture-avoid-boolean-props.md` | 91 | 9 | 0 | 3 | 79 |
| `skills/vercel-composition-patterns/rules/architecture-compound-components.md` | 98 | 5 | 5 | 3 | 85 |
| `skills/vercel-composition-patterns/rules/patterns-children-over-render-props.md` | 75 | 5 | 0 | 1 | 69 |
| `skills/vercel-composition-patterns/rules/patterns-explicit-variants.md` | 84 | 10 | 0 | 2 | 72 |
| `skills/vercel-composition-patterns/rules/react19-no-forwardref.md` | 30 | 6 | 2 | 2 | 20 |
| `skills/vercel-composition-patterns/rules/state-context-interface.md` | 160 | 14 | 12 | 6 | 128 |
| `skills/vercel-composition-patterns/rules/state-decouple-implementation.md` | 97 | 9 | 3 | 5 | 80 |
| `skills/vercel-composition-patterns/rules/state-lift-state.md` | 107 | 9 | 1 | 7 | 90 |
| `skills/vercel-react-best-practices/AGENTS.md` | 2144 | 476 | 13 | 172 | 1483 |
| `skills/vercel-react-best-practices/README.md` | 91 | 15 | 0 | 14 | 62 |
| `skills/vercel-react-best-practices/SKILL.md` | 107 | 33 | 1 | 5 | 68 |
| `skills/vercel-react-best-practices/rules/_sections.md` | 28 | 0 | 0 | 2 | 26 |
| `skills/vercel-react-best-practices/rules/_template.md` | 20 | 1 | 0 | 3 | 16 |
| `skills/vercel-react-best-practices/rules/advanced-event-handler-refs.md` | 43 | 10 | 0 | 3 | 30 |
| `skills/vercel-react-best-practices/rules/advanced-init-once.md` | 32 | 7 | 0 | 0 | 25 |
| `skills/vercel-react-best-practices/rules/advanced-use-latest.md` | 30 | 13 | 0 | 4 | 13 |
| `skills/vercel-react-best-practices/rules/async-api-routes.md` | 31 | 7 | 0 | 5 | 19 |
| `skills/vercel-react-best-practices/rules/async-defer-await.md` | 60 | 7 | 0 | 12 | 41 |
| `skills/vercel-react-best-practices/rules/async-dependencies.md` | 39 | 13 | 0 | 1 | 25 |
| `skills/vercel-react-best-practices/rules/async-parallel.md` | 22 | 3 | 0 | 1 | 18 |
| `skills/vercel-react-best-practices/rules/async-suspense-boundaries.md` | 80 | 4 | 0 | 0 | 76 |
| `skills/vercel-react-best-practices/rules/bundle-barrel-imports.md` | 43 | 7 | 0 | 2 | 34 |
| `skills/vercel-react-best-practices/rules/bundle-conditional.md` | 24 | 7 | 0 | 0 | 17 |
| `skills/vercel-react-best-practices/rules/bundle-defer-third-party.md` | 40 | 3 | 0 | 2 | 35 |
| `skills/vercel-react-best-practices/rules/bundle-dynamic-imports.md` | 26 | 1 | 0 | 4 | 21 |
| `skills/vercel-react-best-practices/rules/bundle-preload.md` | 41 | 7 | 2 | 0 | 32 |
| `skills/vercel-react-best-practices/rules/client-event-listeners.md` | 62 | 14 | 0 | 8 | 40 |
| `skills/vercel-react-best-practices/rules/client-localstorage-schema.md` | 58 | 12 | 1 | 0 | 45 |
| `skills/vercel-react-best-practices/rules/client-passive-event-listeners.md` | 36 | 8 | 0 | 8 | 20 |
| `skills/vercel-react-best-practices/rules/client-swr-dedup.md` | 42 | 16 | 0 | 0 | 26 |
| `skills/vercel-react-best-practices/rules/js-batch-dom-css.md` | 91 | 18 | 1 | 11 | 61 |
| `skills/vercel-react-best-practices/rules/js-cache-function-results.md` | 63 | 3 | 0 | 5 | 55 |
| `skills/vercel-react-best-practices/rules/js-cache-property-access.md` | 22 | 2 | 0 | 0 | 20 |
| `skills/vercel-react-best-practices/rules/js-cache-storage.md` | 54 | 10 | 0 | 1 | 43 |
| `skills/vercel-react-best-practices/rules/js-combine-iterations.md` | 25 | 10 | 0 | 0 | 15 |
| `skills/vercel-react-best-practices/rules/js-early-exit.md` | 41 | 12 | 0 | 2 | 27 |
| `skills/vercel-react-best-practices/rules/js-hoist-regexp.md` | 35 | 2 | 0 | 4 | 29 |
| `skills/vercel-react-best-practices/rules/js-index-maps.md` | 29 | 5 | 0 | 2 | 22 |
| `skills/vercel-react-best-practices/rules/js-length-check-first.md` | 40 | 9 | 0 | 2 | 29 |
| `skills/vercel-react-best-practices/rules/js-min-max-loop.md` | 60 | 9 | 0 | 6 | 45 |
| `skills/vercel-react-best-practices/rules/js-set-map-lookups.md` | 18 | 8 | 0 | 0 | 10 |
| `skills/vercel-react-best-practices/rules/js-tosorted-immutable.md` | 44 | 15 | 1 | 4 | 24 |
| `skills/vercel-react-best-practices/rules/rendering-activity.md` | 20 | 3 | 0 | 0 | 17 |
| `skills/vercel-react-best-practices/rules/rendering-animate-svg-wrapper.md` | 40 | 1 | 0 | 2 | 37 |
| `skills/vercel-react-best-practices/rules/rendering-conditional-render.md` | 32 | 3 | 0 | 4 | 25 |
| `skills/vercel-react-best-practices/rules/rendering-content-visibility.md` | 31 | 2 | 0 | 0 | 29 |
| `skills/vercel-react-best-practices/rules/rendering-hoist-jsx.md` | 36 | 3 | 1 | 0 | 32 |
| `skills/vercel-react-best-practices/rules/rendering-hydration-no-flicker.md` | 67 | 10 | 0 | 3 | 54 |
| `skills/vercel-react-best-practices/rules/rendering-hydration-suppress-warning.md` | 24 | 1 | 0 | 0 | 23 |
| `skills/vercel-react-best-practices/rules/rendering-svg-precision.md` | 20 | 1 | 0 | 0 | 19 |
| `skills/vercel-react-best-practices/rules/rendering-usetransition-loading.md` | 60 | 19 | 1 | 8 | 32 |
| `skills/vercel-react-best-practices/rules/rerender-defer-reads.md` | 30 | 5 | 0 | 4 | 21 |
| `skills/vercel-react-best-practices/rules/rerender-dependencies.md` | 36 | 15 | 0 | 0 | 21 |
| `skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md` | 30 | 4 | 0 | 5 | 21 |
| `skills/vercel-react-best-practices/rules/rerender-derived-state.md` | 23 | 2 | 0 | 2 | 19 |
| `skills/vercel-react-best-practices/rules/rerender-functional-setstate.md` | 54 | 24 | 2 | 8 | 20 |
| `skills/vercel-react-best-practices/rules/rerender-lazy-state-init.md` | 44 | 21 | 0 | 8 | 15 |
| `skills/vercel-react-best-practices/rules/rerender-memo-with-default-value.md` | 26 | 7 | 0 | 0 | 19 |
| `skills/vercel-react-best-practices/rules/rerender-memo.md` | 35 | 9 | 0 | 2 | 24 |
| `skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md` | 34 | 7 | 0 | 2 | 25 |
| `skills/vercel-react-best-practices/rules/rerender-simple-expression-in-memo.md` | 27 | 11 | 0 | 2 | 14 |
| `skills/vercel-react-best-practices/rules/rerender-transitions.md` | 33 | 8 | 0 | 6 | 19 |
| `skills/vercel-react-best-practices/rules/rerender-use-ref-transient-values.md` | 63 | 13 | 2 | 4 | 44 |
| `skills/vercel-react-best-practices/rules/server-after-nonblocking.md` | 54 | 16 | 1 | 8 | 29 |
| `skills/vercel-react-best-practices/rules/server-auth-actions.md` | 72 | 25 | 0 | 8 | 39 |
| `skills/vercel-react-best-practices/rules/server-cache-lru.md` | 29 | 8 | 0 | 0 | 21 |
| `skills/vercel-react-best-practices/rules/server-cache-react.md` | 55 | 23 | 1 | 0 | 31 |
| `skills/vercel-react-best-practices/rules/server-dedup-props.md` | 46 | 9 | 0 | 0 | 37 |
| `skills/vercel-react-best-practices/rules/server-parallel-fetching.md` | 69 | 0 | 0 | 6 | 63 |
| `skills/vercel-react-best-practices/rules/server-serialization.md` | 30 | 9 | 0 | 0 | 21 |
| `skills/vercel-react-native-skills/AGENTS.md` | 2119 | 363 | 33 | 146 | 1577 |
| `skills/vercel-react-native-skills/README.md` | 116 | 23 | 1 | 14 | 78 |
| `skills/vercel-react-native-skills/SKILL.md` | 90 | 19 | 1 | 5 | 65 |
| `skills/vercel-react-native-skills/rules/_sections.md` | 56 | 4 | 1 | 2 | 49 |
| `skills/vercel-react-native-skills/rules/_template.md` | 20 | 1 | 0 | 3 | 16 |
| `skills/vercel-react-native-skills/rules/animation-derived-value.md` | 39 | 17 | 0 | 0 | 22 |
| `skills/vercel-react-native-skills/rules/animation-gesture-detector-press.md` | 80 | 20 | 0 | 7 | 53 |
| `skills/vercel-react-native-skills/rules/animation-gpu-properties.md` | 50 | 1 | 0 | 10 | 39 |
| `skills/vercel-react-native-skills/rules/design-system-compound-components.md` | 52 | 5 | 0 | 2 | 45 |
| `skills/vercel-react-native-skills/rules/fonts-config-plugin.md` | 58 | 9 | 0 | 4 | 45 |
| `skills/vercel-react-native-skills/rules/imports-design-system-folder.md` | 55 | 1 | 0 | 1 | 53 |
| `skills/vercel-react-native-skills/rules/js-hoist-intl.md` | 49 | 2 | 2 | 2 | 43 |
| `skills/vercel-react-native-skills/rules/list-performance-callbacks.md` | 35 | 5 | 0 | 1 | 29 |
| `skills/vercel-react-native-skills/rules/list-performance-function-references.md` | 105 | 20 | 0 | 2 | 83 |
| `skills/vercel-react-native-skills/rules/list-performance-images.md` | 45 | 7 | 0 | 4 | 34 |
| `skills/vercel-react-native-skills/rules/list-performance-inline-objects.md` | 81 | 11 | 6 | 2 | 62 |
| `skills/vercel-react-native-skills/rules/list-performance-item-expensive.md` | 78 | 15 | 3 | 3 | 57 |
| `skills/vercel-react-native-skills/rules/list-performance-item-memo.md` | 63 | 20 | 0 | 0 | 43 |
| `skills/vercel-react-native-skills/rules/list-performance-item-types.md` | 91 | 6 | 1 | 1 | 83 |
| `skills/vercel-react-native-skills/rules/list-performance-virtualize.md` | 56 | 4 | 0 | 7 | 45 |
| `skills/vercel-react-native-skills/rules/monorepo-native-deps-in-app.md` | 37 | 4 | 0 | 3 | 30 |
| `skills/vercel-react-native-skills/rules/monorepo-single-dependency-versions.md` | 52 | 7 | 0 | 3 | 42 |
| `skills/vercel-react-native-skills/rules/navigation-native-navigators.md` | 149 | 33 | 2 | 4 | 110 |
| `skills/vercel-react-native-skills/rules/react-compiler-destructure-functions.md` | 37 | 6 | 0 | 4 | 27 |
| `skills/vercel-react-native-skills/rules/react-compiler-reanimated-shared-values.md` | 35 | 9 | 0 | 2 | 24 |
| `skills/vercel-react-native-skills/rules/react-state-dispatcher.md` | 68 | 21 | 0 | 15 | 32 |
| `skills/vercel-react-native-skills/rules/react-state-fallback.md` | 43 | 16 | 0 | 6 | 21 |
| `skills/vercel-react-native-skills/rules/react-state-minimize.md` | 51 | 7 | 0 | 7 | 37 |
| `skills/vercel-react-native-skills/rules/rendering-no-falsy-and.md` | 61 | 4 | 0 | 4 | 53 |
| `skills/vercel-react-native-skills/rules/rendering-text-in-text-component.md` | 28 | 3 | 0 | 3 | 22 |
| `skills/vercel-react-native-skills/rules/scroll-position-no-state.md` | 65 | 17 | 0 | 5 | 43 |
| `skills/vercel-react-native-skills/rules/state-ground-truth.md` | 62 | 14 | 2 | 4 | 42 |
| `skills/vercel-react-native-skills/rules/ui-expo-image.md` | 50 | 4 | 0 | 4 | 42 |
| `skills/vercel-react-native-skills/rules/ui-image-gallery.md` | 87 | 6 | 0 | 10 | 71 |
| `skills/vercel-react-native-skills/rules/ui-measure-views.md` | 62 | 15 | 0 | 15 | 32 |
| `skills/vercel-react-native-skills/rules/ui-menus.md` | 145 | 17 | 15 | 3 | 110 |
| `skills/vercel-react-native-skills/rules/ui-native-modals.md` | 64 | 7 | 0 | 0 | 57 |
| `skills/vercel-react-native-skills/rules/ui-pressable.md` | 48 | 5 | 0 | 3 | 40 |
| `skills/vercel-react-native-skills/rules/ui-safe-area-scroll.md` | 52 | 8 | 0 | 2 | 42 |
| `skills/vercel-react-native-skills/rules/ui-scrollview-content-inset.md` | 38 | 15 | 0 | 2 | 21 |
| `skills/vercel-react-native-skills/rules/ui-styling.md` | 67 | 9 | 1 | 0 | 57 |
| `skills/vercel-web-design-guidelines/SKILL.md` | 28 | 12 | 0 | 0 | 16 |
| `skills/vibe-coding/SKILL.md` | 25 | 12 | 1 | 0 | 12 |
| `workflows/conventions.md` | 66 | 24 | 1 | 0 | 41 |
| `workflows/job-lifecycle.md` | 75 | 38 | 1 | 0 | 36 |
| `workflows/multi-agent-pipeline.md` | 313 | 126 | 12 | 4 | 171 |
| `workflows/recovery-playbook.md` | 68 | 41 | 1 | 0 | 26 |
| `workflows/state-validator-checklist.md` | 62 | 30 | 2 | 0 | 30 |

## Deletion/Move Candidate List
| Action | File | Reason |
|---|---|---|
| DEDUP_REQUIRED | `skills/frontend-react-orcbash/SKILL.md` | duplicate lines=22 |
| DEDUP_REQUIRED | `skills/frontend-react-orcbash/references/post-feature-example.md` | duplicate lines=29 |
| DEDUP_REQUIRED | `skills/vercel-composition-patterns/AGENTS.md` | duplicate lines=33 |
| DEDUP_REQUIRED | `skills/vercel-react-best-practices/AGENTS.md` | duplicate lines=172 |
| DEDUP_REQUIRED | `skills/vercel-react-native-skills/AGENTS.md` | duplicate lines=146 |

## Duplicate Hotspots (Top 25 Normalized Lines)
| Normalized Line | File Count |
|---|---:|
| <aidevshoproot/skills/swarm-consensus/skill.md — multi-model swarm consensus (opt-in only via coordinator) | 15 |
| const animatedstyle = useanimatedstyle(() = ({ | 14 |
| const [query, setquery] = usestate('') | 12 |
| const onlayout = (e: layoutchangeevent) = { | 12 |
| const [size, setsize] = usestate<size undefined(undefined) | 10 |
| const [state, setstate] = usestate(initialstate) | 10 |
| const { width, height } = e.nativeevent.layout | 10 |
| "react-native-reanimated": "3.16.1" | 8 |
| function feed({ items }: { items: item[] }) { | 8 |
| function profile({ name, count }: { name: string; count: number }) { | 8 |
| function userlist({ users }: { users: user[] }) { | 8 |
| import type { post } from '../types/post'; | 8 |
| <image source={{ uri: url }} style={styles.thumbnail} / | 6 |
| const [scrolly, setscrolly] = usestate(0) | 6 |
| const forwardmessage = useforwardmessage() | 6 |
| const items = await fetchsidebaritems() | 6 |
| const theme = usecontext(themecontext) | 6 |
| const { state, update, submit } = useglobalchannel(channelid) | 6 |
| function avatar({ url }: { url: string }) { | 6 |
| function themewrapper({ children }: { children: reactnode }) { | 6 |
| function updateelementstyles(element: htmlelement) { | 6 |
| import animated, { useanimatedstyle, withtiming } from 'react-native-reanimated' | 6 |
| import as dropdownmenu from 'zeego/dropdown-menu' | 6 |
| return <nav{items.map(renderitem)}</nav | 6 |
| formatpost: ({ post }: { post: post }) = formattedpost; | 5 |

## Recommended Next Step
- Run manual validation on top candidate files to convert this baseline into final EXECUTE/RATIONALE split actions before SMF.3/SMF.4.

## Line-Level Tags Artifact
- Path: `harness-engineering/archive/reports/context-refactor/line-tags.tsv`
- Columns: `file`, `line_number`, `class`, `line_text`
- Rows: 20554
