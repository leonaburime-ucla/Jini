# @jini/renderers-react source map

## AnnotationCanvas

- Source: `apps/web/src/components/PreviewDrawOverlay.tsx` from
  `https://github.com/leonaburime-ucla/open-design`, branch
  `refactor/web-memory-slice`, commit
  `d695f1e0f2b85a032aa7ce4895a3eb764cb1b65d`.
- Verified source route: that live checkout's
  `apps/web/src/components/PreviewDrawOverlay.tsx` is byte-identical to
  `integrations/open-design/reference/components-original/PreviewDrawOverlay.tsx`.
- Known reference exception: the historical checkout does not contain
  `apps/web/AGENTS.md`; the root `AGENTS.md` was read instead.
- Extracted into a product-neutral annotation engine:
  normalized selection boxes, freehand ink with undo/redo, text labels,
  rAF-coalesced DPR-aware canvas redraw, and collision-avoiding toolbar
  placement.
- Deliberately not extracted: iframe lookup/scroll, screenshot compositing,
  product attachment/submission actions, custom browser events, product mark
  kinds, product `data-*` attributes, and product DTO imports. Hosts integrate
  through neutral submit/capture callback seams.

## Live OD callers and contract recorded before extraction

`rg` in the live OD checkout found runtime callers in
`apps/web/src/components/DesignBrowserPanel.tsx`, `ChatComposer.tsx`, and
`FileViewer.tsx`, plus component tests under `apps/web/tests/components/`.
The OD public props/event surface at the source commit was:
`active`, `captureViewport`, `onActiveChange`, `captureTarget`,
`captureSnapshot`, `captureFrameRect`, `filePath`, `hideChrome`,
`sendDisabled`, `sendDisabledReason`, `onToolbarClick`, and `toolbarHost`;
custom event consumers listened to the product event constant and received
`file`, `note`, `action`, `filePath`, product mark kind, bounds, target,
extra files, and ack. The Jini extraction intentionally replaces that
product event/attachment/snapshot contract with neutral `onCapture` and
`onSubmit` callbacks carrying `AnnotationCanvasValue` plus frame/canvas data.
