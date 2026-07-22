import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useIframeKeepAlivePool } from '../hooks/useIframeKeepAlivePool.js';
import { setForwardedRef, syncIframeProps, type PooledIframeProps } from '../dom-sync.js';

const subscribeToNoopStore = () => () => {};
const getClientSnapshot = () => false;
const getServerSnapshot = () => true;

function useIsServerRender() {
  return useSyncExternalStore(subscribeToNoopStore, getClientSnapshot, getServerSnapshot);
}

/**
 * An `<iframe>` whose element is kept alive in the nearest
 * `IframeKeepAlivePoolProvider` (or a local single-entry fallback pool if
 * none is mounted) across unmount/remount under the same `cacheKey`,
 * instead of reloading. Renders a plain `<iframe>` during SSR, since the
 * pool is a client-only concept.
 */
export const PooledIframe = forwardRef<HTMLIFrameElement, PooledIframeProps>(function PooledIframe({
  cacheKey,
  src,
  ...props
}, forwardedRef) {
  const isServerRender = useIsServerRender();
  if (isServerRender) return <iframe {...props} src={src} />;
  return (
    <ClientPooledIframe
      ref={forwardedRef}
      cacheKey={cacheKey}
      src={src}
      {...props}
    />
  );
});

const ClientPooledIframe = forwardRef<HTMLIFrameElement, PooledIframeProps>(function ClientPooledIframe({
  cacheKey,
  src,
  ...props
}, forwardedRef) {
  const pool = useIframeKeepAlivePool();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const propsRef = useRef<PooledIframeProps>({ cacheKey, src, ...props });
  const appliedAttributesRef = useRef<Set<string>>(new Set());
  const appliedStyleKeysRef = useRef<Set<string>>(new Set());
  propsRef.current = { cacheKey, src, ...props };

  useLayoutEffect(() => {
    // `hostRef` attaches to the unconditionally-rendered `<span>` below during
    // the same commit, before any layout effect runs — it's always set here.
    const frame = pool.attach(cacheKey, hostRef.current!, () => document.createElement('iframe'));
    iframeRef.current = frame;
    return () => {
      setForwardedRef(forwardedRef, null);
      iframeRef.current = null;
      pool.release(cacheKey);
    };
  }, [cacheKey, pool, forwardedRef]);

  useLayoutEffect(() => {
    // The effect above always runs first (declared earlier in the same
    // component, same commit) and sets `iframeRef.current` before this one
    // ever runs, so it's always populated here.
    const frame = iframeRef.current!;
    syncIframeProps(
      frame,
      propsRef.current,
      appliedAttributesRef.current,
      appliedStyleKeysRef.current,
    );
    setForwardedRef(forwardedRef, frame);
  });

  return <span ref={hostRef} className="pooled-iframe-host" />;
});
