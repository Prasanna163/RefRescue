import { SteelEntitlementProvider } from './entitlement/steel.mjs';
import { EntitlementService } from './entitlement/service.mjs';
import { LocalFileStore, VercelBlobStore } from './file-store.mjs';
export function createEntitlementService(config) {
  if (config.provider !== 'steel') throw new Error(`Unsupported cloud provider: ${config.provider}`);
  const provider = new SteelEntitlementProvider({ ...config.steel, allowedHosts: config.allowedHosts });
  const fileStore = config.fileStore === 'vercel' ? new VercelBlobStore() : new LocalFileStore({ dir: config.fileDir, publicBaseUrl: config.publicBaseUrl, signingSecret: config.fileSigningSecret });
  return new EntitlementService({ provider, fileStore });
}
