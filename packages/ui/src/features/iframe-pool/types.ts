export interface IframeKeepAlivePoolEntry<TKey = string> {
  key: TKey;
  element: HTMLIFrameElement;
  lastUsedAt: number;
}

export interface IframeKeepAlivePoolEvictOptions {
  /** Also remove the entry if it's currently mounted/active, not just parked. */
  includeActive?: boolean;
}

export interface IframeKeepAlivePoolValue {
  /** Mounts (or reuses) the iframe for `key` under `host`, creating it via `create()` on first use. */
  attach(key: string, host: HTMLElement, create: () => HTMLIFrameElement): HTMLIFrameElement;
  /** Marks `key` inactive and parks its iframe off-DOM instead of destroying it. */
  release(key: string): void;
  /** Destroys the iframe for `key` immediately, wherever it currently sits. */
  evict(key: string): void;
  /** Destroys every parked (or, with `includeActive`, every) entry `predicate` matches. */
  evictMatching(
    predicate: (entry: IframeKeepAlivePoolEntry) => boolean,
    options?: IframeKeepAlivePoolEvictOptions,
  ): void;
}

export interface IframeKeepAlivePoolConfig {
  /** Maximum iframes kept mounted (active + parked) at once. Defaults to `DEFAULT_MAX_MOUNTED_IFRAMES`. */
  maxMounted?: number;
}
