export async function extractPdfText(buffer, { maxChars = 60000, startPage = 1, endPage = 30 } = {}) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const pages = [];
    for (let i = startPage; i <= endPage; i += 1) pages.push(i);
    const result = await parser.getText({ partial: pages });
    const text = String(result.text || '');
    return { text: text.slice(0, maxChars), truncated: text.length > maxChars, totalChars: text.length, pageRange: { startPage, endPage } };
  } finally {
    await parser.destroy();
  }
}
