import { setTimeout as sleep } from 'node:timers/promises';

export class CdpConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const onOpen = () => { cleanup(); resolve(); };
      const onError = (event) => { cleanup(); reject(event.error ?? new Error('CDP WebSocket failed')); };
      const cleanup = () => {
        this.ws.removeEventListener('open', onOpen);
        this.ws.removeEventListener('error', onError);
      };
      this.ws.addEventListener('open', onOpen);
      this.ws.addEventListener('error', onError);
    });

    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message || 'CDP error'));
        else p.resolve(msg.result);
        return;
      }
      if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params ?? {});
      }
    });

    this.ws.addEventListener('close', () => {
      for (const [, p] of this.pending) p.reject(new Error('CDP connection closed'));
      this.pending.clear();
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
    return () => this.listeners.get(method)?.delete(fn);
  }

  async send(method, params = {}) {
    await this.connect();
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.ws?.close();
  }
}

export class ChromeBridge {
  constructor({ cdpUrl = 'http://127.0.0.1:9222', allowedHosts = [] } = {}) {
    this.cdpUrl = cdpUrl.replace(/\/$/, '');
    this.allowedHosts = allowedHosts;
    this.bridgeTargetId = null;
  }

  async _json(path, options = {}) {
    const res = await fetch(`${this.cdpUrl}${path}`, options);
    if (!res.ok) throw new Error(`Chrome CDP HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async status() {
    try {
      const version = await this._json('/json/version');
      const tabs = await this.listTabs();
      return {
        connected: true,
        browser: version.Browser,
        protocolVersion: version['Protocol-Version'],
        tabCount: tabs.length,
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async listTabs() {
    const targets = await this._json('/json/list');
    return targets
      .filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      .map((t) => ({ id: t.id, title: t.title, url: t.url, wsUrl: t.webSocketDebuggerUrl }));
  }

  async _newTab() {
    const target = await this._json('/json/new?about%3Ablank', { method: 'PUT' });
    this.bridgeTargetId = target.id;
    return target;
  }

  async _getTarget(targetId = null) {
    const tabs = await this.listTabs();
    if (targetId) {
      const found = tabs.find((t) => t.id === targetId);
      if (!found) throw new Error(`Browser tab not found: ${targetId}`);
      return found;
    }
    if (this.bridgeTargetId) {
      const found = tabs.find((t) => t.id === this.bridgeTargetId);
      if (found) return found;
    }
    const target = await this._newTab();
    return { id: target.id, title: target.title, url: target.url, wsUrl: target.webSocketDebuggerUrl };
  }

  async _session(targetId = null) {
    const target = await this._getTarget(targetId);
    const cdp = new CdpConnection(target.wsUrl);
    await cdp.connect();
    await Promise.all([
      cdp.send('Page.enable'),
      cdp.send('Runtime.enable'),
      cdp.send('Network.enable', { maxTotalBufferSize: 100_000_000, maxResourceBufferSize: 100_000_000 }),
    ]);
    return { target, cdp };
  }

  async navigate(url, { timeoutMs = 30000, targetId = null } = {}) {
    const { target, cdp } = await this._session(targetId);
    let documentResponse = null;
    const offResponse = cdp.on('Network.responseReceived', (event) => {
      if (event.type === 'Document' || event.response?.mimeType === 'application/pdf') {
        documentResponse = {
          requestId: event.requestId,
          url: event.response.url,
          mimeType: event.response.mimeType,
          status: event.response.status,
          headers: event.response.headers,
        };
      }
    });

    let loadResolved = false;
    const loadPromise = new Promise((resolve) => {
      const off = cdp.on('Page.loadEventFired', () => {
        if (loadResolved) return;
        loadResolved = true;
        off();
        resolve();
      });
    });

    try {
      const result = await cdp.send('Page.navigate', { url });
      if (result.errorText) throw new Error(result.errorText);
      await Promise.race([loadPromise, sleep(Math.min(timeoutMs, 12000))]);
      await sleep(500);

      const current = await this.evaluate(cdp, `({url: location.href, title: document.title, readyState: document.readyState})`);
      return { targetId: target.id, cdp, current, documentResponse };
    } catch (error) {
      cdp.close();
      throw error;
    } finally {
      offResponse();
    }
  }

  async evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    }
    return result.result?.value;
  }

  async readCurrent({ targetId = null, maxChars = 30000, includeLinks = true } = {}) {
    const { target, cdp } = await this._session(targetId);
    try {
      const payload = await this.evaluate(cdp, `(() => {
        const clean = (s) => (s || '').replace(/\\u00a0/g, ' ').replace(/[ \\t]+/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim();
        const root = document.querySelector('article') || document.querySelector('main') || document.body;
        const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 80).map(h => clean(h.innerText)).filter(Boolean);
        const links = ${includeLinks ? `[...document.querySelectorAll('a[href]')].slice(0, 150).map(a => ({text: clean(a.innerText || a.getAttribute('aria-label') || ''), href: a.href})).filter(x => x.href)` : '[]'};
        const meta = {};
        for (const m of document.querySelectorAll('meta[name],meta[property]')) {
          const key = m.getAttribute('name') || m.getAttribute('property');
          const value = m.getAttribute('content');
          if (key && value && /^(citation_|dc\.|og:|article:|description$)/i.test(key)) meta[key] = value;
        }
        return {
          url: location.href,
          title: document.title,
          text: clean(root?.innerText || document.body?.innerText || ''),
          headings,
          links,
          meta,
        };
      })()`);
      const fullText = payload?.text || '';
      return {
        targetId: target.id,
        ...payload,
        text: fullText.slice(0, maxChars),
        truncated: fullText.length > maxChars,
        totalChars: fullText.length,
      };
    } finally {
      cdp.close();
    }
  }

  async findInCurrent(query, { targetId = null, contextChars = 500, maxMatches = 20 } = {}) {
    const page = await this.readCurrent({ targetId, maxChars: 500000, includeLinks: false });
    const hay = page.text;
    const needle = query.toLowerCase();
    const lower = hay.toLowerCase();
    const matches = [];
    let at = 0;
    while (matches.length < maxMatches) {
      const i = lower.indexOf(needle, at);
      if (i < 0) break;
      const start = Math.max(0, i - contextChars);
      const end = Math.min(hay.length, i + query.length + contextChars);
      matches.push({ index: i, snippet: hay.slice(start, end) });
      at = i + Math.max(query.length, 1);
    }
    return { targetId: page.targetId, url: page.url, title: page.title, query, matches };
  }

  async getResponseBody(cdp, requestId) {
    const body = await cdp.send('Network.getResponseBody', { requestId });
    return body.base64Encoded ? Buffer.from(body.body, 'base64') : Buffer.from(body.body, 'binary');
  }

  async accessibilityText(cdp, maxChars = 50000) {
    const tree = await cdp.send('Accessibility.getFullAXTree');
    const chunks = [];
    for (const node of tree.nodes ?? []) {
      const role = node.role?.value;
      const name = node.name?.value;
      if (!name || typeof name !== 'string') continue;
      if (['StaticText', 'InlineTextBox', 'heading', 'paragraph', 'link'].includes(role)) chunks.push(name);
    }
    const text = chunks.join('\n').replace(/\n{3,}/g, '\n\n');
    return { text: text.slice(0, maxChars), truncated: text.length > maxChars, totalChars: text.length };
  }
}
