import { expect, test } from "vitest";
import {
  CodeRunSchema,
  DocumentSchema,
  EdgeSchema,
  NodeSchema,
  ReviewSchema,
  WorkspaceSchema,
} from "./index";

const now = "2026-10-26T00:00:00.000Z";

test("workspace accepts the stored shape", () => {
  expect(
    WorkspaceSchema.parse({
      id: "ws",
      name: "Main",
      createdAt: now,
      updatedAt: now,
    }),
  ).toMatchObject({ id: "ws", name: "Main" });
});

test("document accepts pdf and epub and rejects other media", () => {
  const base = {
    id: "d",
    workspaceId: "ws",
    storageKey: "uploads/ws/a.pdf",
    contentHash: "abc",
    title: "A",
    createdAt: now,
    updatedAt: now,
  };

  expect(DocumentSchema.parse({ ...base, mediaType: "pdf" }).mediaType).toBe(
    "pdf",
  );
  expect(
    DocumentSchema.parse({
      ...base,
      mediaType: "epub",
      storageKey: "uploads/ws/a.epub",
      deleted: true,
    }).deleted,
  ).toBe(true);
  expect(DocumentSchema.safeParse({ ...base, mediaType: "mobi" }).success).toBe(
    false,
  );
});

test("node accepts excerpt, note, and code payloads", () => {
  for (const type of ["excerpt", "note", "code"] as const) {
    expect(
      NodeSchema.parse({
        id: "n",
        workspaceId: "ws",
        documentId: "d",
        type,
        payload: { text: "hi" },
        anchor: { page: 1 },
        position: { x: 10, y: 20 },
        createdAt: now,
        updatedAt: now,
      }).type,
    ).toBe(type);
  }
});

test("edge and code run accept their stored shapes", () => {
  expect(
    EdgeSchema.parse({
      id: "e",
      workspaceId: "ws",
      fromNodeId: "a",
      toNodeId: "b",
      kind: "relates",
      createdAt: now,
      updatedAt: now,
    }).kind,
  ).toBe("relates");

  expect(
    CodeRunSchema.parse({
      id: "r",
      nodeId: "n",
      status: "queued",
      language: "python",
      source: "print(1)",
      stdin: "",
      createdAt: now,
      updatedAt: now,
    }),
  ).toMatchObject({ status: "queued", language: "python" });

  expect(
    CodeRunSchema.safeParse({
      id: "r",
      nodeId: "n",
      status: "queued",
      language: "ruby",
      source: "puts 1",
      createdAt: now,
      updatedAt: now,
    }).success,
  ).toBe(false);
});

test("review stores a due time and a simple interval", () => {
  expect(
    ReviewSchema.parse({
      id: "rev",
      workspaceId: "ws",
      nodeId: "n",
      dueAt: now,
      intervalDays: 1,
      createdAt: now,
      updatedAt: now,
    }),
  ).toMatchObject({ nodeId: "n", intervalDays: 1 });

  expect(
    ReviewSchema.safeParse({
      id: "rev",
      workspaceId: "ws",
      nodeId: "n",
      dueAt: now,
      intervalDays: 0,
      createdAt: now,
      updatedAt: now,
    }).success,
  ).toBe(false);
});

test("code run accepts timed_out and an optional workspace id", () => {
  expect(
    CodeRunSchema.parse({
      id: "r",
      workspaceId: "ws",
      nodeId: "n",
      status: "timed_out",
      language: "javascript",
      source: "console.log(1)",
      stdout: "",
      stderr: "killed",
      createdAt: now,
      updatedAt: now,
    }),
  ).toMatchObject({ status: "timed_out", workspaceId: "ws" });
});
