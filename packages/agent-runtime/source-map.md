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

## runtimes/ → agent-runtime TypeScript source (2026-07-17)

Origin: fork `leonaburime-ucla/open-design`, branch `refactor/runtimes-capability-barrel`,
commit `e984fa103c240b2a4fc84c5dc0b408bed241140c` (2026-07-17), cloned read-only to
`/tmp/od-source` for this task. This branch had already passed an independent
capability-barrel cleanup pass in a prior session (24/24 barrel-import checks, 79/79 guard
checks, 551/552 vitest runtime tests) — that result was trusted per the task brief, not
re-verified here. All content below was read directly from `apps/daemon/src/runtimes/**`
and the handful of top-level daemon files it reaches into (`role-marker-guard.ts`,
`copilot-stream.ts`, `acp.ts`, `pi-rpc.ts`) on that commit.

Per `docs/jini-port/extraction-plan.md` §8 task 7 and
`docs/jini-port/recon/r1b-daemon-design.md` §1 ("`@jini/agent-runtime` package spec"). This
section covers the new TypeScript-source content added under `src/*.ts` and `src/defs/*.ts`
alongside the (unrelated, untouched) `craft/`/`skills/` content documented above.

**Naming note vs. r1b:** r1b predates final package-naming lock-in and refers to
`@jini/persistence` and `@jini/daemon-core`; the actual locked/current names are
`@jini/sqlite` and `@jini/daemon` respectively. Neither is touched by this task — where
r1b's proposed shapes reference a persistence-backed `ArtifactStore`, only the
classification-only `ArtifactTaxonomy` half is defined here (see "Design decisions" below).

### Structural note: the barrel refactor changed the file layout

r1/r1b's file citations (`runtimes/types.ts`, `runtimes/registry.ts`, `runtimes/detection.ts`,
`runtimes/chat-prompt-inputs.ts`, `runtimes/run-artifacts.ts`, `runtimes/{claude,json-event,
qoder,plain}-stream.ts`) describe an earlier flat `runtimes/` layout. The
`refactor/runtimes-capability-barrel` branch this task ports from reorganized the same
content into `runtimes/{core,registry,defs,detection,launch,env,auth,amr,prompt,stream,runs}/`
subdirectories behind a single `runtimes/index.ts` barrel (67 files total, not 62 — the task
brief's file count predates the refactor). The table below cites the real paths on the ported
commit. Two note-worthy layout differences from what the brief anticipated:

- **No `plain-stream.ts` exists on this branch.** OD's `plain` `streamFormat` (used by
  `aider`, `antigravity`, `deepseek`, `qwen`) has no dedicated parser file — those adapters'
  stdout is treated as an opaque text blob by the daemon's own chat-run driver, not run
  through a structured event parser. Nothing was ported for it; there is no equivalent
  generic module to lift.
- **No `mocks/` replay-trace corpus was reachable.** `apps/daemon/tests/mocks-golden.test.ts`
  and `mocks/golden/*.events.json` (committed golden *output* fixtures) exist on this branch,
  but the corresponding *input* recordings (`mocks/recordings/*.jsonl`) are fetched from
  Cloudflare R2 via `mocks/scripts/fetch-recordings.sh` and were not reachable from this
  sandbox (no network path to that storage). `mocks/golden/*.events.json` WAS read and used as
  a shape reference when writing this package's own stream-parser tests, but those tests
  replay hand-built synthetic traces, not the real captured recordings — see each
  `*-stream.test.ts` file's header comment for the explicit caveat.

### File map

