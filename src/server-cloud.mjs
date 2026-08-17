import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { createEntitlementService } from './create-service.mjs';
import { handleMcpRequest } from './mcp.mjs';
const config = loadConfig();
if (!config.appToken || config.appToken.length < 24) throw new Error('REFRESCUE_TOKEN must be at least 24 characters');
const service = createEntitlementService(config);
function authorized(req) { const raw = String(req.headers.authorization || ''); if (!raw.startsWith('Bearer ')) return false; const supplied = Buffer.from(raw.slice(7)); const expected = Buffer.from(config.appToken); return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected); }
function sendJson(res, status, data) { const body = JSON.stringify(data); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) }); res.end(body); }
async function readJson(req, limit = 1_000_000) { const chunks = []; let total = 0; for await (const chunk of req) { total += chunk.length; if (total > limit) throw new Error('Request too large'); chunks.push(chunk); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
function validFileToken(id, token) { if (!config.fileSigningSecret) return false; const expected = crypto.createHmac('sha256', config.fileSigningSecret).update(id).digest('hex'); const a = Buffer.from(expected); const b = Buffer.from(String(token || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/') return sendJson(res, 200, { name: 'RefRescue Institutional Access', version: '0.2.0', role: 'entitlement-gateway', tools: ['entitlement_status','open_with_entitlement','download_with_entitlement'] });
    if (url.pathname === '/mcp') { if (!authorized(req)) return sendJson(res, 401, { error: 'Unauthorized' }); const body = req.method === 'POST' ? await readJson(req) : undefined; return handleMcpRequest(req, res, service, body); }
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) { const id = decodeURIComponent(url.pathname.slice('/files/'.length)); if (!validFileToken(id, url.searchParams.get('token'))) return sendJson(res, 401, { error: 'Unauthorized' }); const filePath = path.join(config.fileDir, path.basename(id)); const info = await stat(filePath); res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': info.size, 'content-disposition': `attachment; filename="${path.basename(id)}"` }); res.end(await readFile(filePath)); return; }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) { console.error(error); if (!res.headersSent) sendJson(res, 500, { error: error.message || 'Internal error' }); else res.end(); }
});
server.listen(config.port, config.host, () => console.log(`RefRescue cloud gateway listening on ${config.host}:${config.port}`));
