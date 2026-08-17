import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
function safeName(name) { return String(name || 'paper.pdf').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180); }
export class LocalFileStore {
  constructor({ dir = '.refrescue/files', publicBaseUrl = '', signingSecret = '' } = {}) { this.dir = dir; this.publicBaseUrl = publicBaseUrl.replace(/\/$/, ''); this.signingSecret = signingSecret; }
  async put({ bytes, filename, contentType, sourceUrl }) {
    await mkdir(this.dir, { recursive: true });
    const id = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName(filename)}`;
    const target = path.join(this.dir, id);
    await writeFile(target, bytes, { mode: 0o600 });
    const token = this.signingSecret ? crypto.createHmac('sha256', this.signingSecret).update(id).digest('hex') : '';
    return { storage: 'local', id, contentType, sourceUrl, downloadUrl: this.publicBaseUrl ? `${this.publicBaseUrl}/files/${encodeURIComponent(id)}${token ? `?token=${token}` : ''}` : null };
  }
}
export class VercelBlobStore {
  async put({ bytes, filename, contentType, sourceUrl }) {
    const { put } = await import('@vercel/blob');
    const key = `refrescue/${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName(filename)}`;
    const blob = await put(key, bytes, { access: 'public', contentType, addRandomSuffix: false });
    return { storage: 'vercel-blob', id: key, contentType, sourceUrl, downloadUrl: blob.url };
  }
}