| Jini file | OD origin file(s) | Transform |
|---|---|---|
| `src/types.ts` | `runtimes/core/types.ts` (the `RuntimeAgentDef` contract) + `packages/contracts/src/api/registry.ts` (`AgentDiagnostic`/`AgentDiagnosticReason`/`AgentDiagnosticSeverity`/`AgentFixIntent`) | `RuntimeAgentDef`/`DetectedAgent`/etc. ported near-verbatim (comment wording genericized from "the daemon"/"OD" to "the caller"/"a host"). `AgentDiagnostic`/`AgentFixIntent` vendored inline (small, self-contained shapes) instead of depending on `@open-design/contracts` — `@jini/agent-runtime` has zero `@open-design/*` imports. |
| `src/paths.ts` | `runtimes/core/paths.ts` | Verbatim. `expandHomePath`/`expandConfiguredEnv`. |
| `src/models.ts` | `runtimes/core/models.ts` | Verbatim. `DEFAULT_MODEL_OPTION`, live-model cache, `resolveModelForAgent`, `sanitizeCustomModel`. |
| `src/capabilities.ts` | `runtimes/core/capabilities.ts` | Verbatim (3 lines). |
| `src/invocation.ts` | `runtimes/core/invocation.ts` | `createCommandInvocation` import swapped from OD's `@open-design/platform` to `@jini/platform` (same function, already lifted there per its own `source-map.md`). |
| `src/mmd-routes.ts` | `runtimes/core/mmd-routes.ts` | Verbatim. Local "model routes" file loader + merge — no OD coupling found. |
| `src/metadata.ts` | `runtimes/core/metadata.ts` | De-branded: `installMetaForAgent` now takes an injectable `table` parameter (default `DEFAULT_AGENT_INSTALL_LINKS`) instead of reading a module-private constant. Three entries in the origin table pointed at OD's own site/docs rather than the third-party CLI vendor: `amr.installUrl = 'https://open-design.ai/amr'` and the `docsUrl` fields for `amr`/`pi`/`hermes` that pointed at `https://github.com/nexu-io/open-design/blob/main/docs/...`. Those OD-self-referential URL fields are dropped from the default table; each of `pi`/`hermes` had a second, real third-party vendor `docsUrl` in the origin which is kept. Every other agent's real vendor install/docs link is unchanged. |
| `src/mcp.ts` | `runtimes/core/mcp.ts` | De-branded, and narrowed to the genuinely generic half. Origin `buildLiveArtifactsMcpServersForAgent` hardcoded a product-branded server name, a product-branded default `command`, and an args tail baked in — i.e. it injected exactly one product's own MCP feature. Renamed to `buildAcpMcpServersForAgent`; `name`/`command`/`args` are now fully caller-supplied with no product-branded default. Kept: the actual generic mechanism — gate on `mcpDiscovery === 'mature-acp'`, and shape the `env` field as an array (`[{name,value}]`) or a map (`{KEY:value}`) per `def.acpMcpEnvFormat`, since different ACP implementations expect different shapes there. |
| `src/executables.ts` | `runtimes/core/executables.ts` | De-branded + sandbox dependency dropped. `wellKnownUserToolchainBins` import swapped to `@jini/platform`. Origin read two product-prefixed env vars directly and called `resolveSandboxRuntimeConfigFromEnv` from OD's daemon-level `sandbox-mode.ts` (out of this package's charter). Replaced with `configureExecutableResolutionEnv({ agentHomeEnvVar, resourceRootEnvVar })` — an injectable pair of env-var names defaulting to `AGENT_RUNTIME_HOME` / `AGENT_RUNTIME_RESOURCE_ROOT` — and the sandbox-mode integration is simply not present (no equivalent kept; a host needing sandboxed detection-home scoping can still set the agent-home override env var, which achieves the same practical effect for detection purposes). |
| `src/role-marker-guard.ts` | top-level `apps/daemon/src/role-marker-guard.ts` (not under `runtimes/`, but consumed by `claude-stream.ts`) | Verbatim. Self-contained fabricated-role-marker (`## user`/`## assistant`) detector; no product coupling found. |
| `src/claude-stream.ts` | `runtimes/stream/claude-stream.ts` | Verbatim except the `role-marker-guard` import path (now same-package instead of two directories up), plus four coverage-driven dead-branch removals made 2026-07-18 — see "Coverage-driven refactors" below. |
| `src/json-event-stream.ts` | `runtimes/stream/json-event-stream.ts` | Verbatim. Zero imports in the origin. |
| `src/qoder-stream.ts` | `runtimes/stream/qoder-stream.ts` | Verbatim. Only import is `node:buffer`. |
| `src/copilot-stream.ts` | top-level `apps/daemon/src/copilot-stream.ts` (not under `runtimes/`; r1 recon notes Jini's own daemon relocated this file under `runtimes/`, mirrored here) | Verbatim. Zero imports in the origin. |
| `src/auth.ts` | `runtimes/auth/auth.ts` | De-branded. The five per-CLI guidance-text functions (`cursorAuthGuidance`, `deepseekAuthGuidance`, `antigravityAuthGuidance`, `reasonixAuthGuidance`, `claudeAuthGuidance`) and `genericAuthGuidance` had the origin product's literal name baked into 9 strings (e.g. "...in the `<product>` process environment.", "If `<product>` was launched outside an interactive shell..."). Each now takes an optional `hostName: string = 'the host application'` parameter threaded through from `classifyAgentAuthFailure`/`probeAgentAuthStatus`. Auth-failure-text classifier regexes (`isCursorAuthFailureText` etc.) and `classifyAgentServiceFailure`'s HTTP-status-aware regex families are unchanged (product-neutral as found). |
| `src/opencode-log.ts` | `runtimes/auth/opencode-log.ts` | Verbatim. Reads only OpenCode's own on-disk log format; no OD coupling found. |
| `src/env.ts` | `runtimes/env/env.ts` | Heavily de-branded — see "Design decisions" below; this file needed the same port treatment as the coupled trio even though r1b's brief classified `env.ts` as a "supporting generic file". |
| `src/launch.ts` | `runtimes/launch/launch.ts` | Verbatim. Codex native-binary-vs-node-wrapper resolution + PATH env application; no OD coupling found. |
| `src/resolution.ts` | `runtimes/launch/resolution.ts` | Verbatim (13 lines). |
| `src/terminal-launch.ts` | `runtimes/launch/terminal-launch.ts` | De-branded: the Windows `cmd /c start <title> cmd /k <command>` window title was the literal product name; now a parameter (`windowTitle: string = 'Agent Sign-in'`), default no longer product-named. One comment reworded. |
| `src/diagnostics.ts` | `runtimes/detection/diagnostics.ts` | Verbatim logic; `AgentDiagnostic`/`AgentFixIntent` imports repointed at this package's own vendored `types.ts` instead of `@open-design/contracts`. |
| `src/detection.ts` | `runtimes/detection/detection.ts` | Ported with the AMR/vela port swap — see "Design decisions" below. |
| `src/amr-profile-resolver.ts` | *(new)* | The `AmrProfileResolver` port (interface + `noopAmrProfileResolver` default) replacing OD's `import { resolveAmrProfile } from '../../integrations/vela.js'`. |
| `src/acp-model-probe.ts` | *(new)* | The `AcpModelProbe` port (interface + `noopAcpModelProbe` default + module-level `setAcpModelProbe()`/`detectAcpModels()`) replacing OD's `import { detectAcpModels } from '../../acp.js'` — see "Design decisions" below (the ACP-transport judgment call the task brief did not anticipate). |
| `src/pi-models.ts` | `apps/daemon/src/pi-rpc.ts#parsePiModels` (pure function; the surrounding ~700-line pi-rpc stdio transport is out of scope, same reasoning as `acp-model-probe.ts`) | Verbatim (pure string parsing, no transport dependency). |
| `src/amr-model-cache.ts` | `runtimes/amr/amr-model-cache.ts` | Verbatim caching logic; `AmrModelsResponse` return type vendored locally instead of imported from `@open-design/contracts`. `runtimes/amr/amr-model-probe.ts` (the OTHER file in that subdir) is explicitly NOT ported — see "Not ported" below. |
| `src/prompt-budget.ts` | `runtimes/prompt/prompt-budget.ts` | Mechanics (POSIX/Windows argv/CreateProcess byte budgets, Windows cmd-shim and direct-exe quote-escaping math) verbatim. Per the task's explicit instruction, user-facing error copy stripped of "skills/design-system context" → generic "selected context" phrasing (4 occurrences). |
| `src/prompt-file.ts` | `runtimes/prompt/prompt-file.ts` | De-branded: temp-dir prefix (originally product-prefixed) → `agent-runtime-${def.id}-...`. |
| `src/prompt-augmenter.ts` | *(new — port, not a lift)* | `PromptAugmenter`/`WorkspaceContextItem`/`RunContextSelection` per r1b §1's proposed shape, used as-is (matched the real source). Replaces `runtimes/prompt/chat-prompt-inputs.ts` in full — see "Not ported" below; none of that file's actual logic is lifted, only the injection-seam interface is defined. |
| `src/artifact-taxonomy.ts` | *(new — port, not a lift)* | `ArtifactTaxonomy` per r1b §1's proposed shape. Replaces the classification half of `runtimes/runs/run-artifacts.ts` (`isArtifactPath`, `isDesignSystemFile`, `isPreviewModulePath`, etc.) — none of that logic is lifted. `ArtifactStore` (persistence) deliberately NOT defined here per the task brief — that is a later storage/sqlite task's concern. |
| `src/telemetry-sink.ts` | *(new — port, not a lift)* | `TelemetrySink`/`RunLifecycleEvent` per r1b §1's proposed shape. Replaces the OD-analytics-schema half of `runtimes/runs/run-artifacts.ts` (PostHog artifact-count/design-system-created/activation-milestone analytics) — none of that logic is lifted. |
| `src/registry.ts` | `runtimes/registry/registry.ts` | `BASE_AGENT_DEFS` (24 defs) + dup-id guard + `getAgentDef` ported verbatim. `runtimes/registry/local-profiles.ts`'s `readLocalAgentProfileDefs` is deliberately NOT ported — see "Not ported" below. `AGENT_DEFS` here is exactly `BASE_AGENT_DEFS` (the origin's local-profile-merged variant is simplified accordingly). |
| `src/defs/*.ts` (24 files) | `runtimes/defs/*.ts` (aider, amp, amr, antigravity, claude, codebuddy, codex, copilot, cursor-agent, deepseek, devin, grok-build, hermes, kilo, kimi, kiro, mimo, opencode, pi, qoder, qwen, reasonix, trae-cli, vibe) | Import paths adjusted (`'../core/index.js'` → `'../types.js'`, or → `'../capabilities.js'` / `'../mmd-routes.js'` for the few defs importing runtime values, not just types, from the old `core` barrel: `claude.ts`, `codebuddy.ts`, `cursor-agent.ts`, `opencode.ts`). Five files needed real content changes beyond the import fix: `aider.ts` (one de-branded comment), `amr.ts` (two de-branded comments), `codex.ts` (two operator-override env vars renamed off their product prefix to `CODEX_SANDBOX_MODE`/`CODEX_DISABLE_PLUGINS`), `copilot.ts` (two de-branded comments), `grok-build.ts` (several de-branded comments), `reasonix.ts` (see "Design decisions" below — a real strip, not just a comment reword). The other 19 def files are byte-identical apart from the import-path fix. |
| `src/defs/shared.ts` | `runtimes/defs/shared.ts` | `detectAcpModels`/`parsePiModels` re-exports repointed at this package's own `acp-model-probe.ts`/`pi-models.ts` instead of OD's top-level ACP/pi-rpc transport modules. `execAgentFile`/`DEFAULT_MODEL_OPTION` re-exports repointed at this package's `invocation.ts`/`models.ts`. `clampCodexReasoning`/`parseLineSeparatedModels` (pure functions) verbatim. |
| `src/defs/index.ts` | `runtimes/defs/index.ts` | Verbatim barrel (24 `export *` statements). |
| `src/index.ts` | *(new — barrel)* | Re-exports every module above. |

