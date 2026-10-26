import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

export type StoredRecord = {
  id: string;
  deleted?: boolean;
};

/**
 * Append-only JSONL collection kept in an in-memory Map.
 * A promise chain serializes writers in this process. It does not lock across processes.
 */
export class JsonlStore<T extends StoredRecord> {
  private readonly filePath: string;
  private readonly schema: z.ZodType<T>;
  private readonly records = new Map<string, T>();
  private loaded = false;
  private tail: Promise<void> = Promise.resolve();

  constructor(options: { filePath: string; schema: z.ZodType<T> }) {
    this.filePath = options.filePath;
    this.schema = options.schema;
  }

  async append(input: T): Promise<T> {
    const record = this.schema.parse(input);
    return this.withLock(async () => {
      await this.ensureLoaded();
      await this.writeLine(record);
      this.records.set(record.id, record);
      return record;
    });
  }

  async get(id: string): Promise<T | undefined> {
    return this.withLock(async () => {
      await this.ensureLoaded();
      const record = this.records.get(id);
      if (!record || record.deleted) return undefined;
      return record;
    });
  }

  async list(): Promise<T[]> {
    return this.withLock(async () => {
      await this.ensureLoaded();
      return [...this.records.values()].filter((record) => !record.deleted);
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.withLock(async () => {
      await this.ensureLoaded();
      const current = this.records.get(id);
      if (!current) {
        throw new Error(`record not found: ${id}`);
      }
      if (current.deleted) return;
      const tombstone = this.schema.parse({ ...current, deleted: true });
      await this.writeLine(tombstone);
      this.records.set(id, tombstone);
    });
  }

  async compact(): Promise<void> {
    await this.withLock(async () => {
      await this.ensureLoaded();
      const live = [...this.records.values()].filter((record) => !record.deleted);
      const body =
        live.map((record) => JSON.stringify(record)).join("\n") +
        (live.length > 0 ? "\n" : "");
      await this.replaceFile(body);
      this.records.clear();
      for (const record of live) this.records.set(record.id, record);
    });
  }

  private async withLock<R>(operation: () => Promise<R>): Promise<R> {
    const previous = this.tail;
    let release: () => void = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    let text = "";
    try {
      text = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    if (text.length > 0) {
      const lines = text.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]?.trim() ?? "";
        if (!line) continue;
        const record = this.schema.parse(parseJsonLine(this.filePath, index, line));
        this.records.set(record.id, record);
      }
    }

    this.loaded = true;
  }

  private async writeLine(record: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  private async replaceFile(body: string): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, body, "utf8");
    await rename(temporary, this.filePath);
  }
}

function parseJsonLine(filePath: string, index: number, line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    throw new Error(`Invalid JSONL at ${filePath}:${index + 1}`);
  }
}
