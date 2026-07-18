import { createSingleInstanceLockPort, type SingleInstanceApp, type SingleInstanceLockPort } from '../single-instance.js';
import type { ElectronAppLike } from './electron-surfaces.js';

export function createElectronSingleInstanceLockPort(app: ElectronAppLike): SingleInstanceLockPort {
  const adapted: SingleInstanceApp = {
    requestSingleInstanceLock: () => app.requestSingleInstanceLock(),
    quit: () => app.quit(),
    onSecondInstance: (listener) => app.on('second-instance', listener),
  };
  return createSingleInstanceLockPort(adapted);
}
