# `@jini/agent-runtime` — provenance

## craft/ (2026-07-17)

Source: `integrations/open-design/reference/craft-original/` (13 markdown
UX-craft docs). Per root `AGENTS.md` boundary: zero product-identity
strings ported. Verdict legend — **GENERIC**: ported verbatim.
**MIXED**: ported with literal `Open Design` / `OD` references stripped,
principle kept. **OD-SPECIFIC**: excluded.

| File | Verdict | Target / exclusion reason |
|---|---|---|
| `FUTURE_SECTIONS.md` | GENERIC | `src/craft/FUTURE_SECTIONS.md` — verbatim, no product-identity strings |
| `README.md` | MIXED | `src/craft/README.md` — stripped `od.craft.requires` → `craft.requires`, "Open Design's house style" / "OD's design tokens" attribution phrasing, and the hardcoded `apps/daemon/src/lint-artifact.ts` path (generalized to "a project's own artifact linter") |
| `accessibility-baseline.md` | GENERIC | `src/craft/accessibility-baseline.md` — verbatim |
| `animation-discipline.md` | GENERIC | `src/craft/animation-discipline.md` — verbatim |
| `anti-ai-slop.md` | MIXED | `src/craft/anti-ai-slop.md` — stripped "Open Design's lint surface" attribution line and the `apps/daemon/src/lint-artifact.ts` reference; P0/P1/P2 rule content unchanged |
| `color.md` | MIXED | `src/craft/color.md` — stripped "Open Design's standard tokens" attribution phrasing; token names (`--bg`, `--accent`, etc.) unchanged as they're generic, not product-branded |
| `form-validation.md` | GENERIC | `src/craft/form-validation.md` — verbatim |
| `laws-of-ux.md` | GENERIC | `src/craft/laws-of-ux.md` — verbatim |
| `rtl-and-bidi.md` | GENERIC | `src/craft/rtl-and-bidi.md` — verbatim |
| `state-coverage.md` | GENERIC | `src/craft/state-coverage.md` — verbatim |
| `typography-hierarchy-editorial.md` | GENERIC | `src/craft/typography-hierarchy-editorial.md` — verbatim |
| `typography-hierarchy.md` | GENERIC | `src/craft/typography-hierarchy.md` — verbatim |
| `typography.md` | MIXED | `src/craft/typography.md` — stripped "Open Design's token system" attribution phrasing |

None of the 13 files were pure OD-SPECIFIC (no exclusions this pass) — the
craft docs are, by design, a "universal craft knowledge" layer that sits
below any one product's `DESIGN.md`, so product-identity leakage was
limited to attribution-comment phrasing and one hardcoded implementation
path, not substantive rule content.

## skills/ (2026-07-17)

Source: `integrations/open-design/reference/skills-original/` (162 self-contained
Skill packages; the directory's own `AGENTS.md`/`README.md` are OD daemon-plumbing
docs about the skills registry itself, not skills, and were not ported). Per root
`AGENTS.md` boundary: zero product-identity strings ported. 160 of 162 ported
(18 GENERIC verbatim, 142 MIXED with OD framing stripped); 2 excluded as
OD-SPECIFIC. No TypeScript agent-runtime registry/execution code was added —
per the extraction-plan task scope, that's separate future work.

**Stripping method (applied uniformly across all 160 ported directories):**
a script dedented each SKILL.md's top-level `od:` YAML frontmatter mapping by
one indent level (removing the `od:` line, promoting its children — `mode`,
`craft.requires`, `design_system.requires`, `preview`, etc. — to top-level
keys), matching the same `craft.requires` convention established in
`src/craft/README.md`. It also flattened any bare `od.foo.bar:` dotted-key
frontmatter lines the same way, and ran a global text substitution for the
handful of literal-string categories the classification passes surfaced:
literal "Open Design" → "the host platform", `repo-assets.open-design.ai` →
`example.com/assets`, `@open-design/*` package specifiers →
`@example-host/*`, and OD daemon-CLI env vars (`$OD_BIN`, `$OD_NODE_BIN`,
`$OD_PROJECT_ID`, `OD_TOOL_TOKEN`, `OD_PLAYWRIGHT_PATH`) → generic
equivalents. All 160 ported SKILL.md files were re-validated as parseable
YAML frontmatter with no leftover top-level `od` key afterward. Per-skill
exceptions beyond this default pass are called out in the notes column below.

