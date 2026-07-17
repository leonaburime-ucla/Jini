/**
 * @jini/renderers-react — the artifact renderer registry + sandboxed
 * srcDoc host. See `docs/jini-port/extraction-plan.md` §3 and
 * `docs/jini-port/recon/r4b-webui-design.md` §1 ("@jini/artifacts-react —
 * RendererRegistry", the pre-lock name for this package) for the design
 * this targets, and `source-map.md` for exact provenance.
 */
export type { ArtifactFile, ArtifactManifest, ArtifactKind, ArtifactRendererId, ArtifactExportKind, ArtifactStatus } from './types.js';

export {
  RendererRegistry,
  resolveArtifactManifest,
  type ArtifactRenderer,
  type ArtifactRendererContext,
  type ArtifactRenderMatch,
} from './registry.js';

export {
  HtmlRenderer,
  MarkdownRenderer,
  SvgRenderer,
  ReactComponentRenderer,
  renderMarkdownToSafeHtml,
  createDefaultRendererRegistry,
} from './renderers/index.js';

export { highlightCode } from './shiki.js';

export {
  shouldUrlLoadHtmlPreview,
  parseForceInline,
  htmlNeedsFocusGuard,
  htmlNeedsSandboxShim,
  type UrlLoadDecision,
} from './url-load-decision.js';

export {
  buildSrcDoc,
  buildLazySrcDocTransport,
  canActivateSrcDocTransport,
  sanitizeTitleInDoc,
  sanitizePreviewTitle,
  DEFAULT_SRC_DOC_CSP,
  injectAfterHeadOpen,
  injectBeforeHeadEnd,
  injectBeforeBodyEnd,
  applySrcDocBridges,
  type BuildSrcDocOptions,
  type SrcDocActivationInputs,
  type SrcDocBridge,
  type SrcDocBridgeContext,
} from './srcdoc/index.js';

export { I18nProvider, useI18n, useT, type I18nContextValue, type TranslationDict, type TranslationVars } from './react/i18n.js';
export { SrcDocSandbox, type SrcDocSandboxProps } from './react/components/SrcDocSandbox.js';
export {
  ArtifactView,
  type ArtifactViewProps,
  type ArtifactViewSlot,
  type ArtifactViewSlotProps,
  type ArtifactViewSlots,
} from './react/components/ArtifactView.js';

export * from './annotation-canvas/index.js';
