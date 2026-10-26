import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

export function getUploadsDir(): string {
  return process.env.READ_UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
}

export function maxUploadBytes(): number {
  const raw = process.env.READ_MAX_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_UPLOAD_BYTES;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_UPLOAD_BYTES;
  return value;
}

export function resolveUploadPath(storageKey: string): string {
  if (!storageKey || path.isAbsolute(storageKey) || storageKey.includes("\0")) {
    throw new Error("invalid storage key");
  }
  const root = path.resolve(getUploadsDir());
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("invalid storage key");
  }
  return target;
}

export async function writeUpload(
  storageKey: string,
  bytes: Uint8Array,
): Promise<string> {
  const target = resolveUploadPath(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return target;
}
