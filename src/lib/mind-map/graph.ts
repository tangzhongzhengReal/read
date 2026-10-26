import type { Edge, Node } from "@/src/lib/models";

export type FlowNodeData = {
  text?: string;
  language?: string;
  source?: string;
  x: number;
  y: number;
  nodeType: Node["type"];
};

export type FlowNodeModel = {
  id: string;
  type: Node["type"];
  position: { x: number; y: number };
  data: FlowNodeData;
};

export type FlowEdgeModel = {
  id: string;
  source: string;
  target: string;
  label: string;
  type: "mind";
  data: { kind: string };
};

export function fallbackPosition(index: number): { x: number; y: number } {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: column * 280, y: row * 180 };
}

export function toFlowNodes(nodes: Node[]): FlowNodeModel[] {
  return nodes.map((node, index) => {
    const position = node.position ?? fallbackPosition(index);
    return {
      id: node.id,
      type: node.type,
      position,
      data: {
        text: typeof node.payload.text === "string" ? node.payload.text : undefined,
        language: typeof node.payload.language === "string" ? node.payload.language : undefined,
        source: typeof node.payload.source === "string" ? node.payload.source : undefined,
        x: position.x,
        y: position.y,
        nodeType: node.type,
      },
    };
  });
}

export function toFlowEdges(edges: Edge[]): FlowEdgeModel[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    label: edge.kind,
    type: "mind",
    data: { kind: edge.kind },
  }));
}
