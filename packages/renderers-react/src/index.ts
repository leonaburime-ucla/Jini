export type { SandboxedDocumentOptions, SandboxedDocumentResult, SandboxBridgeMessage, SandboxBridgeHandler } from './types';
export {
  isFullHtmlDocument,
  wrapFragmentAsDocument,
  injectBaseHref,
  buildStorageShimScript,
  buildFocusGuardScript,
  buildSandboxedDocument,
} from './sandboxed-document';
export { escapeHtmlAttribute, injectAfterHeadOpen, injectBeforeHeadEnd, injectBeforeBodyEnd } from './html-utils';
export { useSandboxBridge } from './sandbox-bridge';
export type { UseSandboxBridgeOptions, SandboxBridge } from './sandbox-bridge';
export { buildSandboxedPreviewPage, openSandboxedPreviewInNewTab } from './new-tab-preview';
export type { NewTabPreviewOptions } from './new-tab-preview';
