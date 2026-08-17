import net from 'node:net';
import crypto from 'node:crypto';

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export function safeHttpUrl(input, allowedHosts = []) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs are allowed');
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Localhost URLs are blocked');
  }

  const ipType = net.isIP(host);
  if (ipType === 4 && PRIVATE_V4.some((rx) => rx.test(host))) {
    throw new Error('Private IPv4 URLs are blocked');
  }
  if (ipType === 6) {
    const h = host.replace(/^\[|\]$/g, '').toLowerCase();
    if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) {
      throw new Error('Private IPv6 URLs are blocked');
    }
  }

  if (allowedHosts.length) {
    const ok = allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    if (!ok) throw new Error(`Host not allow-listed: ${host}`);
  }

  return url;
}

export function parseAllowedHosts(value = '') {
  return value
    .split(',')
    .map((x) => x.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
}

export function timingSafeTokenMatch(expected, provided) {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
