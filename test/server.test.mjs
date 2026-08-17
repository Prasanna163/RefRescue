import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

async function waitFor(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Server did not start: ${url}`);
}

test('HTTP server exposes schema and protects API', async (t) => {
  const port = 18787;
  const token = crypto.randomBytes(32).toString('base64url');
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), REFRESCUE_TOKEN: token, CHROME_CDP_URL: 'http://127.0.0.1:65534' },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  t.after(() => child.kill('SIGTERM'));

  await waitFor(`http://127.0.0.1:${port}/`);

  const schemaRes = await fetch(`http://127.0.0.1:${port}/openapi.json`);
  assert.equal(schemaRes.status, 200);
  const schema = await schemaRes.json();
  assert.equal(schema.openapi, '3.1.0');

  const unauth = await fetch(`http://127.0.0.1:${port}/api/status`);
  assert.equal(unauth.status, 401);

  const auth = await fetch(`http://127.0.0.1:${port}/api/status`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(auth.status, 200);
  const status = await auth.json();
  assert.equal(status.connected, false);
});
