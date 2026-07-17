/**
 * Generalized from OD `apps/packaged/src/launch.ts`'s
 * `claimPackagedSingleInstanceLock` — the only OD-specific thing about the
 * original was its name and the namespace-scoped paths threaded alongside it
 * elsewhere in that file. The lock mechanism itself was already generic.
 */

export interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  onSecondInstance(listener: () => void): void;
}

export interface SingleInstanceLockPort {
  claim(app: SingleInstanceApp, onSecondInstance: () => void): boolean;
}

export function claimSingleInstanceLock(app: SingleInstanceApp, onSecondInstance: () => void): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.onSecondInstance(onSecondInstance);
  return true;
}

export function createSingleInstanceLockPort(): SingleInstanceLockPort {
  return { claim: claimSingleInstanceLock };
}
