import { readCardFields } from "@/src/lib/excerpt/card";
import type { HighlightMode } from "@/src/lib/excerpt/colors";
import type { Edge, Node } from "@/src/lib/models";

export type FlowNodeData = {
  text?: string;
  title?: string;
  comment?: string;
  language?: string;
  source?: string;
  color?: number;
  tags?: string[];
  highlight?: HighlightMode;
  collapsed?: boolean;
  asTitle?: boolean;
  anchor?: Record<string, unknown>;
  documentId?: string;
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
    const card = readCardFields(node.payload);
    return {
      id: node.id,
      type: node.type,
      position,
      data: {
        text: card.text || undefined,
        title: card.title,
        comment: card.comment,
        language: typeof node.payload.language === "string" ? node.payload.language : undefined,
        source: typeof node.payload.source === "string" ? node.payload.source : undefined,
        color: card.color,
        tags: card.tags,
        highlight: card.highlight,
        collapsed: card.collapsed,
        asTitle: card.asTitle,
        anchor: node.anchor,
        documentId: node.documentId,
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
