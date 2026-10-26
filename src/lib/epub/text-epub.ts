const encoder = new TextEncoder();

export const SAMPLE_EPUB_CHAPTER_ONE = "EPUBPAGEONE";
export const SAMPLE_EPUB_CHAPTER_TWO = "EPUBEXCERPT";

const EPUB_MIME = "application/epub+zip";

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

export function buildTextEpub(chapters: readonly string[]): Uint8Array {
  if (chapters.length === 0) {
    throw new Error("epub needs a chapter");
  }

  const entries: ZipEntry[] = [
    { name: "mimetype", data: encoder.encode(EPUB_MIME) },
    { name: "META-INF/container.xml", data: encoder.encode(containerXml()) },
    { name: "OEBPS/content.opf", data: encoder.encode(packageDocument(chapters.length)) },
    { name: "OEBPS/toc.ncx", data: encoder.encode(tocNcx(chapters.length)) },
  ];

  chapters.forEach((text, index) => {
    const number = index + 1;
    entries.push({
      name: `OEBPS/chapter${number}.xhtml`,
      data: encoder.encode(chapterXhtml(number, text)),
    });
  });

  return buildStoredZip(entries);
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;
}

function packageDocument(chapterCount: number): string {
  const manifest = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];
  const spine = [];
  for (let number = 1; number <= chapterCount; number += 1) {
    manifest.push(
      `<item id="c${number}" href="chapter${number}.xhtml" media-type="application/xhtml+xml"/>`,
    );
    spine.push(`<itemref idref="c${number}"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>Sample EPUB</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">urn:uuid:read-sample-epub</dc:identifier>
  </metadata>
  <manifest>
    ${manifest.join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spine.join("\n    ")}
  </spine>
</package>
`;
}

function tocNcx(chapterCount: number): string {
  const points = [];
  for (let number = 1; number <= chapterCount; number += 1) {
    points.push(`<navPoint id="c${number}" playOrder="${number}">
      <navLabel><text>Chapter ${number}</text></navLabel>
      <content src="chapter${number}.xhtml"/>
    </navPoint>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:read-sample-epub"/>
  </head>
  <docTitle><text>Sample EPUB</text></docTitle>
  <navMap>
    ${points.join("\n    ")}
  </navMap>
</ncx>
`;
}

function chapterXhtml(number: number, text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>Chapter ${number}</title>
    <style>
      body { margin: 2rem; color: #111111; background: #ffffff; font: 24px/1.5 sans-serif; }
    </style>
  </head>
  <body>
    <p id="p${number}">${escapeXml(text)}</p>
  </body>
</html>
`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildStoredZip(entries: readonly ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + nameBytes.length + entry.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
