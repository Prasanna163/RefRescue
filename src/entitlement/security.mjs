import net from 'node:net';

export const DEFAULT_ALLOWED_HOSTS = [
  'myloft.xyz', 'doi.org', 'acs.org', 'pubs.acs.org', 'figshare.com',
  'sciencedirect.com', 'elsevier.com', 'els-cdn.com',
  'springer.com', 'link.springer.com', 'springernature.com', 'nature.com',
  'wiley.com', 'onlinelibrary.wiley.com', 'tandfonline.com', 'taylorfrancis.com',
  'rsc.org', 'pubs.rsc.org', 'mdpi.com', 'frontiersin.org', 'sagepub.com',
  'oup.com', 'cambridge.org', 'ieee.org', 'ieeexplore.ieee.org', 'acm.org',
  'science.org', 'aaas.org', 'aip.org', 'aps.org', 'iop.org', 'cell.com',
  'thelancet.com', 'nejm.org', 'pnas.org', 'nih.gov', 'ncbi.nlm.nih.gov',
  'arxiv.org', 'chemrxiv.org', 'biorxiv.org', 'medrxiv.org', 'jstor.org',
  'proquest.com', 'ebsco.com', 'ebscohost.com', 'annualreviews.org',
  'degruyter.com', 'emerald.com', 'worldscientific.com', 'optica.org'
];

export function parseAllowedHosts(raw = '') {
  return String(raw).split(',').map(x => x.trim().toLowerCase().replace(/^\.+/, '')).filter(Boolean);
}

export function hostAllowed(hostname, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return allowedHosts.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}

export function isPrivateIpLiteral(hostname) {
  const family = net.isIP(hostname);
  if (!family) return false;
  if (family === 4) {
    const [a, b] = hostname.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const h = hostname.toLowerCase();
  return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb');
}

export function safeEntitlementUrl(input, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Invalid URL'); }
  if (url.protocol !== 'https:') throw new Error('Only HTTPS publisher URLs are allowed');
  if (url.username || url.password) throw new Error('Credentials in URLs are not allowed');
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || isPrivateIpLiteral(url.hostname)) throw new Error('Local/private addresses are not allowed');
  if (!hostAllowed(url.hostname, allowedHosts)) throw new Error(`Host is not on the scholarly-resource allowlist: ${url.hostname}`);
  url.hash = '';
  return url;
}

export function validateFinalUrl(input, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  return safeEntitlementUrl(input, allowedHosts);
}
