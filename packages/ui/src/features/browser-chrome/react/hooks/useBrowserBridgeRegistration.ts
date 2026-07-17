import { useEffect, useRef } from 'react';
import type { BrowserTabHandle } from '../../types.js';
import type { BrowserBridgeRegistrationPort } from '../../ports.js';

/**
 * Registers/unregisters a live browser tab's handle with a host-supplied
 * bridge whenever `scopeKey` or `handle` changes, and unregisters on
 * unmount. Mirrors the origin's `registerBrandBrowser` effect, generalized:
 * this hook only owns the register-on-mount/unregister-on-unmount lifecycle,
 * never what the handle is used for.
 */
export function useBrowserBridgeRegistration(
  scopeKey: string | undefined,
  handle: BrowserTabHandle | null,
  dependencies: { bridgeRegistration: BrowserBridgeRegistrationPort },
): void {
  const bridgeRef = useRef(dependencies.bridgeRegistration);
  bridgeRef.current = dependencies.bridgeRegistration;

  useEffect(() => {
    if (!scopeKey) return undefined;
    bridgeRef.current.registerBrowserHandle(scopeKey, handle);
    return () => bridgeRef.current.registerBrowserHandle(scopeKey, null);
  }, [scopeKey, handle]);
}
