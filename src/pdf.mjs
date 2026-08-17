import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function extractPdfText(buffer, { startPage = 1, endPage = 20, maxChars = 60000 } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'refrescue-'));
  const pdfPath = path.join(dir, 'paper.pdf');
  try {
    await writeFile(pdfPath, buffer);
    const args = ['-enc', 'UTF-8', '-f', String(startPage), '-l', String(endPage), '-layout', pdfPath, '-'];
    const { stdout } = await execFileAsync('pdftotext', args, { maxBuffer: 20 * 1024 * 1024 });
    const text = stdout.replace(/\f/g, '\n\n--- PAGE BREAK ---\n\n').trim();
    return {
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
      totalChars: text.length,
      extractor: 'pdftotext',
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('PDF text extraction requires the `pdftotext` command (Poppler). Install Poppler, then retry.');
    }
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
