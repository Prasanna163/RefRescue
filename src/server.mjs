import http from 'node:http';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { ChromeBridge } from './cdp.mjs';
import { extractPdfText } from './pdf.mjs';
import { buildOpenApi } from './openapi.mjs';
import { parseAllowedHosts, safeHttpUrl } from './security.mjs';

if (existsSync('.env')) {
  try { loadEnvFile('.env'); } catch (error) { console.error(`Could not load .env: ${error.message}`); }
}

const DEFAULT_ALLOWED_HOSTS = [
  'myloft.xyz', 'doi.org', 'acs.org', 'figshare.com',
  'sciencedirect.com', 'elsevier.com', 'els-cdn.com',
  'springer.com', 'springernature.com', 'nature.com',
  'wiley.com', 'tandfonline.com', 'taylorfrancis.com', 'rsc.org',
  'mdpi.com', 'frontiersin.org', 'sagepub.com', 'oup.com', 'cambridge.org',
  'ieee.org', 'acm.org', 'science.org', 'aaas.org', 'aip.org', 'aps.org', 'iop.org',
  'cell.com', 'thelancet.com', 'nejm.org', 'pnas.org', 'nih.gov',
  'arxiv.org', 'chemrxiv.org', 'biorxiv.org', 'medrxiv.org',
  'jstor.org', 'proquest.com', 'ebsco.com', 'ebscohost.com',
  'annualreviews.org', 'degruyter.com', 'emerald.com', 'worldscientific.com', 'optica.org'
];

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.REFRESCUE_TOKEN || '';
const CDP_URL = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
const configuredHosts = parseAllowedHosts(process.env.REFRESCUE_ALLOWED_HOSTS || '');
const ALLOWED_HOSTS = configuredHosts.length ? configuredHosts : DEFAULT_ALLOWED_HOSTS;

if (!TOKEN || TOKEN.length < 24) {
  console.error('REFRESCUE_TOKEN is required and must be at least 24 characters. Run `npm run token`.');
  process.exit(1);
}

const bridge = new ChromeBridge({ cdpUrl: CDP_URL, allowedHosts: ALLOWED_HOSTS });

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(data);
}

function isAuthorized(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const provided = auth.slice(7);
  const a = Buffer.from(TOKEN);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function publicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `${HOST}:${PORT}`;
  return `${proto}://${host}`;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

async function readUrl(urlInput, opts = {}) {
  const url = safeHttpUrl(urlInput, ALLOWED_HOSTS).toString();
  const maxChars = clampInt(opts.maxChars, 30000, 1000, 60000);
  const startPage = clampInt(opts.startPage, 1, 1, 5000);
  const endPage = clampInt(opts.endPage, 20, startPage, Math.min(startPage + 99, 5000));

  const nav = await bridge.navigate(url);
  try {
    const mime = (nav.documentResponse?.mimeType || '').toLowerCase();
    if (mime.includes('pdf') && nav.documentResponse?.requestId) {
      try {
        const bytes = await bridge.getResponseBody(nav.cdp, nav.documentResponse.requestId);
        const pdf = await extractPdfText(bytes, { startPage, endPage, maxChars });
        return {
          kind: 'pdf',
          targetId: nav.targetId,
          requestedUrl: url,
          finalUrl: nav.documentResponse.url || nav.current?.url,
          status: nav.documentResponse.status,
          mimeType: mime,
          pagesRequested: { startPage, endPage },
          ...pdf,
        };
      } catch (pdfError) {
        const ax = await bridge.accessibilityText(nav.cdp, maxChars);
        if (ax.totalChars > 100) {
          return {
            kind: 'pdf-accessibility',
            targetId: nav.targetId,
            requestedUrl: url,
            finalUrl: nav.documentResponse.url || nav.current?.url,
            status: nav.documentResponse.status,
            mimeType: mime,
            extractor: 'chrome-accessibility-tree',
            ...ax,
            warning: `Raw PDF extraction failed; used Chrome accessibility text instead: ${pdfError.message}`,
          };
        }
        throw pdfError;
      }
    }
  } finally {
    nav.cdp.close();
  }

  const page = await bridge.readCurrent({ targetId: nav.targetId, maxChars, includeLinks: true });
  return {
    kind: 'html',
    requestedUrl: url,
    finalUrl: page.url,
    ...page,
  };
}

const requestBuckets = new Map();
function rateLimited(req) {
  const key = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const current = requestBuckets.get(key);
  if (!current || current.minute !== minute) {
    requestBuckets.set(key, { minute, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 120;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (rateLimited(req)) return json(res, 429, { error: 'Rate limit exceeded' });

    if (req.method === 'GET' && url.pathname === '/') {
      return json(res, 200, {
        name: 'RefRescue MyLOFT Bridge',
        version: '0.1.0',
        mode: 'read-only',
        openapi: `${publicBaseUrl(req)}/openapi.json`,
      });
    }

    if (req.method === 'GET' && url.pathname === '/openapi.json') {
      return json(res, 200, buildOpenApi(publicBaseUrl(req)));
    }

    if (!url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
    if (!isAuthorized(req)) return json(res, 401, { error: 'Unauthorized' });

    if (req.method === 'GET' && url.pathname === '/api/status') {
      return json(res, 200, await bridge.status());
    }

    if (req.method === 'GET' && url.pathname === '/api/tabs') {
      return json(res, 200, { tabs: await bridge.listTabs() });
    }

    if (req.method === 'POST' && url.pathname === '/api/read-url') {
      const body = await readBody(req);
      if (!body.url) return json(res, 400, { error: 'url is required' });
      return json(res, 200, await readUrl(body.url, body));
    }

    if (req.method === 'POST' && url.pathname === '/api/open-doi') {
      const body = await readBody(req);
      if (!body.doi || typeof body.doi !== 'string') return json(res, 400, { error: 'doi is required' });
      const doi = body.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
      if (!/^10\.\d{4,9}\/.+/.test(doi)) return json(res, 400, { error: 'Invalid DOI format' });
      return json(res, 200, await readUrl(`https://doi.org/${encodeURI(doi)}`, body));
    }

    if (req.method === 'POST' && url.pathname === '/api/read-current') {
      const body = await readBody(req);
      const maxChars = clampInt(body.maxChars, 30000, 1000, 60000);
      const page = await bridge.readCurrent({ targetId: body.targetId || null, maxChars, includeLinks: body.includeLinks !== false });
      safeHttpUrl(page.url, ALLOWED_HOSTS);
      return json(res, 200, page);
    }

    if (req.method === 'POST' && url.pathname === '/api/find') {
      const body = await readBody(req);
      if (!body.query || typeof body.query !== 'string') return json(res, 400, { error: 'query is required' });
      const contextChars = clampInt(body.contextChars, 500, 100, 2000);
      const result = await bridge.findInCurrent(body.query, { targetId: body.targetId || null, contextChars });
      safeHttpUrl(result.url, ALLOWED_HOSTS);
      return json(res, 200, result);
    }

    return json(res, 404, { error: 'Unknown API route' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || 'Internal error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`RefRescue listening on http://${HOST}:${PORT}`);
  console.log(`Chrome CDP: ${CDP_URL}`);
  console.log('Read-only mode. No browser cookies or MyLOFT credentials are exposed by the API.');
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
