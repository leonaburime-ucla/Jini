# Craft references

Brand-agnostic craft knowledge. Each file is a small, dense rulebook on one
dimension of professional UI craft (typography, color, motion, …). Skills
opt into the references they need; a daemon or runtime can inject only the
requested ones into the system prompt above the active skill body.

## Why a third axis next to `skills/` and `design-systems/`

| Axis | Scope | Example |
|---|---|---|
| `skills/` | Artifact shape | `saas-landing`, `dashboard`, `pricing-page` |
| `design-systems/` | Brand visual language (the 9-section `DESIGN.md`) | `linear-app`, `apple`, `notion` |
| `craft/` | **Universal** craft knowledge — true regardless of brand | letter-spacing rules, accent-overuse caps, anti-AI-slop |

`DESIGN.md` tells the agent which colors and fonts a brand uses. `craft/`
tells the agent the universal rules a competent designer applies on top —
e.g. ALL CAPS always needs ≥0.06em tracking, regardless of the brand.

## How a skill opts in

Add a `craft.requires` array to the skill's front-matter. Only the
listed sections are injected, so a skill that needs only typography pays
no token cost for color/motion content.

```yaml
craft:
  requires: [typography, color, anti-ai-slop]
```

Use the layered stack for editorial skills that require authored hierarchy
and sustained reading behavior:

```yaml
craft:
  requires: [typography, typography-hierarchy, typography-hierarchy-editorial]
```

Allowed values match the file names in this directory minus the `.md`
extension. Unknown values are silently ignored (forward-compatible).

If a repo wires a lint step for this (e.g. a `lint:craft` script), it should
report unresolved slugs with their manifest paths so typos cannot silently
drop a craft section from the runtime prompt. If a slug is an intentional
forward reference, list it in `craft/FUTURE_SECTIONS.md` until the matching
`craft/<slug>.md` file ships.

### Why silent fallback instead of fail-fast?

A skeptical reader will ask: "If a skill requests a planned-but-not-yet-vendored
section and the corresponding file doesn't exist yet, shouldn't we warn
the user?" We chose forward-compatibility over fail-fast: a skill
authored today can list a planned slug and start benefiting the moment
the matching `craft/<slug>.md` is vendored in a follow-up PR, with no
skill edit needed. The cost of a missed reference is a missing
paragraph in the system prompt, not a broken skill — so the loud
failure mode is not worth the friction.

Note for skill authors arriving from older guidance: an earlier draft
used `motion` as the future-slug placeholder. The shipped equivalent
today is `animation-discipline`. Use that one if your skill emits
motion.

### Enforcement levels

Craft files mix auto-checked rules and guidance.

- **Auto-checked.** Rules a project's own artifact linter can wire up —
  e.g. the P0 list in `anti-ai-slop.md` (Tailwind-indigo accent,
  two-stop hero gradients, emoji-as-icons, etc.). A linter can report
  these as findings back to the UI (for P0/P1 badges) and to the agent
  (as a system reminder for self-correction). This package ships no
  linter itself — it's the reference content a host runtime's linter
  would check against.
- **Guidance.** The rest. The agent reads the rules, reviewers apply them,
  no linter checks them.

A purely behavioral craft file (state-coverage, animation-discipline) is
guidance unless a specific rule is later promoted into an enforced linter
rule.

## Files

| File | Section name | When to require |
|---|---|---|
| `typography.md` | `typography` | Any skill that emits typed content (~all skills) |
| `typography-hierarchy.md` | `typography-hierarchy` | Any skill that emits typed content where hierarchy must feel authored, not assembled — especially surfaces with a strong entry point, varied levels, or intentional rhythm. Compose with `typography`. |
| `typography-hierarchy-editorial.md` | `typography-hierarchy-editorial` | Skills whose primary artifact is a sustained reading surface: `blog-post`, `docs-page`, `digital-eguide`. Requires `typography` + `typography-hierarchy`. |
| `color.md` | `color` | Any skill that emits styled output (~all skills) |
| `anti-ai-slop.md` | `anti-ai-slop` | Marketing pages, landing pages, decks |
| `state-coverage.md` | `state-coverage` | Any skill with stateful UI (dashboards, mobile apps, forms, list/table views) |
| `animation-discipline.md` | `animation-discipline` | Any skill that ships motion: mobile apps, multi-screen flows, gamified UI, transitions, microinteractions |
| `accessibility-baseline.md` | `accessibility-baseline` | Any skill that ships interactive UI: dashboards, forms, mobile flows, anything with focus/labels/keyboard paths |
| `rtl-and-bidi.md` | `rtl-and-bidi` | Any skill that ships localized text or layout: blogs, docs, financial tables, mobile apps, anything that may render Arabic / Hebrew / Persian |
| `form-validation.md` | `form-validation` | Any skill whose primary artifact contains an interactive form: lead capture, sign-in, signup, settings, multi-step intake |
| `laws-of-ux.md` | `laws-of-ux` | Any skill whose composition decisions hit named cognitive limits: pricing pages (Hick's, Choice Overload, Von Restorff), dashboards (Pareto, Selective Attention, Working Memory), onboarding (Goal-Gradient, Zeigarnik, Peak-End), modals (Fitts's, Tesler's). Sibling axis to the rendering-rule files above — covers what to compose, not how to render. |

**Partial-stateful skills.** A skill that's mostly static but contains an
embedded form, data table, or query surface should opt in. State-coverage
rules apply to the stateful component, not the whole page.

More sections (`icons`, `craft-details`) may be added in follow-up work
as a host project wires the linter side.

## Attribution

Craft content is adapted from the MIT-licensed
[refero_skill](https://github.com/referodesign/refero_skill) project
(© Refero Design), generalized off a specific product's house style and
linked to generic design tokens (`var(--accent)` etc.) instead.
