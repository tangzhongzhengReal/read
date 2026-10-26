import { expect, test } from "vitest";
import type { Edge, Node } from "@/src/lib/models";
import { toFlowEdges, toFlowNodes } from "./graph";

const now = "2026-10-26T00:00:00.000Z";

function node(partial: Partial<Node> & Pick<Node, "id" | "type" | "payload">): Node {
  return {
    workspaceId: "ws",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

test("workspace nodes become flow nodes and missing positions fall back on a grid", () => {
  const flow = toFlowNodes([
    node({
      id: "note-1",
      type: "note",
      payload: { text: "Hello" },
      position: { x: 12, y: 34 },
    }),
    node({
      id: "code-1",
      type: "code",
      payload: { language: "python", source: "print(1)" },
    }),
    node({
      id: "excerpt-1",
      type: "excerpt",
      payload: { text: "quoted" },
    }),
  ]);

  expect(flow[0]).toMatchObject({
    id: "note-1",
    type: "note",
    position: { x: 12, y: 34 },
    data: { text: "Hello", x: 12, y: 34 },
  });
  expect(flow[1]).toMatchObject({
    id: "code-1",
    type: "code",
    position: { x: 280, y: 0 },
    data: { language: "python", source: "print(1)", x: 280, y: 0 },
  });
  expect(flow[2]).toMatchObject({
    id: "excerpt-1",
    type: "excerpt",
    position: { x: 560, y: 0 },
    data: { text: "quoted", x: 560, y: 0 },
  });
});

test("edges use from and to node ids", () => {
  const edge: Edge = {
    id: "edge-1",
    workspaceId: "ws",
    fromNodeId: "note-1",
    toNodeId: "code-1",
    kind: "supports",
    createdAt: now,
    updatedAt: now,
  };
  expect(toFlowEdges([edge])).toEqual([
    {
      id: "edge-1",
      source: "note-1",
      target: "code-1",
      label: "supports",
      type: "mind",
      data: { kind: "supports" },
    },
  ]);
});
