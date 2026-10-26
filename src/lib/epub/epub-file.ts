const EPUB_MIME = "application/epub+zip";
const MIME_NAME = "mimetype";

export function isEpubUpload(bytes: Uint8Array, file: { type: string; name: string }): boolean {
  if (!declaredEpub(file)) return false;
  return isEpubPackage(bytes);
}

function declaredEpub(file: { type: string; name: string }): boolean {
  const type = file.type.trim().toLowerCase();
  if (type === "application/epub+zip" || type === "application/epub") return true;
  if (!file.name.toLowerCase().endsWith(".epub")) return false;
  return type === "" || type === "application/octet-stream" || type === "application/zip";
}

export function isEpubPackage(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 30 + MIME_NAME.length + EPUB_MIME.length) return false;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return false;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(8, true) !== 0) return false;
  if (view.getUint32(18, true) !== EPUB_MIME.length) return false;
  if (view.getUint32(22, true) !== EPUB_MIME.length) return false;

  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  if (nameLength !== MIME_NAME.length) return false;

  const name = Buffer.from(bytes.subarray(30, 30 + nameLength)).toString("utf8");
  if (name !== MIME_NAME) return false;

  const dataStart = 30 + nameLength + extraLength;
  const dataEnd = dataStart + EPUB_MIME.length;
  if (dataEnd > bytes.byteLength) return false;
  return Buffer.from(bytes.subarray(dataStart, dataEnd)).toString("utf8") === EPUB_MIME;
}
