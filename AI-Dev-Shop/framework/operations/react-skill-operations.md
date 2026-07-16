# React Skill Operations

- Version: 1.2.0
- Last Updated: 2026-05-15
- Scope: React, Next.js, React Native, and Expo implementation, review, architecture, deployment, and QA work

This file operationalizes React skill usage across agents.

## 1) Skill Loading Enforcement (Preflight)

For any React/Next.js component task, load these by default:

- `skills/feature-slice-design/SKILL.md`
- `skills/vercel-react-best-practices/SKILL.md`
- `skills/vercel-composition-patterns/SKILL.md`

`skills/feature-slice-design/SKILL.md` is frontend application architecture. It is not the generic ports-and-adapters skill. For Python, backend TypeScript, Go, Java, workers, CLIs, or service code, use `skills/hexagonal-architecture/SKILL.md` instead.

If UI audit/review is requested, also load:

- `skills/vercel-web-design-guidelines/SKILL.md`
- `skills/frontend-accessibility/SKILL.md`

For React Native/Expo scope, load this first:

- `skills/expo-react-native/SKILL.md`

Then load only the Expo subskill(s) named by that router. For React Native
component, rendering, animation, navigation, image, or list-performance work,
also load:

- `skills/vercel-react-native-skills/SKILL.md`

Do not load React/Next.js web skills merely because React Native uses React.
Load `feature-slice-design`, `vercel-react-best-practices`, or
`vercel-composition-patterns` for React Native only when the project also has a
web/Next.js surface in the current task.

Do not load any React-specific skills from this file for non-React tasks (Python, backend TypeScript APIs, Go, Java, database-only work, or infrastructure-only work).

## 2) Precedence Matrix (When Guidance Differs)

Apply this priority order:

1. Spec acceptance criteria and explicit user constraints
2. Security and data-classification rules
3. Accessibility requirements
4. Architecture boundaries (FSD for frontend applications, Expo Router/EAS/native boundaries for Expo, generic hexagonal/ADR constraints elsewhere)
5. Official Expo skills for Expo platform behavior, SDK migration, EAS, and Expo APIs
6. Performance and rendering tactics (Vercel best-practices for web React, Vercel React Native rules for React Native)
7. Style/readability preferences

If two items conflict at the same level, use `harness-engineering/skills-inbox/skill-conflict-resolution.md`.

## 3) Source Pin and Update Process

Imported source of truth:

- Repository: `https://github.com/vercel-labs/agent-skills`
- Imported commit: `e23951b`
- Imported folders:
  - `react-best-practices`
  - `composition-patterns`
  - `react-native-skills`
  - `web-design-guidelines`

Official Expo source of truth:

- Repository: `https://github.com/expo/skills`
- Imported commit: `47f0ef64821f10e42a600758b5087bfe89c09474`
- Imported plugin folder: `plugins/expo`
- Local vendored path: `skills/expo/`

Refresh process:

**For Vercel skills:**

1. Pull latest into a local mirror of `vercel-labs/agent-skills`
2. Review upstream diff of `skills/*/rules`
3. Copy changes into local `skills/vercel-*` folders

**For Expo skills:**

1. Pull latest commit from `expo/skills`
2. Replace local `skills/expo/` with upstream `plugins/expo/`

**For all updates:**

1. Update `framework/routing/skills-registry.md` only if folder names or ownership changed
2. Record new commit hash and date in this file

## 4) Evaluation Loop (Benchmark Set)

Use these benchmark prompts to validate skill adherence:

1. Build a Next.js page that fetches three independent resources and streams UI without waterfalls.
2. Refactor a component with six boolean props into compound/explicit variant components.
3. Optimize a list-heavy React view with avoidable re-renders and unstable callbacks.
4. Perform UI audit for accessibility and design findings on a provided component file.
5. Convert a sequential data-fetching path to parallelized, cache-aware server-side fetching.
6. Build an Expo Router settings screen with native-feeling controls and server data.
7. Configure an EAS workflow for PR preview builds and validate it against the official schema.
8. Upgrade an Expo project across an SDK boundary and replace one deprecated package.

For each benchmark, score:

- Correct skill selection
- Rule citation quality
- Architecture boundary adherence
- Performance outcome quality
- Regression risk

## 5) Quick User Shortcut

Use this one-liner to force deterministic skill loading:

`React strict mode: apply feature-slice-design + vercel-react-best-practices + vercel-composition-patterns, and cite the exact rules used.`

`Expo strict mode: apply expo-react-native, load only the matching official Expo subskill(s), add vercel-react-native-skills for React Native rendering/performance, and cite the exact skill/rules used.`

## 6) React Effect Debugging (Pointer)

For React-only implementation details on dependency-driven `useEffect` debugging expectations, follow:

- `skills/feature-slice-design/SKILL.md` (Dependency Rules + Enforcement)
