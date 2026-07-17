/**
 * This feature is almost entirely presentational + pure logic (no fetch, no
 * project/file transport — see `packages/ui/source-map.md` for why the
 * actual file-content loading, saving, and rendering pipelines were left
 * out of scope). The one thing every consumer still needs a real browser
 * API for is copy-to-clipboard, so that's the one injectable seam here,
 * following the same "context/callback + host-injected adapter, default a
 * real browser implementation" shape as `features/connectors/`'s
 * `authPendingStorage`/`authBridge`.
 */
export interface ViewerClipboardPort {
  copyText(text: string): Promise<boolean>;
}

export interface ViewerShellDependencies {
  clipboard: ViewerClipboardPort;
}
