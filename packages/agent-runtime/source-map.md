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
