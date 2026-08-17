import Steel from 'steel-sdk';
import { chromium } from 'playwright';
import { extractPdfText } from '../pdf-text.mjs';
import { safeEntitlementUrl, validateFinalUrl } from './security.mjs';

function cleanText(text) {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function clamp(n, fallback, min, max) {
  const value = Number(n ?? fallback);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;
}

export class SteelEntitlementProvider {
  constructor({ apiKey, profileId, extensionId, allowedHosts, timeoutMs = 180000 } = {}) {
    this.apiKey = apiKey || '';
    this.profileId = profileId || '';
    this.extensionId = extensionId || '';
    this.allowedHosts = allowedHosts;
    this.timeoutMs = timeoutMs;
    this.client = this.apiKey ? new Steel({ steelAPIKey: this.apiKey }) : null;
  }
  async status() {
    return { provider: 'steel', configured: Boolean(this.client && this.profileId && this.extensionId), profileConfigured: Boolean(this.profileId), extensionConfigured: Boolean(this.extensionId), mode: 'on-demand cloud browser' };
  }
  _assertConfigured() {
    if (!this.client) throw new Error('STEEL_API_KEY is not configured');
    if (!this.profileId) throw new Error('STEEL_PROFILE_ID is not configured. Run the MyLOFT bootstrap flow first.');
    if (!this.extensionId) throw new Error('STEEL_MYLOFT_EXTENSION_ID is not configured. Upload the official MyLOFT extension first.');
  }
  async _withBrowser(fn) {
    this._assertConfigured();
    const session = await this.client.sessions.create({ profileId: this.profileId, persistProfile: true, extensionIds: [this.extensionId], timeout: this.timeoutMs });
    let browser;
    try {
      const ws = `wss://connect.steel.dev?apiKey=${encodeURIComponent(this.apiKey)}&sessionId=${encodeURIComponent(session.id)}`;
      browser = await chromium.connectOverCDP(ws);
      const context = browser.contexts()[0];
      const page = context.pages()[0] || await context.newPage();
      return await fn({ session, browser, context, page });
    } finally {
      try { await browser?.close(); } catch {}
      try { await this.client.sessions.release(session.id); } catch {}
    }
  }
  async open(urlInput, opts = {}) {
    const requested = safeEntitlementUrl(urlInput, this.allowedHosts).toString();
    const maxChars = clamp(opts.maxChars, 45000, 1000, 100000);
    const startPage = clamp(opts.startPage, 1, 1, 5000);
    const endPage = clamp(opts.endPage, Math.min(startPage + 29, 5000), startPage, Math.min(startPage + 99, 5000));
    return this._withBrowser(async ({ page, session }) => {
      const response = await page.goto(requested, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);
      const finalUrl = page.url();
      validateFinalUrl(finalUrl, this.allowedHosts);
      const contentType = String((await response?.headerValue('content-type')) || '').toLowerCase();
      const status = response?.status() || null;
      if (contentType.includes('application/pdf')) {
        const bytes = await response.body();
        const pdf = await extractPdfText(bytes, { maxChars, startPage, endPage });
        return { kind: 'pdf', requestedUrl: requested, finalUrl, status, contentType, sessionId: session.id, ...pdf };
      }
      const payload = await page.evaluate(() => {
        const root = document.querySelector('article') || document.querySelector('main') || document.body;
        const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 100).map(h => h.innerText?.trim()).filter(Boolean);
        const links = [...document.querySelectorAll('a[href]')].slice(0, 250).map(a => ({ text: (a.innerText || a.getAttribute('aria-label') || '').trim(), href: a.href })).filter(x => x.href);
        const meta = {};
        for (const m of document.querySelectorAll('meta[name],meta[property]')) {
          const key = m.getAttribute('name') || m.getAttribute('property');
          const value = m.getAttribute('content');
          if (key && value && /^(citation_|dc\.|og:|article:|description$)/i.test(key)) meta[key] = value;
        }
        return { title: document.title, text: root?.innerText || '', headings, links, meta };
      });
      const fullText = cleanText(payload.text);
      return { kind: 'html', requestedUrl: requested, finalUrl, status, contentType, title: payload.title, headings: payload.headings, links: payload.links, meta: payload.meta, text: fullText.slice(0, maxChars), truncated: fullText.length > maxChars, totalChars: fullText.length };
    });
  }
  async download(urlInput) {
    const requested = safeEntitlementUrl(urlInput, this.allowedHosts).toString();
    return this._withBrowser(async ({ page }) => {
      const response = await page.goto(requested, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const finalUrl = page.url();
      validateFinalUrl(finalUrl, this.allowedHosts);
      const contentType = String((await response?.headerValue('content-type')) || '').toLowerCase();
      if (!response || !contentType.includes('application/pdf')) throw new Error('The supplied URL did not resolve directly to a PDF. Open the article first and pass its publisher PDF/SI link.');
      const bytes = await response.body();
      return { requestedUrl: requested, finalUrl, contentType, filename: filenameFromResponse(response, finalUrl), bytes };
    });
  }
}
function filenameFromResponse(response, finalUrl) {
  const disposition = response.headers()['content-disposition'] || '';
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const basic = disposition.match(/filename="?([^";]+)"?/i);
  const raw = star?.[1] || basic?.[1] || new URL(finalUrl).pathname.split('/').pop() || 'paper.pdf';
  let name = decodeURIComponent(raw).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
  return name;
}
