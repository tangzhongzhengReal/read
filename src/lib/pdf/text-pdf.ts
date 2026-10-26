const encoder = new TextEncoder();

export const SAMPLE_PAGE_ONE = "PAGEONEMARKER";
export const SAMPLE_PAGE_TWO = "EXCERPTTOKEN";

export function buildTextPdf(pages: readonly string[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error("pdf needs a page");
  }

  const chunks: Uint8Array[] = [];
  let cursor = 0;
  const offsets: number[] = [];

  const push = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    cursor += bytes.byteLength;
  };

  const object = (id: number, body: string) => {
    offsets[id] = cursor;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");

  const fontId = 3;
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pages.map((_, index) => 5 + index * 2);

  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  object(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((text, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    if (pageId === undefined || contentId === undefined) return;
    const stream = `BT\n/F1 24 Tf\n72 700 Td\n(${escapePdfText(text)}) Tj\nET\n`;
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    offsets[contentId] = cursor;
    push(
      `${contentId} 0 obj\n<< /Length ${encoder.encode(stream).byteLength} >>\nstream\n${stream}endstream\nendobj\n`,
    );
  });

  const lastId = contentIds[contentIds.length - 1];
  if (lastId === undefined) throw new Error("pdf needs a page");
  const size = lastId + 1;
  const xrefAt = cursor;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    const offset = offsets[id];
    if (offset === undefined) throw new Error(`missing pdf object ${id}`);
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(cursor);
  let written = 0;
  for (const chunk of chunks) {
    out.set(chunk, written);
    written += chunk.byteLength;
  }
  return out;
}

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