### Design decisions (judgment calls)

**1. The ACP subprocess transport (1744 lines) and pi-rpc transport (684 lines) are out of
scope — `AcpModelProbe` is a fourth port beyond the anticipated trio + vela import.** The
task brief named the coupled trio (PromptAugmenter/ArtifactTaxonomy/TelemetrySink) plus the
single vela import in `detection.ts` as "the only real judgment-call work". In practice,
`defs/shared.ts` also imports `detectAcpModels` from OD's top-level ACP transport module —
the full ACP JSON-RPC handshake protocol (session/new, session/list_models, …), used by 8 of
the 24 def literals (devin, hermes, kilo, kimi, kiro, reasonix, trae-cli, vibe) as their
`fetchModels` implementation. `r1-daemon.md` itself classifies OD's `agent-protocol/` (the
ACP + pi-rpc subprocess layer, 17 files) as its OWN separate GENERIC-ENGINE extraction
target, not part of `runtimes/`'s file scope — porting 2400+ lines of a distinct subsystem
into this task would have blown "harvest wholesale" far past what was asked. So
`detectAcpModels` becomes `AcpModelProbe` (interface + no-op default + module-level
`setAcpModelProbe()` installer), mirroring the `AmrProfileResolver` pattern the brief already
asked for. Every ACP-based def's `fetchModels` keeps calling `detectAcpModels(...)` unchanged
(via `defs/shared.ts`'s re-export) — with the no-op probe installed, they degrade to "no live
models" and fall back to `fallbackModels`, exactly like a real vela/ACP timeout would. Proven
wired end-to-end in `ports.test.ts` (`setAcpModelProbe(stub)` then calling
`devinAgentDef.fetchModels(...)` directly and asserting the stub was reached).

**2. `env.ts` needed the same port treatment as the coupled trio, despite being listed as a
"supporting generic file".** The real `runtimes/env/env.ts` reads OD's `app-config.js` (for
an installation-id analytics identity env var, gated on a telemetry-consent flag), OD's
`sandbox-mode.ts`, and a vela-specific profile-forwarding module, and hardcodes the origin
product's own identity string as an `AMR_CLIENT_SOURCE` env value plus a product-prefixed
data-dir-derived temp-home path. None of that is generic. `spawnEnvForAgent` keeps its real,
generic behavior (proxy-aware merge via `@jini/platform`, OpenCode/MiMo
project-config-discovery disabling, AMR's `HOME`/`VELA_OPENCODE_BIN` backfill) and gains two
optional hooks — `perAgentEnv` and `sandboxOverlay` — so a host can re-attach its own
vela/sandbox-specific behavior without this package needing to import OD's
app-config/sandbox-mode/vela-profile modules. OD's AMR trace-env helper (a small function
whose whole purpose was emitting a product-prefixed trace-correlation env triad) is dropped
entirely, not ported — it is inherently OD/vela-adapter-owned and has no generic equivalent
to keep.

**3. `reasonix.ts`'s design-instructions constant is a real strip, not a comment reword.**
Unlike every other def literal (pure declarative CLI-adapter config), OD's `reasonix.ts`
injected a hardcoded system-prompt block via `env.REASONIX_ACP_SYSTEM_APPEND` that literally
told the model it was running inside the host product and instructed it to wrap output in
that product's own artifact-tag convention. That is genuine product-specific prompt content
smuggled into what the task brief assumed was a pure literal. It is dropped; a host wanting
equivalent behavior should compose it via `PromptAugmenter.systemOverlay` and merge the result
into this def's `env.REASONIX_ACP_SYSTEM_APPEND` itself (the engine has no generic mechanism
to know a given def has an env-based system-prompt hook — that's inherently a reasonix-specific
integration detail the host must wire).

**4. `registry/local-profiles.ts` (the user-configurable local-agent-profile-file loader) is
deliberately not ported.** The task's own scope description for `registry.ts` names only
"`BASE_AGENT_DEFS` array + dup-id guard + `getAgentDef(id)`" — it does not mention
local-profile merging. The real file also turned out to be far more coupled than a
"supporting generic file" would suggest: it reads a product-prefixed config-path override env
var, falls back to a product-branded default path under the user's home directory, reads a
product-prefixed data-dir env var, and depends on OD's daemon-level `sandbox-mode.ts`
subsystem entirely outside this package's charter. Rather than either violate the explicit
scope or half-port a coupled file, it's left out; `AGENT_DEFS` here is exactly
`BASE_AGENT_DEFS`. Flagged as a real follow-up: a future task could reintroduce a de-branded,
sandbox-free local-profile loader as an injected port (e.g. a `LocalProfileSource` interface)
if a consumer needs runtime-configurable custom agent defs.

**5. `amr/amr-model-probe.ts` (the other file in OD's `runtimes/amr/` subdir) is not ported;
only `amr/amr-model-cache.ts` is.** `amr-model-probe.ts`'s `resolveAmrModelProbe` composes
`launch`/`env`/`registry` (all in-scope) with OD's `app-config.js` (`readAppConfig`,
persisted settings) and a vela-integration module's credential-revision reader (both
out-of-scope OD subsystems) to build a cache key + spawn env for probing AMR's live model
catalog. This is daemon-level composition glue, not a pure CLI-adapter concern, and the task
brief never named `runtimes/amr/` in its explicit scope. `AmrModelLoadingCache` (the reusable
generic caching *pattern*) is kept; the OD-app-config-coupled probe-composition function is
not. A host wiring AMR needs to build its own equivalent of `resolveAmrModelProbe` using its
own config/credential ports plus this package's `AmrModelLoadingCache` + `resolveAgentLaunch`
+ `spawnEnvForAgent`.

