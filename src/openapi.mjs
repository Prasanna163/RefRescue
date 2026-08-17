export function buildOpenApi(baseUrl) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'RefRescue MyLOFT Bridge',
      version: '0.1.0',
      description: 'Read-only access to papers opened through the user’s authenticated MyLOFT browser session. Never sends MyLOFT credentials or browser cookies to the API client.'
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' }
      },
      schemas: {
        ReadUrlRequest: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri', description: 'Publisher, DOI-resolved, or MyLOFT-accessible http(s) URL.' },
            maxChars: { type: 'integer', minimum: 1000, maximum: 60000, default: 30000 },
            startPage: { type: 'integer', minimum: 1, default: 1 },
            endPage: { type: 'integer', minimum: 1, default: 20 }
          }
        },
        OpenDoiRequest: {
          type: 'object',
          required: ['doi'],
          properties: {
            doi: { type: 'string', description: 'DOI such as 10.1021/acs.jpcb.5c01234' },
            maxChars: { type: 'integer', minimum: 1000, maximum: 60000, default: 30000 },
            startPage: { type: 'integer', minimum: 1, default: 1 },
            endPage: { type: 'integer', minimum: 1, default: 20 }
          }
        },
        ReadCurrentRequest: {
          type: 'object',
          properties: {
            targetId: { type: 'string' },
            maxChars: { type: 'integer', minimum: 1000, maximum: 60000, default: 30000 },
            includeLinks: { type: 'boolean', default: true }
          }
        },
        FindRequest: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string' },
            targetId: { type: 'string' },
            contextChars: { type: 'integer', minimum: 100, maximum: 2000, default: 500 }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/status': {
        get: {
          operationId: 'getBridgeStatus',
          summary: 'Check whether the dedicated Chrome/MyLOFT session is reachable.',
          responses: { '200': { description: 'Bridge status' } }
        }
      },
      '/api/tabs': {
        get: {
          operationId: 'listBrowserTabs',
          summary: 'List browser tabs in the dedicated RefRescue Chrome profile.',
          responses: { '200': { description: 'Tabs' } }
        }
      },
      '/api/read-url': {
        post: {
          operationId: 'readPaperUrl',
          summary: 'Open a paper URL in the authenticated browser and return readable HTML or PDF text.',
          description: 'Use this for publisher pages, PDF links, and supplementary-information links. It is read-only and only navigates the dedicated browser.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadUrlRequest' } } } },
          responses: { '200': { description: 'Extracted paper content' } }
        }
      },
      '/api/open-doi': {
        post: {
          operationId: 'readPaperByDoi',
          summary: 'Resolve a DOI in the authenticated browser and return readable article or PDF text.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OpenDoiRequest' } } } },
          responses: { '200': { description: 'Extracted paper content' } }
        }
      },
      '/api/read-current': {
        post: {
          operationId: 'readCurrentPaperPage',
          summary: 'Read the currently open article page and its useful links.',
          requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadCurrentRequest' } } } },
          responses: { '200': { description: 'Current page text and links' } }
        }
      },
      '/api/find': {
        post: {
          operationId: 'findInCurrentPaper',
          summary: 'Find a phrase inside the currently open article page.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FindRequest' } } } },
          responses: { '200': { description: 'Matching snippets' } }
        }
      }
    }
  };
}
