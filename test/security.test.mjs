import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHttpUrl, parseAllowedHosts } from '../src/security.mjs';

test('accepts public https URL', () => {
  assert.equal(safeHttpUrl('https://doi.org/10.1000/test').hostname, 'doi.org');
});

test('blocks localhost and private IPv4', () => {
  assert.throws(() => safeHttpUrl('http://localhost:3000/x'));
  assert.throws(() => safeHttpUrl('http://127.0.0.1:3000/x'));
  assert.throws(() => safeHttpUrl('http://192.168.1.10/x'));
});

test('host allowlist supports subdomains', () => {
  const allowed = parseAllowedHosts('acs.org, myloft.xyz');
  assert.equal(safeHttpUrl('https://pubs.acs.org/doi/x', allowed).hostname, 'pubs.acs.org');
  assert.throws(() => safeHttpUrl('https://example.com/x', allowed));
});
