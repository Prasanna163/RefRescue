import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenApi } from '../src/openapi.mjs';

test('OpenAPI schema has action operations and bearer auth', () => {
  const spec = buildOpenApi('https://example.ngrok.app');
  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.servers[0].url, 'https://example.ngrok.app');
  assert.ok(spec.paths['/api/read-url'].post.operationId);
  assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
});
