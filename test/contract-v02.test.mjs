import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('MCP surface contains only entitlement capabilities', async () => { const source = await readFile(new URL('../src/mcp.mjs', import.meta.url), 'utf8'); for (const name of ['entitlement_status','open_with_entitlement','download_with_entitlement']) assert.match(source, new RegExp(name)); assert.doesNotMatch(source, /search_papers|search_myloft|recommend/i); });
