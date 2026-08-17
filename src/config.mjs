import { DEFAULT_ALLOWED_HOSTS, parseAllowedHosts } from './entitlement/security.mjs';
export function loadConfig(env = process.env) {
  const configured = parseAllowedHosts(env.REFRESCUE_ALLOWED_HOSTS || '');
  return {
    port: Number(env.PORT || 8787), host: env.HOST || '0.0.0.0', appToken: env.REFRESCUE_TOKEN || '', publicBaseUrl: env.REFRESCUE_PUBLIC_BASE_URL || '',
    allowedHosts: configured.length ? configured : DEFAULT_ALLOWED_HOSTS, provider: env.REFRESCUE_PROVIDER || 'steel',
    steel: { apiKey: env.STEEL_API_KEY || '', profileId: env.STEEL_PROFILE_ID || '', extensionId: env.STEEL_MYLOFT_EXTENSION_ID || '' },
    fileStore: env.BLOB_READ_WRITE_TOKEN || env.VERCEL_OIDC_TOKEN ? 'vercel' : 'local', fileDir: env.REFRESCUE_FILE_DIR || '.refrescue/files', fileSigningSecret: env.REFRESCUE_FILE_SIGNING_SECRET || env.REFRESCUE_TOKEN || ''
  };
}
