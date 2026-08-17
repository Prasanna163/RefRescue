export class EntitlementService {
  constructor({ provider, fileStore = null } = {}) {
    if (!provider) throw new Error('provider is required');
    this.provider = provider;
    this.fileStore = fileStore;
  }
  status() { return this.provider.status(); }
  async openWithEntitlement(input) {
    if (!input?.url) throw new Error('url is required');
    return this.provider.open(input.url, input);
  }
  async downloadWithEntitlement(input) {
    if (!input?.url) throw new Error('url is required');
    const file = await this.provider.download(input.url);
    if (!this.fileStore) return { ...file, bytes: undefined, size: file.bytes.length, storage: 'not-configured' };
    const stored = await this.fileStore.put({ bytes: file.bytes, filename: file.filename, contentType: file.contentType || 'application/pdf', sourceUrl: file.finalUrl });
    return { requestedUrl: file.requestedUrl, finalUrl: file.finalUrl, filename: file.filename, contentType: file.contentType, size: file.bytes.length, ...stored };
  }
}