**6. `chat-prompt-inputs.ts` is entirely OD-product prompt content, not partially generic —
confirmed after reading the full 938-line file.** Beyond the design-system-selection
functions r1b explicitly named (`resolveEffectiveDesignSystemSelection`,
`designSystemIdFromPluginSnapshot`, `formatDesignFilesWorkspaceHint`), the file also contains
comment-attachment rendering (OD's "attached preview comments" annotation feature), Codex
image-generation prompt overrides (OD's media-generation feature), and a research-command-
contract composer (OD's "research" feature) — every one of them product-specific, none of
them a generic prompt-composition mechanism. Per the task's explicit instruction ("do NOT
lift the OD logic itself"), none of it is ported; `PromptAugmenter` is the injection seam in
full.

### Coverage-driven refactors (2026-07-18)

`claude-stream.ts`, `qoder-stream.ts`, and `copilot-stream.ts` were the three stream-parser
test files left at their original-port baseline (55.66%/47.74%/62.5%, 76.19%/58.92%/90%,
83.87%/62.85%/100% statements/branches/functions respectively) after the earlier coverage-fix
pass brought the other ~50 files (including `json-event-stream.ts` and all 24 `defs/*.ts`
files) to ~100%. All three were expanded to 100%/100%/100%/100% (statements/branches/
functions/lines) with real behavioral tests, following `json-event-stream.test.ts`'s
established pattern (synthetic JSONL traces shaped to the parser's own documented wire
format, fed line-by-line through `feed()`/`flush()`, asserting the emitted event sequence).
Per the coverage skill's Phase 6.5 loop, four uncovered branches in `claude-stream.ts` were
classified as genuinely dead (a defensive check duplicated by an earlier guard) rather than
tested, and removed — no behavior change, verified by the full existing + new test suite
passing unchanged:

1. `emitCanonicalTaskSnapshot`'s trailing `if (!changed || runtimeTasks.size === 0) return
   false;` guard — both operands are unreachable by construction: every early-return path
   already covers the `!changed` case, and `runtimeTasks.set(...)` always executes
   immediately before this line on both surviving paths, so `size` can never be 0 here.
2. `nextGeneratedRuntimeTaskId`'s `while (runtimeTasks.has(String(nextRuntimeTaskId)))
   nextRuntimeTaskId += 1;` collision-skip loop — `nextRuntimeTaskId` is monotonically
   non-decreasing everywhere in the file (this function always hands out the current value
   then increments it; `runtimeTaskIdFromCreate`'s explicit-id branch bumps it to
   `numericId + 1`, strictly past any id `>=` the current counter, before this function can
   run again), so the counter can never equal an id already present in the map when the loop
   condition is checked.
3. `fileWriteContent`'s own `if (!isRecord(input)) return null;` guard — its only call sites
   (`emitToolUse`, and internally from `isHtmlWriteToolInput`) already sit inside an
   `isFileWriteToolUse(name, input)` truthy check, which itself already asserted
   `isRecord(input)`. Replaced by a one-line type assertion (`input as Record<string,
   unknown>`) with a justifying comment — a TS-required cast, not a runtime guard, per Phase
   6.5's 4th classification (a TS-required fallback with no real runtime path).
4. `isHtmlWriteToolInput`'s own `if (!isRecord(input)) return false;` guard — same reasoning
   as #3 (its one call site is inside the same `isFileWriteToolUse` check); same fix.

None of these four change `claude-stream.ts`'s observable event output for any input a real
`claude --output-format stream-json` process (or a malformed/adversarial one) can produce —
each removed condition was provably unreachable given the surrounding code's own invariants,
not a behavior the file relied on. See the four inline comments at each call site
(`// Coverage-driven refactor (2026-07-18, no behavior change): ...`) for the full reasoning
trail. `qoder-stream.ts` and `copilot-stream.ts` needed no code changes — their remaining
gaps were all genuinely-reachable-but-untested branches (env defaults, malformed-input
fallbacks, `flush()`'s empty/non-empty-buffer paths, etc.), closed with tests only.

A pre-existing, unrelated `src/launch.test.ts` test
(`resolveAgentLaunch > codex: falls back to the wrapper with no diagnostic when the wrapper
file cannot be read (permission denied)`) fails in this sandbox because the whole session
runs as `root`, and `chmod 000` does not deny a root reader — confirmed pre-existing via
`git stash` (fails identically on the pre-refactor tree). Not touched; out of this task's
scope (it is not one of the three stream-parser files, and the failure is an environment
property, not a code or test defect). Likewise, a handful of other pre-existing files
(`defs/amr.ts`, `detection.ts`, `launch.ts`, `json-event-stream.ts`, `amr-model-cache.ts`,
`env.ts`, `models.ts`, `opencode-log.ts`, `pi-models.ts`, `prompt-budget.ts`,
`terminal-launch.ts`, `defs/antigravity.ts`, and the `index.ts` barrel) sit below the
package's 99.9% branch/function threshold in the full merged run; all were confirmed (via
the same `git stash` before/after comparison) to already sit there before this task's changes
— untouched, out of scope, not a regression introduced by this pass.

#### Independent re-verification pass (2026-07-18, follow-up dispatch)

A follow-up dispatch re-ran the full package's `typecheck` and `vitest run --coverage` from a
clean `pnpm install` to produce one authoritative, from-scratch merged number (the prior
entries above were validated individually/in sub-batches). Two things surfaced that the
sub-batch runs had missed:

1. **Typecheck**: `pnpm --filter @jini/agent-runtime typecheck` failed with ~35 errors, none
   in the three stream-parser files. All were test-only type errors introduced by the earlier
   `f378baa` coverage-fix pass and never caught because that pass validated defs/ in sub-batches
   rather than one `tsc` invocation over the whole `src/` tree:
   - Nine ACP-style `defs/*.test.ts` files (`kilo`, `kimi`, `kiro`, `hermes`, `vibe`,
     `trae-cli`, `reasonix`, `amr`, `devin`) call `xAgentDef.buildArgs(...)` with the full
     5-argument `RuntimeAgentDef['buildArgs']` signature to prove the def ignores extra
     params, but each def's own `buildArgs` is declared as a zero-arg function (e.g.
     `() => ['acp']`) and typed via `satisfies RuntimeAgentDef`, which preserves the narrower
     literal arity instead of widening it — a real arity mismatch only visible to `tsc`, not to
     `vitest` (which doesn't type-check). Fixed by binding each call through an explicitly
     `RuntimeAgentDef['buildArgs']`-typed local before invoking it with the full argument list
     — same function reference, no behavior change, just enough of a type annotation to stop
     `tsc` from narrowing the call signature.
   - `auth.test.ts` and `detection.test.ts` typed mocked errno-style errors as
     `Error & Record<string, unknown>`, which `Object.assign(new Error(...), { code, signal })`
     results don't structurally satisfy (TS requires an explicit index signature on the source
     type when the target has one, and `Object.assign`'s inferred intersection type has none).
     Narrowed both to the concrete fields the tests actually set (`code?: string | number`,
     `signal?: string | null`, `stdout?`, `stderr?`) instead of a generic index signature.
   - `mcp.test.ts` and `devin.test.ts` passed an explicit `undefined` for an optional property
     typed without `| undefined` (`mcpDiscovery?: string`, `timeoutMs?: number`), which
     `exactOptionalPropertyTypes` (on in this package's `tsconfig.base.json`) rejects. Fixed by
     omitting the property in `mcp.test.ts` and widening the local array's field type to
     `number | undefined` in `devin.test.ts`.
   All twelve fixes are test-file-only, verified against the pre-`f378baa` tree (`git log -p
   --follow`) to confirm every failing line was introduced by that pass and not present before
   it. After the fixes, `pnpm --filter @jini/agent-runtime typecheck` is clean (0 errors).
2. **Coverage report generation**: a from-scratch `vitest run --coverage` produces **no**
   coverage output at all when any test fails, because Vitest's V8 provider defaults
   `coverage.reportOnFailure` to `false` — the pre-existing `launch.test.ts` sandbox-root
   failure documented above was silently suppressing the merged coverage report entirely. Not
   a config change to the committed `vitest.config.ts` (would mask real regressions in normal
   CI runs) — for local reproduction only, re-run with the CLI flag:
   `pnpm exec vitest run --coverage --coverage.reportOnFailure=true`.

**Authoritative merged numbers** (`coverage-summary.json` `total`, from-scratch `pnpm install`
+ `pnpm exec vitest run --coverage --coverage.reportOnFailure=true`, 973/974 tests passing —
the 1 failure is the documented pre-existing sandbox-root issue):
statements 99.23%, branches 98.35%, functions 98.91%, lines 99.23%. Per-file, the only metrics
below 99% are the same 13 files listed above (`amr-model-cache.ts`, `defs/amr.ts`,
`defs/antigravity.ts`, `detection.ts`, `env.ts`, `index.ts` barrel, `json-event-stream.ts`,
`launch.ts`, `models.ts`, `opencode-log.ts`, `pi-models.ts`, `prompt-budget.ts`,
`terminal-launch.ts`) — confirming the three target files (`claude-stream.ts`,
`qoder-stream.ts`, `copilot-stream.ts`) do **not** appear in the below-99% list, i.e. all three
verify at 100%/100%/100%/100% in the full merged run, not just in isolation. `pnpm guard`
(repo root) passes.

### Not ported / explicitly out of scope

- `runtimes/registry/local-profiles.ts` (design decision 4).
- `runtimes/amr/amr-model-probe.ts` (design decision 5).
- `runtimes/prompt/chat-prompt-inputs.ts` (design decision 6; replaced by `PromptAugmenter`).
- `runtimes/runs/run-artifacts.ts` (replaced by `ArtifactTaxonomy` + `TelemetrySink`).
- `runtimes/runs/{runs,chat-run-lifecycle}.ts` — this is `RunLifecycle`/`EventLog`-shaped
  content that belongs to `@jini/daemon` (already independently ported from a different OD
  branch per `packages/daemon/source-map.md`; out of this task's scope entirely, not
  re-examined here).
- Top-level daemon files the above reach into but that are not ported: the ACP transport
  module, the pi-rpc transport module, `app-config.js`, `sandbox-mode.ts`, the vela
  integration module, the vela-profile module, `question-form-detect.ts` — each is either a
  distinct future-task subsystem (ACP/pi-rpc transport) or an OD-adapter-owned daemon-level
  concern (app-config, sandbox-mode, vela specifics, question-form protocol).
- `@jini/protocol` was not touched. r1b §1a suggested `RuntimeAgentDef` and the stream-parser
  event union might eventually move to `@jini/protocol` to avoid a runtime cycle with
  `@jini/daemon`; this task's own explicit scope keeps `RuntimeAgentDef` inside
  `@jini/agent-runtime` (per the task dispatch's file list), and `@jini/protocol`'s existing
  `RunAgentPayload` union (in `packages/protocol/src/events.ts`) already covers a materially
  similar shape (`text_delta`/`tool_use`/`tool_result`/`usage`/`thinking_*`/`raw`) without
  needing an edit — the stream parsers here emit their own local, richer per-format event
  shapes (e.g. `turn_end`, `tool_input_delta`, Codex's `sessionId` status field) that a future
  daemon-integration task can normalize onto `RunAgentPayload` when it exists. No
  `@jini/protocol` changes were made in this task.

### Validation

- `pnpm --filter @jini/agent-runtime typecheck` (src + tests): zero errors, zero TS2307.
- `pnpm --filter @jini/agent-runtime test`: 60/60 passing across 10 test files — registry
  shape/dup-id, diagnostics builders, auth guidance de-branding + failure-text classifiers,
  `spawnEnvForAgent` hook wiring, `role-marker-guard` fabricated-marker detection, and
  behavioral replay tests for all 4 stream parsers (claude/json-event/qoder/copilot) against
  hand-built synthetic traces shaped to match the parsers' own documented wire formats and
  `mocks/golden/*.events.json`'s shape (the real `mocks/recordings/*.jsonl` corpus was not
  network-reachable from this sandbox — see the "Structural note" section above).
- `ports.test.ts` is the T2-gate port-satisfaction proof: constructs stub implementations of
  all five ports (`AmrProfileResolver`, `AcpModelProbe`, `PromptAugmenter`, `ArtifactTaxonomy`,
  `TelemetrySink`), proves each compiles against its interface, and for the two ports with a
  real call site inside this package (`AmrProfileResolver` via `detectAgents()`,
  `AcpModelProbe` via `detectAcpModels()` AND transitively through `devinAgentDef.fetchModels`)
  proves the injection is actually reached at runtime, not just type-compatible.
- No live coding-CLI subprocess was spawned (no agent CLIs installed/authenticated in this
  sandbox) — `detectAgents()` was exercised end-to-end against the real 24-def registry and
  correctly reports every agent unavailable with a `not-on-path` diagnostic, which is real
  coverage of the detection/launch/diagnostics wiring, but is not the same as a real-run smoke
  test. Flagged per the task brief's own instruction to note this limitation explicitly rather
  than silently skip it.

### Dependencies

`@jini/platform` (workspace) for `createCommandInvocation` (`invocation.ts`),
`wellKnownUserToolchainBins` (`executables.ts`), and `mergeProxyAwareEnv`/
`resolveSystemProxyEnv` (`env.ts`). No other new dependencies. `node:child_process`,
`node:fs`, `node:os`, `node:path`, `node:util`, `node:buffer` — all Node built-ins already
available via the workspace's `@types/node`.

## agent-protocol/ (2026-07-18)

Origin: fork `leonaburime-ucla/open-design`, branch `refactor/agent-protocol-barrel`
(the branch backing upstream PR #5200), commit
`e26a7764c4c30ff93c1274c00a5b03f2b152a37c`. **This branch is not merged into
the fork's `main`** — see "Documented discrepancy" below. Source files were
provided as a pre-made snapshot at `/tmp/od-snapshots/agent-protocol/` (17
TypeScript files + `README.md`), all read in full. Two cross-reference files
outside that snapshot were also read from a full clone of OD `main` at
`/tmp/od-source`: `apps/daemon/src/integrations/vela-errors.ts` (the
AMR/vela-branded account-failure classifier `acp/updates.ts` imported — not
ported, see seam 1 below) and `apps/daemon/src/artifacts/text-suppression.ts`
(ported verbatim, minus two dead functions — see seam 5). A third file,
`packages/contracts/src/execution-profile.ts`, was read to confirm the
`ExecutionProfile` type it exports is a trivial two-value literal union (see
seam 2).

Per extraction-plan.md §4's OD-sync note: "OD's `agent-runtime` zone is
HIGH-churn ... path-mirror those lifted files." This port keeps the exact
subdirectory shape of the origin (`core/`, `acp/`, `pi-rpc/`, each with its
own barrel) rather than flattening or re-cluster it, for that reason.

### File map

| Jini file | Origin file | Transform |
|---|---|---|
| `src/agent-protocol/core/json-line-stream.ts` | `core/json-line-stream.ts` | Ported verbatim, **except** one dead-code removal: the origin `flush()` had a defensive `if (pendingJson && emit(pendingJson)) { pendingJson = '' }` that a 200,000-trial fuzz test proved can never succeed (`classifyJsonCandidate` returning `'incomplete'` for a candidate provably implies `JSON.parse` on that same candidate also fails, given the pure-function/no-side-effect argument in the removal's inline comment) — removed. Also converted three `noUncheckedIndexedAccess`-driven `?? fallback`/early-`break` guards (`char === undefined`, `char ?? ''`, and `closeFrame`'s `!current \|\| current.kind !== kind` mismatch check) to documented non-null assertions / an unconditional pop, each verified unreachable via the loop-bound invariant or a targeted 2,000,000-trial adversarial fuzz (malformed bracket sequences) finding zero mismatches. See "Design decisions" below. |
| `src/agent-protocol/core/index.ts` | `core/index.ts` | Verbatim. |
| `src/agent-protocol/acp/types.ts` | `acp/types.ts` | Ported verbatim, **plus** a new exported `ExecutionProfile` type (`'filesystem' \| 'text_artifact'`) inlined from OD's `@open-design/contracts` package instead of importing it — see seam 2. |
| `src/agent-protocol/acp/constants.ts` | `acp/constants.ts` | Ported verbatim except doc-comment rewording: removed literal mentions of "Open Design" and the `OD_ACP_STAGE_TIMEOUT_MS` env var name from comments (the constant itself never read that var; only the *comment* referenced it) — see seam 5. |
| `src/agent-protocol/acp/json.ts` | `acp/json.ts` | `resolveAcpTimeoutMs` gained an optional third `envVarName` parameter (default `'AGENT_RUNTIME_ACP_TIMEOUT_MS'`, exported as `DEFAULT_ACP_TIMEOUT_ENV_VAR`) instead of hardcoding `OD_ACP_TIMEOUT_MS` — see seam 4. Everything else verbatim. |
| `src/agent-protocol/acp/rpc.ts` | `acp/rpc.ts` | Ported verbatim except: doc-comment reworded ("canonical Open Design error object" → "canonical, structured error object"), and the three `promoted_by` marker-string literals genericized (`'open_design_acp'` → `'agent_runtime_acp'`, and the two `_retry_status`/`_stderr_retry_status` suffixed variants in `acp/updates.ts`, not this file — see seam 3/5 note below). |
| `src/agent-protocol/acp/session-params.ts` | `acp/session-params.ts` | Verbatim (already product-neutral — vendor names like Hermes/Kimi/reasonix are third-party CLI names, not OD branding). |
| `src/agent-protocol/acp/models.ts` | `acp/models.ts` | Verbatim except one default: `clientName = 'open-design-detect'` → `clientName = 'agent-runtime-detect'` — see seam 3. |
| `src/agent-protocol/acp/account-failure.ts` | *(new)* | The `AccountFailureClassifier` port + `noopAccountFailureClassifier` default + `accountFailureDetails` helper — see seam 1. |
| `src/agent-protocol/acp/updates.ts` | `acp/updates.ts` | Replaced the `../../integrations/vela-errors.js` import with `./account-failure.js`; `promotedAmrRetryStatusPayload`/`promotedAmrStderrPayload` gained a `classifier: AccountFailureClassifier = noopAccountFailureClassifier` parameter; the `promoted_by` values genericized (`'open_design_acp_retry_status'` → `'agent_runtime_acp_retry_status'`, `'open_design_acp_stderr_retry_status'` → `'agent_runtime_acp_stderr_retry_status'`); doc comments reworded. Function/type names (`isAcpRetryStatus`, `AMR_STDERR_RETRY_TAIL_LIMIT`, etc.) and all classification logic otherwise verbatim — see seam 1. |
| `src/agent-protocol/acp/text-suppression.ts` | `apps/daemon/src/artifacts/text-suppression.ts` | Relocated into `acp/` (its sole consumer) and ported verbatim **except** two private helper functions (`possibleDsmlArtifactOpenStart`, `possibleArtifactCloseStart`) dropped — both declared but never called anywhere in the origin file (confirmed by `grep`). JSDoc/`@module` docblocks added (the origin had none) per this repo's documentation convention — see seam 5 and "Design decisions." |
| `src/agent-protocol/acp/session.ts` | `acp/session.ts` (875 lines, the largest/most complex file) | The de-branding seams (1–4 below) threaded through: `ExecutionProfile` imported from `./types.js` instead of `@open-design/contracts`; `text-suppression.ts` imported from `./text-suppression.js` instead of `../../artifacts/text-suppression.js`; `accountFailureClassifier` added as an optional field on `AttachAcpSessionOptions`, defaulting to `noopAccountFailureClassifier`, threaded into both `promotedAmrRetryStatusPayload`/`promotedAmrStderrPayload` call sites; `clientName` default `'open-design'` → `'agent-runtime'`. Beyond de-branding, four narrow dead-branch removals (documented individually in the source with the reachability proof, summarized in "Design decisions"): `failWithPayload`'s and `finishCleanPrompt`'s own `if (finished) return;` re-entry guards, one inline `if (finished) return;` inside the parser callback's RPC-error handling, and `emitVisibleTextDelta`'s `if (!delta) return;` guard — all four proven unreachable because every real call site is already gated by an *outer* check on the same condition. Also simplified `fail()`'s nested error-payload ternary (`...(options.details === undefined ? {} : { details: options.details })` → an unconditional `details: options.details`), since the only two call sites reaching that branch always supply `details` whenever they supply `retryable`. All core session-orchestration logic (the JSON-RPC handshake sequencing, the DSML/tool-call text-suppression interplay, artifact-write mirroring, permission auto-approval) is otherwise byte-for-byte identical. |
| `src/agent-protocol/acp/index.ts` | `acp/index.ts` | Origin's 6 named exports preserved, **plus** 4 new: `AttachAcpSessionOptions` (type, previously not barrel-exported — added since external callers constructing options programmatically benefit from it, and it costs nothing) and the 3 account-failure seam exports (`AccountFailure`, `AccountFailureClassifier`, `noopAccountFailureClassifier`). |
| `src/agent-protocol/pi-rpc/internal.ts` | `pi-rpc/internal.ts` | Verbatim (already product-neutral). |
| `src/agent-protocol/pi-rpc/events.ts` | `pi-rpc/events.ts` | Verbatim. |
| `src/agent-protocol/pi-rpc/models.ts` | `pi-rpc/models.ts` | Verbatim except two `noUncheckedIndexedAccess` guards (`if (line === undefined) continue;`, `if (provider === undefined \|\| modelId === undefined) continue;`) converted to documented non-null assertions — both provably unreachable given the enclosing loop bound / the just-checked `parts.length >= 2`. |
| `src/agent-protocol/pi-rpc/session.ts` | `pi-rpc/session.ts` | Verbatim except one `noUncheckedIndexedAccess` guard (`changed[0]?.path ?? null`) converted to a documented non-null assertion (`changed[0]!.path`), provably safe given the enclosing `changed.length === 1` check. |
| `src/agent-protocol/pi-rpc/index.ts` | `pi-rpc/index.ts` | Verbatim. |
| `src/agent-protocol/index.ts` | `index.ts` (root barrel) | Origin's 10 named exports preserved, **plus** the same 4 new exports as the `acp/` barrel (re-exported through). |
| `src/index.ts` | *(new — package barrel, replaces the `// @jini/agent-runtime — placeholder.` stub)* | Named re-exports of `agent-protocol/index.ts`'s full public surface (13 names). |

### Product-neutral seams (design decisions)

The task brief identified four real OD coupling points to port-inject; a fifth (literal `promoted_by` strings) and a build-config note surfaced during the coverage-driven pass. Each below follows this codebase's existing DI/port convention (`packages/core/src/pack.ts`'s small explicit interfaces, `packages/daemon/source-map.md`'s injected-collaborator framing) — a small named interface, a default no-op implementation, injected via caller options, not a kitchen-sink object.

**1. `AccountFailureClassifier` (`acp/account-failure.ts`).** OD's `acp/updates.ts` imported `classifyAmrAccountFailure`/`amrAccountFailureDetails` directly from `../../integrations/vela-errors.js` — a real AMR/vela-branded text classifier with a hardcoded `https://open-design.ai/amr/wallet?source=open_design` recharge URL literal (read in full from `/tmp/od-source`). That URL alone makes the file impossible to port verbatim. The replacement is a two-method-shaped port (`AccountFailureClassifier.classify(text): AccountFailure | null`) with fields named generically (`code`/`message`/`action`/`actionUrl`, not AMR's field names) so any provider's classifier can satisfy it. `promotedAmrRetryStatusPayload`/`promotedAmrStderrPayload` (kept their AMR-referencing names, per the task brief's own framing of "the two call sites are `promotedAmrRetryStatusPayload(update)` and `promotedAmrStderrPayload(chunk)`" — AMR is a routing/vendor concept the task treated as out of scope to rename, unlike the literal `'open-design'` string) now take a `classifier` parameter defaulting to `noopAccountFailureClassifier` (always returns `null`). This reproduces "the feature doesn't exist" for any caller that doesn't inject a real classifier — verified by dedicated tests exercising both the no-op default and an injected matching classifier in `acp/updates.test.ts` and `acp/session.test.ts`. A future OD adapter package (not this task) would implement the real vela-backed classifier and inject it.

**2. `ExecutionProfile` inlined (`acp/types.ts`).** OD's `acp/session.ts` imported `type ExecutionProfile from '@open-design/contracts'`. The real type, read from `/tmp/od-source/packages/contracts/src/execution-profile.ts`, is `export type ExecutionProfile = 'filesystem' | 'text_artifact';` plus one small helper function this port does not need (`executionProfileFromStreamFormat`, an OD-stream-format-specific mapper not used by `acp/session.ts` itself). Importing an entire external package for a two-value literal union would be the tail wagging the dog, so it's inlined as a local exported type instead.

**3. Client-name / env-var de-branding.** Two literal `'open-design'`-prefixed defaults (`acp/session.ts`'s `clientName = 'open-design'` → `'agent-runtime'`; `acp/models.ts`'s `clientName = 'open-design-detect'` → `'agent-runtime-detect'`) and one hardcoded env var name (`acp/json.ts`'s `resolveAcpTimeoutMs` reading `env.OD_ACP_TIMEOUT_MS` → an optional `envVarName` parameter, default `'AGENT_RUNTIME_ACP_TIMEOUT_MS'`). All three are harmless-to-rename ACP protocol/runtime details (a handshake `clientInfo.name` value, a timeout knob), not behavior changes. **Extended beyond the task brief's explicit list**: three `promoted_by: 'open_design_acp...'` marker-string *values* (not just doc comments) found in `acp/rpc.ts` and `acp/updates.ts` during the audit — these don't match the literal grep patterns the task specified (`open-design` has a hyphen; the marker strings use an underscore, `open_design_acp`), but are clearly the same class of product-identity leak in spirit, so they were renamed too (`agent_runtime_acp`, `agent_runtime_acp_retry_status`, `agent_runtime_acp_stderr_retry_status`) and called out explicitly here rather than silently fixed.

**4. `resolveAcpTimeoutMs`'s env var name.** Covered under seam 3 above; listed separately in the task brief as its own numbered item, so cross-referenced here for clarity.

**5. Doc-comment / prose rewording.** "Open Design", `OD_ACP_STAGE_TIMEOUT_MS`, `OD_ACP_TIMEOUT_MS`, and `server.ts` (an OD-specific file path with no Jini equivalent) references in JSDoc/inline comments across `acp/constants.ts`, `acp/json.ts`, `acp/rpc.ts`, `acp/updates.ts`, and `acp/session.ts` were reworded to generic language (e.g., "a structured error object", "a host application may resolve its own branded environment variable"). The `text-suppression.ts` port additionally needed this treatment in its own new `@module` docblock (see next item) and one internal comment referencing this skill's coverage-discipline convention by a path that itself contains the substring `open-design` (`docs/jini-port/skills/fixing-open-design.md`) — reworded to avoid the literal path.

**6. `text-suppression.ts`'s two dropped dead functions.** `possibleDsmlArtifactOpenStart` and `possibleArtifactCloseStart` are declared in the origin file but never called anywhere in it (confirmed by `grep -n` across the full origin file — zero call sites, not exported). The task brief said "port this file verbatim," but keeping genuinely dead, unreachable, unexported code would force a choice between a contrived test asserting nothing real, or a coverage-suppression comment — both of which `docs/jini-port/skills/fixing-open-design.md`'s Phase 6.5 explicitly rules out ("a hard-to-cover branch is a refactor signal, not something to suppress"). Dropped instead; this is the one deliberate "not quite verbatim" deviation in an otherwise byte-for-byte port of that file.

**7. Four dead-branch removals in `acp/session.ts` and one in `core/json-line-stream.ts`'s `flush()`, plus three `noUncheckedIndexedAccess`-guard-to-non-null-assertion conversions across `core/json-line-stream.ts`, `pi-rpc/models.ts`, and `pi-rpc/session.ts`.** These surfaced only during the coverage-driven pass (Phase 6.5), not from the OD-coupling analysis — each is a genuinely unreachable branch given the *current* call graph, not a speculative "this could never happen" guess:
   - `core/json-line-stream.ts`'s `flush()` had a defensive re-emit-and-clear on a leftover `pendingJson` candidate; proven dead because `pendingJson` is only ever retained when `classifyJsonCandidate` most recently judged it `'incomplete'`, and a 200,000-trial fuzz (random truncated valid-JSON fragments) found zero cases where `classifyJsonCandidate` says `'incomplete'` while `JSON.parse` on the identical string would actually succeed — so a bare re-attempt at end-of-stream could never succeed either.
   - `core/json-line-stream.ts`'s `closeFrame` helper carried a `!current || current.kind !== kind` mismatch guard; proven dead because every one of its 4 call sites is already nested inside a branch that established the popped frame's kind, confirmed by a 2,000,000-trial adversarial fuzz (malformed bracket sequences) finding zero mismatches.
   - `acp/session.ts`'s `failWithPayload` and `finishCleanPrompt` each carried their own `if (finished) return;` re-entry guard; both have call sites entirely nested inside the parser callback's own `if (aborted || finished) return;` at that callback's top, or (for the stderr-promotion call site) the stderr handler's own equivalent guard — so neither function can actually be invoked a second time once `finished` is true. **Contrast**: `fail()`'s own `if (finished) return;` guard was *kept*, because it has two call sites (`child.on('error', ...)` and `stdin.on('error', ...)`) with no pre-check of their own — genuinely reachable, and a real test (`acp/session.test.ts`) exercises it by emitting a stdin error followed by a child-process error.
   - `acp/session.ts`'s parser callback had a second, inline `if (finished) return;` inside its RPC-error-handling block, fully redundant with the same callback's own top-of-function check three lines earlier (nothing between them can flip `finished`) — removed.
   - `acp/session.ts`'s `emitVisibleTextDelta` carried an `if (!delta) return;` guard; all three call sites already guard against an empty delta before calling it (`if (flushedText) {...}`, `if (outputDelta) {...}`, and the plain-else branch which is only reached after an earlier `if (!toolCallStrippedDelta) return;` already ruled out emptiness).
   - `pi-rpc/models.ts` (`if (line === undefined) continue;`, `if (provider === undefined || modelId === undefined) continue;`) and `pi-rpc/session.ts` (`changed[0]?.path ?? null`) each had a `noUncheckedIndexedAccess`-driven guard around an array index that the enclosing loop bound / length check already guarantees is defined — converted to a documented non-null assertion (`fixing-open-design.md` Phase 6.5's fourth classification bucket: "TS-required fallback with no real runtime path").

   Every removal is accompanied by an inline comment in the source explaining the reachability proof, and none change observable behavior for any input reachable through the public API — verified by re-running the full test suite (450 tests) after each change.

### Documented discrepancy (OD-sync tooling note)

The task brief for this port assumed a pre-existing `agent-protocol/` capability-barrel directory in OD. That directory **only exists on the fork's unmerged `refactor/agent-protocol-barrel` branch** (the branch backing upstream PR #5200) — on the fork's `main`, `acp.ts` and `pi-rpc.ts` are still flat, unrefactored ~1,744-line and ~684-line files respectively (per that branch's own `README.md`, read in full and largely reused for `src/agent-protocol/README.md`'s "What changed" section). Whoever next builds OD-sync patch-routing tooling for this package (extraction-plan.md §4) needs to know the patch source is a not-yet-merged branch, not `main` — a patch generated against `main`'s flat `acp.ts`/`pi-rpc.ts` will not `git apply` cleanly against this package's split `acp/*.ts` files without the same directory-transform the branch's own refactor performed.

### Build-config note

`packages/agent-runtime/tsconfig.json`'s `include`/`exclude` excludes `src/skills/**` from this package's own `tsc` compilation scope. One skill (`chat-motion-overlay`) ships a self-contained `assets/remotion-template/` sub-project with its own `.ts`/`.tsx` source files (a Remotion video template meant to be copied out and built by a *consumer* with its own `remotion`/`react`/JSX toolchain, not compiled as part of `@jini/agent-runtime` itself) — including it in this package's `tsc` scope produces dozens of unrelated JSX/module-resolution errors. This is a build-config scoping decision only; no content under `src/skills/` was modified.

### Dependencies

No new dependencies. `node:child_process`, `node:fs`, `node:path`, `node:stream` (Node built-ins only). Test-only: `vitest` + `@vitest/coverage-v8` (root workspace devDependency, plus explicitly declared in this package's own `package.json` per `packages/ui/package.json`'s pattern).

## Barrel merge (2026-07-18)

`packages/agent-runtime/` was independently built out from an empty stub on
two separate branches: `port/agent-runtime-from-runtimes` (merged to `main`
as PR #24, the "runtimes/" section above) and
`port/agent-protocol-toolexecutor-daemoncore` (this PR, the
"agent-protocol/" section above). Merging `main` into the latter conflicted
on the shared package scaffolding (`package.json`, this file, `src/index.ts`,
`tsconfig.json`, `vitest.config.ts`) since both branches independently
created it — not on either side's actual ported content, which is disjoint
(`src/agent-protocol/**` vs. everything else under `src/`).

**`package.json`**: merged `dependencies` (`@jini/platform`, from the
`runtimes/` port's `invocation.ts`/`executables.ts`/`env.ts`) and
`devDependencies` (`@vitest/coverage-v8`, from the `agent-protocol/` port)
into one list; kept the `runtimes/` port's `test:coverage` script.

**`tsconfig.json`** / **`vitest.config.ts`**: both sides independently
excluded `src/skills/**` (needed — one skill,
`chat-motion-overlay`, ships a self-contained Remotion template with its own
`.ts`/`.tsx` files that aren't part of this package's own compilation/test
surface); only the `runtimes/` side also excluded `src/craft/**` (a no-op
today since `craft/` is markdown-only, but kept for explicitness as content
grows). Merged to exclude both directories in both files. `vitest.config.ts`
also merged `include` (`src/**`, the broader of the two — the
`agent-protocol/`-scoped `src/agent-protocol/**` from this PR was a subset)
and merged the type-only-file coverage carve-outs (`src/types.ts` from the
`runtimes/` port, `src/agent-protocol/acp/types.ts` from this PR) into one
`exclude` list. Coverage `thresholds` differed (this PR: 99/99/99/99; the
`runtimes/` port: 99.9/99.9/99.9/99.9) — set to 99 on all four metrics,
matching the documented floor in `docs/jini-port/skills/fixing-open-design.md`
Phase 6.5 (">=99% ... 100% as the actual goal"), and verified against the
actual merged coverage run (see this package's own CI/PR validation output
for the authoritative merged numbers, same as the `runtimes/` section's own
"Independent re-verification pass" above).

**`src/index.ts`**: merged both barrels' export statements. Two real name
collisions were found between the two ported trees (verified via a
top-level `export (function|const|class|interface|type) <name>` scan across
both trees, not just an alphabetical-ordering artifact of the merge) and
resolved by aliasing rather than dropping either side:

1. **`detectAcpModels`.** This PR's `src/agent-protocol/acp/models.ts`
   exports the REAL ACP subprocess transport: it spawns the CLI and performs
   the actual `initialize` + `session/new` JSON-RPC handshake to fetch live
   models. The `runtimes/` port's `src/acp-model-probe.ts` (see that
   section's Design decision 1) *also* exports a function named
   `detectAcpModels` — but it is an injectable, no-op-by-default seam
   (`AcpModelProbe.detectModels`) that `defs/shared.ts` re-exports and 8 def
   literals (devin, hermes, kilo, kimi, kiro, reasonix, trae-cli, vibe) call
   as their `fetchModels` implementation, because at the time that branch
   was written the real ACP transport did not yet exist in this package (it
   was a separate, not-yet-ported subsystem — see that section's Design
   decision 1). Now that the real transport IS present, both are kept:
   the plain `detectAcpModels` name is bound to the real transport (from
   `agent-protocol/`, arguably the more generally useful public name for an
   external consumer), and `acp-model-probe.ts`'s seam function is
   re-exported as `probeAcpModels` instead. **Not touched**: `defs/shared.ts`
   still imports its own `detectAcpModels` directly from
   `./acp-model-probe.js` (a same-package file import, unaffected by the
   barrel-level alias) — the 8 ACP-based def literals' `fetchModels` still
   resolve to the no-op-by-default seam exactly as before this merge. Wiring
   those defs' `fetchModels` to the real transport instead (i.e., calling
   `setAcpModelProbe()` with an adapter over `agent-protocol`'s
   `detectAcpModels`) is a real, valuable follow-up this merge deliberately
   does not attempt — it is new integration work, not a conflict-resolution
   choice, and needs its own scoped task with its own tests (the two
   functions' request/response shapes are structurally similar but not
   identical: `AcpModelProbeRequest`/`RuntimeModelOption` vs.
   `DetectAcpModelsOptions`/`ModelOption`).
2. **`parsePiModels`.** Both ports independently lifted the identical OD
   origin function (`apps/daemon/src/pi-rpc.ts#parsePiModels`, a pure
   string-parsing function with no transport dependency) into two different
   files: the `runtimes/` port's standalone `src/pi-models.ts` (used
   internally by `defs/shared.ts` for the `pi` CLI's own model listing) and
   this PR's `src/agent-protocol/pi-rpc/models.ts` (part of the
   patch-mirrored `agent-protocol/` subtree, used internally by
   `pi-rpc/session.ts`). Confirmed byte-for-logic-identical (same
   line-parsing algorithm, same `DEFAULT_MODEL_OPTION` shape, same
   dedup-by-`provider/modelId` behavior; only cosmetic differences — return
   type name `PiModelOption` vs. `RuntimeModelOption`, and
   non-null-assertion vs. `undefined`-check style for the
   `noUncheckedIndexedAccess` guard). `pi-models.ts`'s copy keeps the plain
   `parsePiModels` name (it is the one with real internal consumers reached
   through this package's own barrel-adjacent re-export chain); the
   `agent-protocol/pi-rpc` copy is re-exported as `parsePiRpcModels`
   instead. Neither internal consumer (`defs/shared.ts`, `pi-rpc/session.ts`)
   was touched — both import their own local copy by direct file path, not
   through the package barrel, so the alias only affects the barrel's public
   surface, not either port's internal behavior.
   `src/index.test.ts` was extended (not just left as the pre-merge,
   `agent-protocol/`-only assertions) to prove both aliases resolve to two
   distinct, real functions (`not.toBe`) and that the two independent
   `parsePiModels`/`parsePiRpcModels` ports still agree on output for the
   same input, backing up the "verified byte-for-logic-identical" claim
   above with an executable assertion rather than only a source-reading one.

No other export names collided (`ModelOption` vs. `RuntimeModelOption`,
`AttachAcpSessionOptions`, `AccountFailure`/`AccountFailureClassifier`, the
24 `*AgentDef` def-literal exports, etc. are all distinctly named across the
two trees).

**`packages/platform/src/index.ts`**: the two sides added disjoint modules
(this PR's `home-expansion.ts`/`sandbox-env.ts`/`resource-paths.ts`/
`terminal.ts`, from the "flat generic daemon primitives" part of this PR's
scope, vs. `main`'s unrelated `download.ts` from a different, already-merged
PR) — no name collisions; both sides' export blocks and module-doc bullet
list entries were concatenated as-is.

**`pnpm-lock.yaml`**: not hand-merged; `origin/main`'s version was accepted
to resolve the conflict marker, then `CI=true pnpm install` was run from the
repo root to regenerate it from the merged `package.json` files.
