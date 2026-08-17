import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
function result(data) { return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
export function createMcpServer(service) {
  const server = new McpServer({ name: 'RefRescue Institutional Access', version: '0.2.0' }, { instructions: 'RefRescue is only an entitlement gateway. Do normal literature discovery yourself. Call it only when a specific scholarly publisher URL needs institutional full-text access or a user explicitly asks to retrieve its PDF.' });
  server.registerTool('entitlement_status', { title: 'Check institutional access', description: 'Check whether the MyLOFT entitlement gateway is configured. Does not search for papers.', inputSchema: z.object({}) }, async () => result(await service.status()));
  server.registerTool('open_with_entitlement', { title: 'Open scholarly URL with institutional entitlement', description: 'Open one specific scholarly publisher/DOI URL using the user’s authenticated MyLOFT entitlement. Use only after normal research identifies a URL whose full text is needed.', inputSchema: z.object({ url: z.string().url(), maxChars: z.number().int().min(1000).max(100000).optional(), startPage: z.number().int().min(1).optional(), endPage: z.number().int().min(1).optional() }) }, async args => result(await service.openWithEntitlement(args)));
  server.registerTool('download_with_entitlement', { title: 'Download scholarly PDF with institutional entitlement', description: 'Download one specific publisher PDF or supporting-information PDF that the user is entitled to access. This tool does not discover papers.', inputSchema: z.object({ url: z.string().url() }) }, async args => result(await service.downloadWithEntitlement(args)));
  return server;
}
export async function handleMcpRequest(req, res, service, parsedBody) {
  const server = createMcpServer(service);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try { await transport.handleRequest(req, res, parsedBody); } finally { await transport.close(); await server.close(); }
}
