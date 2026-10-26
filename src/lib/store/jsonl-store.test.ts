import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { z } from "zod";
import { JsonlStore } from "./jsonl-store";

const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  deleted: z.boolean().optional(),
});

async function makeStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "read-jsonl-"));
  const filePath = path.join(dir, "items.jsonl");
  return {
    filePath,
    store: new JsonlStore({ filePath, schema: ItemSchema }),
  };
}

test("append then load shows the row", async () => {
  const { filePath, store } = await makeStore();
  await store.append({ id: "a", name: "one" });

  const loaded = new JsonlStore({ filePath, schema: ItemSchema });
  await expect(loaded.get("a")).resolves.toEqual({ id: "a", name: "one" });
});

test("a later row with the same id overwrites the earlier one", async () => {
  const { filePath, store } = await makeStore();
  await store.append({ id: "a", name: "one" });
  await store.append({ id: "a", name: "two" });

  const loaded = new JsonlStore({ filePath, schema: ItemSchema });
  await expect(loaded.get("a")).resolves.toEqual({ id: "a", name: "two" });

  const raw = await readFile(filePath, "utf8");
  expect(raw.trim().split("\n")).toHaveLength(2);
});

test("a deleted tombstone is hidden from get until compact", async () => {
  const { filePath, store } = await makeStore();
  await store.append({ id: "a", name: "one" });
  await store.softDelete("a");

  await expect(store.get("a")).resolves.toBeUndefined();
  const loaded = new JsonlStore({ filePath, schema: ItemSchema });
  await expect(loaded.get("a")).resolves.toBeUndefined();
  await expect(loaded.list()).resolves.toEqual([]);

  const raw = await readFile(filePath, "utf8");
  expect(raw).toContain('"deleted":true');
});

test("compact keeps only the latest live rows", async () => {
  const { filePath, store } = await makeStore();
  await store.append({ id: "a", name: "one" });
  await store.append({ id: "a", name: "two" });
  await store.append({ id: "b", name: "keep" });
  await store.softDelete("b");
  await store.append({ id: "c", name: "stay" });
  await store.compact();

  const raw = await readFile(filePath, "utf8");
  const lines = raw.trim().split("\n").map((line) => JSON.parse(line) as unknown);
  expect(lines).toEqual([
    { id: "a", name: "two" },
    { id: "c", name: "stay" },
  ]);

  const loaded = new JsonlStore({ filePath, schema: ItemSchema });
  await expect(loaded.list()).resolves.toEqual([
    { id: "a", name: "two" },
    { id: "c", name: "stay" },
  ]);
});

test("concurrent appends and compacts in one process do not drop rows", async () => {
  const { filePath, store } = await makeStore();
  const ids = Array.from({ length: 40 }, (_, index) => `id-${index}`);

  await Promise.all([
    ...ids.map((id) => store.append({ id, name: id })),
    store.compact(),
    store.compact(),
    store.compact(),
  ]);

  const loaded = new JsonlStore({ filePath, schema: ItemSchema });
  await expect(
    loaded.list().then((rows) => rows.map((row) => row.id).sort()),
  ).resolves.toEqual([...ids].sort());

  const raw = await readFile(filePath, "utf8");
  const lines = raw.trim() === "" ? [] : raw.trim().split("\n");
  expect(lines).toHaveLength(ids.length);
});

test("an invalid row is rejected and not written", async () => {
  const { filePath, store } = await makeStore();
  await expect(store.append({ id: "", name: "x" })).rejects.toThrow();
  await expect(readFile(filePath, "utf8")).rejects.toMatchObject({
    code: "ENOENT",
  });
});