| Skill | Verdict | Target / exclusion reason |
|---|---|---|
| `8-bit-orbit-video-template` | MIXED | `src/skills/8-bit-orbit-video-template/` — `od:` frontmatter dedented; `repo-assets.open-design.ai` asset URL genericized |
| `ad-creative` | MIXED | `src/skills/ad-creative/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `after-hours-editorial-template` | MIXED | `src/skills/after-hours-editorial-template/` — `od:` frontmatter dedented; checklist.md's `od.mode`/`od.scenario`/`od.outputs.primary` prose keys de-prefixed to match |
| `agent-browser` | MIXED | `src/skills/agent-browser/` — `od:` frontmatter dedented; literal "Open Design" mentions (preview UI, smoke-test title) genericized to "the host platform" |
| `ai-music-album` | MIXED | `src/skills/ai-music-album/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `algorithmic-art` | MIXED | `src/skills/algorithmic-art/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `apple-hig` | MIXED | `src/skills/apple-hig/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `article-magazine` | GENERIC | `src/skills/article-magazine/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `artifacts-builder` | MIXED | `src/skills/artifacts-builder/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `brainstorming` | MIXED | `src/skills/brainstorming/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `brand-extract` | OD-SPECIFIC | excluded — entire workflow is OD's own `od brand preview/finalize` daemon CLI + `brand.json`/`brand.html` rendering pipeline, not a portable technique |
| `brand-guidelines` | MIXED | `src/skills/brand-guidelines/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `brandkit` | GENERIC | `src/skills/brandkit/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `brutalist-skill` | GENERIC | `src/skills/brutalist-skill/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `canvas-design` | MIXED | `src/skills/canvas-design/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `card-twitter` | GENERIC | `src/skills/card-twitter/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `card-xiaohongshu` | GENERIC | `src/skills/card-xiaohongshu/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `chat-motion-overlay` | GENERIC | `src/skills/chat-motion-overlay/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `color-expert` | MIXED | `src/skills/color-expert/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `competitive-ads-extractor` | MIXED | `src/skills/competitive-ads-extractor/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `copywriting` | MIXED | `src/skills/copywriting/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `creative-director` | MIXED | `src/skills/creative-director/` — `od:` frontmatter dedented; "Open Design orchestration mode" section (search every skill/plugin/MCP/connector) genericized, SCAMPER/TRIZ methodology unchanged |
| `d3-visualization` | MIXED | `src/skills/d3-visualization/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `data-report` | MIXED | `src/skills/data-report/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `deck-guizang-editorial` | MIXED | `src/skills/deck-guizang-editorial/` — `od:` frontmatter dedented; example.html placeholder byline "BY Open Design · 2026" renamed to "BY Sample Studio · 2026" |
| `deck-open-slide-canvas` | MIXED | `src/skills/deck-open-slide-canvas/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `deck-swiss-international` | MIXED | `src/skills/deck-swiss-international/` — `od:` frontmatter dedented; example.html/example.md placeholder title "Open Design 2026" renamed to "Sample Studio 2026" |
| `design-brief` | MIXED | `src/skills/design-brief/` — `od:` frontmatter dedented; "71 design systems bundled with Open Design" and "Open Design's 9-section convention" genericized to "the host platform" |
| `design-consultation` | MIXED | `src/skills/design-consultation/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `design-md` | MIXED | `src/skills/design-md/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `design-review` | MIXED | `src/skills/design-review/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `digits-fintech-swiss-template` | MIXED | `src/skills/digits-fintech-swiss-template/` — `od:` frontmatter dedented; checklist.md's `od.mode`/`od.scenario` prose keys de-prefixed |
| `doc` | MIXED | `src/skills/doc/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `doc-kami-parchment` | MIXED | `src/skills/doc-kami-parchment/` — `od:` frontmatter dedented; example.html placeholder titles "Open Design Studio №26"/"KAMI · Open Design" renamed to "Sample Studio" |
| `docx` | MIXED | `src/skills/docx/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `domain-name-brainstormer` | MIXED | `src/skills/domain-name-brainstormer/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `ecommerce-image-workflow` | MIXED | `src/skills/ecommerce-image-workflow/` — `od:` frontmatter dedented; "unified Open Design media dispatcher" + `$OD_BIN`/`$OD_NODE_BIN`/`$OD_PROJECT_ID` env vars genericized to `$AGENT_BIN`/`$AGENT_NODE_BIN`/`$AGENT_PROJECT_ID` |
| `editorial-burgundy-principles-template` | MIXED | `src/skills/editorial-burgundy-principles-template/` — `od:` frontmatter dedented; checklist.md's `od.mode`/`od.scenario` prose keys de-prefixed |
| `emil-design-eng` | MIXED | `src/skills/emil-design-eng/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `emilkowalski-motion` | MIXED | `src/skills/emilkowalski-motion/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `enhance-prompt` | MIXED | `src/skills/enhance-prompt/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `export-download-debugging` | MIXED | `src/skills/export-download-debugging/` — `od:` frontmatter dedented; Validation section's `pnpm --filter @open-design/web typecheck` etc. genericized to `@example-host/web` |
| `fal-3d` | MIXED | `src/skills/fal-3d/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-generate` | MIXED | `src/skills/fal-generate/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-image-edit` | MIXED | `src/skills/fal-image-edit/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-kling-o3` | MIXED | `src/skills/fal-kling-o3/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-lip-sync` | MIXED | `src/skills/fal-lip-sync/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-realtime` | MIXED | `src/skills/fal-realtime/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-restore` | MIXED | `src/skills/fal-restore/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-train` | MIXED | `src/skills/fal-train/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-tryon` | MIXED | `src/skills/fal-tryon/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-upscale` | MIXED | `src/skills/fal-upscale/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-video-edit` | MIXED | `src/skills/fal-video-edit/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `fal-vision` | MIXED | `src/skills/fal-vision/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `faq-page` | MIXED | `src/skills/faq-page/` — `od:` frontmatter dedented; "active DESIGN.md (injected above)" mechanism reference kept (generic pattern, matches `craft/README.md`'s own convention), `data-od-id` output-contract attribute left as documented convention name (harmless, not a literal-string violation) |
| `field-notes-editorial-template` | MIXED | `src/skills/field-notes-editorial-template/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-code-connect-components` | MIXED | `src/skills/figma-code-connect-components/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-create-design-system-rules` | MIXED | `src/skills/figma-create-design-system-rules/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-create-new-file` | MIXED | `src/skills/figma-create-new-file/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-generate-design` | MIXED | `src/skills/figma-generate-design/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-generate-library` | MIXED | `src/skills/figma-generate-library/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-implement-design` | MIXED | `src/skills/figma-implement-design/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `figma-use` | MIXED | `src/skills/figma-use/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `flutter-animating-apps` | MIXED | `src/skills/flutter-animating-apps/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frame-data-chart-nyt` | MIXED | `src/skills/frame-data-chart-nyt/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frame-flowchart-sticky` | MIXED | `src/skills/frame-flowchart-sticky/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frame-glitch-title` | MIXED | `src/skills/frame-glitch-title/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frame-light-leak-cinema` | MIXED | `src/skills/frame-light-leak-cinema/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frame-liquid-bg-hero` | MIXED | `src/skills/frame-liquid-bg-hero/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frame-logo-outro` | GENERIC | `src/skills/frame-logo-outro/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `frame-macos-notification` | GENERIC | `src/skills/frame-macos-notification/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `frontend-design` | MIXED | `src/skills/frontend-design/` — `od:` frontmatter dedented; "## Open Design Integration" section (active-design-system/craft injection) genericized |
| `frontend-dev` | MIXED | `src/skills/frontend-dev/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frontend-skill` | MIXED | `src/skills/frontend-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `frontend-slides` | MIXED | `src/skills/frontend-slides/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `full-page-screenshot` | MIXED | `src/skills/full-page-screenshot/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `gif-sticker-maker` | MIXED | `src/skills/gif-sticker-maker/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `gpt-tasteskill` | GENERIC | `src/skills/gpt-tasteskill/` — had an `od:` frontmatter block despite GENERIC verdict (no OD-literal body text); dedented like the MIXED cases for consistency |
| `gsap-core` | GENERIC | `src/skills/gsap-core/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-frameworks` | GENERIC | `src/skills/gsap-frameworks/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-performance` | GENERIC | `src/skills/gsap-performance/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-plugins` | GENERIC | `src/skills/gsap-plugins/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-react` | GENERIC | `src/skills/gsap-react/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-scrolltrigger` | GENERIC | `src/skills/gsap-scrolltrigger/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-timeline` | GENERIC | `src/skills/gsap-timeline/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `gsap-utils` | GENERIC | `src/skills/gsap-utils/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `hand-drawn-diagrams` | MIXED | `src/skills/hand-drawn-diagrams/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `hatch-pet` | MIXED | `src/skills/hatch-pet/` — `od:` frontmatter dedented; SKILL.md/README.md "Open Design integration" blockquotes describing OD's own floating-pet-companion UI genericized (sprite-generation technique itself unchanged) |
| `html-ppt-retro-quarterly-review` | MIXED | `src/skills/html-ppt-retro-quarterly-review/` — `od:` frontmatter dedented; `<artifact>` output-tag convention and checklist.md `od.mode`/`od.scenario` prose keys de-prefixed |
| `image-enhancer` | MIXED | `src/skills/image-enhancer/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `image-to-code-skill` | MIXED | `src/skills/image-to-code-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `imagegen` | MIXED | `src/skills/imagegen/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `imagegen-frontend-mobile` | MIXED | `src/skills/imagegen-frontend-mobile/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `imagegen-frontend-web` | MIXED | `src/skills/imagegen-frontend-web/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `imagen` | MIXED | `src/skills/imagen/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `impeccable-design-polish` | MIXED | `src/skills/impeccable-design-polish/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `library-curator` | OD-SPECIFIC | excluded — entire capability is OD's own "OD Library"/"OD Clipper" asset system with hardcoded `/api/tools/library/search`/`/apply` routes and daemon-injected `OD_TOOL_TOKEN`, not a portable technique |
| `login-flow` | MIXED | `src/skills/login-flow/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `marketing-psychology` | MIXED | `src/skills/marketing-psychology/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `minimalist-skill` | MIXED | `src/skills/minimalist-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `minimax-docx` | MIXED | `src/skills/minimax-docx/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `minimax-pdf` | MIXED | `src/skills/minimax-pdf/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `mockup-device-3d` | MIXED | `src/skills/mockup-device-3d/` — `od:` frontmatter dedented; example.html placeholder brand text "Open Design — 2026" renamed to "Sample Studio — 2026" |
| `nanobanana-ppt` | MIXED | `src/skills/nanobanana-ppt/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `output-skill` | MIXED | `src/skills/output-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `paywall-upgrade-cro` | MIXED | `src/skills/paywall-upgrade-cro/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `pdf` | MIXED | `src/skills/pdf/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `pixelbin-media` | MIXED | `src/skills/pixelbin-media/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `plan-design-review` | MIXED | `src/skills/plan-design-review/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `platform-design` | MIXED | `src/skills/platform-design/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `poster-hero` | MIXED | `src/skills/poster-hero/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `ppt-keynote` | MIXED | `src/skills/ppt-keynote/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `pptx` | MIXED | `src/skills/pptx/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `pptx-generator` | MIXED | `src/skills/pptx-generator/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `pptx-html-fidelity-audit` | MIXED | `src/skills/pptx-html-fidelity-audit/` — `od:` frontmatter dedented; `references/font-discipline.md`'s "most common pairing in Open Design today" genericized |
| `pr-feedback-quality-gate` | GENERIC | `src/skills/pr-feedback-quality-gate/` — verbatim (had only neutral/no `od:` frontmatter, no OD-literal strings in body) |
| `redesign-skill` | MIXED | `src/skills/redesign-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `reference-design-contract` | MIXED | `src/skills/reference-design-contract/` — `od:` frontmatter dedented; "following Open Design's standard nine-section design-system shape" (SKILL.md + checklist.md) genericized |
| `release-notes-one-pager` | MIXED | `src/skills/release-notes-one-pager/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `remotion` | MIXED | `src/skills/remotion/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `replicate` | MIXED | `src/skills/replicate/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `research-decision-room` | MIXED | `src/skills/research-decision-room/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `resume-modern` | MIXED | `src/skills/resume-modern/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `review-animations` | MIXED | `src/skills/review-animations/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `screenshot` | MIXED | `src/skills/screenshot/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `screenshots-marketing` | MIXED | `src/skills/screenshots-marketing/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `shadcn-ui` | MIXED | `src/skills/shadcn-ui/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `shader-dev` | MIXED | `src/skills/shader-dev/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `slack-gif-creator` | MIXED | `src/skills/slack-gif-creator/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `slides` | MIXED | `src/skills/slides/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `social-reddit-card` | MIXED | `src/skills/social-reddit-card/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `social-spotify-card` | MIXED | `src/skills/social-spotify-card/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `social-x-post-card` | MIXED | `src/skills/social-x-post-card/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `soft-skill` | MIXED | `src/skills/soft-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `sora` | MIXED | `src/skills/sora/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `speech` | MIXED | `src/skills/speech/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `stitch-loop` | MIXED | `src/skills/stitch-loop/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `stitch-skill` | MIXED | `src/skills/stitch-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `swiftui-design` | MIXED | `src/skills/swiftui-design/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `swiss-creative-mode-template` | MIXED | `src/skills/swiss-creative-mode-template/` — `od:` frontmatter dedented; `<artifact>` output contract kept as documented convention, checklist.md `od.*` prose keys de-prefixed |
| `swiss-user-research-video-template` | MIXED | `src/skills/swiss-user-research-video-template/` — `od:` frontmatter dedented; checklist.md `od.mode`/`od.scenario` prose keys de-prefixed |
| `taste-skill` | MIXED | `src/skills/taste-skill/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `taste-skill-v1` | MIXED | `src/skills/taste-skill-v1/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `theme-factory` | MIXED | `src/skills/theme-factory/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `threejs` | MIXED | `src/skills/threejs/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `ui-skills` | MIXED | `src/skills/ui-skills/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `ui-ux-pro-max` | MIXED | `src/skills/ui-ux-pro-max/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `venice-audio-music` | MIXED | `src/skills/venice-audio-music/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `venice-audio-speech` | MIXED | `src/skills/venice-audio-speech/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `venice-image-edit` | MIXED | `src/skills/venice-image-edit/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `venice-image-generate` | MIXED | `src/skills/venice-image-generate/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `venice-video` | MIXED | `src/skills/venice-video/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `vfx-text-cursor` | MIXED | `src/skills/vfx-text-cursor/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `video-downloader` | MIXED | `src/skills/video-downloader/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `video-hyperframes` | MIXED | `src/skills/video-hyperframes/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `web-artifacts-builder` | MIXED | `src/skills/web-artifacts-builder/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `web-clone` | MIXED | `src/skills/web-clone/` — `od:` frontmatter dedented; "在 Open Design 中" prose genericized; `scripts/od-preview-rewrite.mjs` (OD file-preview/export-zip specific) and `OD_PLAYWRIGHT_PATH` env var kept but renamed/genericized — the recon/audit/diff scripts (the actual cloning technique) are unchanged |
| `web-design-guidelines` | MIXED | `src/skills/web-design-guidelines/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `weread-year-in-review-video-template` | MIXED | `src/skills/weread-year-in-review-video-template/` — `od:` frontmatter dedented; `repo-assets.open-design.ai` asset URLs genericized |
| `wpds` | MIXED | `src/skills/wpds/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `writing-guidelines` | MIXED | `src/skills/writing-guidelines/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
| `youtube-clipper` | MIXED | `src/skills/youtube-clipper/` — `od:` frontmatter dedented to top-level keys (matches craft's `craft.requires` convention); no other changes needed |
