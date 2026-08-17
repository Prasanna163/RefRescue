import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEntitlementUrl, hostAllowed } from '../src/entitlement/security.mjs';
test('allows known publisher subdomains', () => { assert.equal(hostAllowed('pubs.acs.org'), true); assert.equal(hostAllowed('onlinelibrary.wiley.com'), true); });
test('rejects arbitrary web and private URLs', () => { assert.throws(() => safeEntitlementUrl('https://example.com/a'), /allowlist/); assert.throws(() => safeEntitlementUrl('http://pubs.acs.org/a'), /HTTPS/); assert.throws(() => safeEntitlementUrl('https://127.0.0.1/a'), /private/); assert.throws(() => safeEntitlementUrl('https://user:pass@pubs.acs.org/a'), /Credentials/); });
