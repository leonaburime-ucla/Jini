import { handleProtocolProxyRequest, schemeEntryUrl, type ProtocolHandlerPort, type ProtocolSchemeRegistration } from '../protocol.js';
import type { ElectronProtocolLike } from './electron-surfaces.js';

export function createElectronProtocolHandlerPort(electronProtocol: ElectronProtocolLike): ProtocolHandlerPort {
  return {
    registerSchemeProxy(scheme: string, targetBaseUrl: string): ProtocolSchemeRegistration {
      electronProtocol.registerSchemesAsPrivileged([
        { scheme, privileges: { standard: true, secure: true, corsEnabled: true, supportFetchAPI: true, stream: true } },
      ]);
      electronProtocol.handle(scheme, async (request) => handleProtocolProxyRequest(request, targetBaseUrl));
      return { scheme, entryUrl: schemeEntryUrl(scheme) };
    },
  };
}
