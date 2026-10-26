"use client";

import { useCallback, useContext, useEffect, useState, createContext } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  applyNodeChanges,
  getBezierPath,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import {
  toFlowEdges,
  toFlowNodes,
  type FlowNodeModel,
} from "@/src/lib/mind-map/graph";
import type { Edge as StoredEdge, Node as StoredNode } from "@/src/lib/models";

type MindData = {
  text?: string;
  language?: string;
  source?: string;
  x: number;
  y: number;
  nodeType: StoredNode["type"];
};

type MindNode = Node<MindData, "note" | "excerpt" | "code">;
type MindEdge = Edge<{ kind: string }, "mind">;

const WorkspaceContext = createContext("local");
const edgeKinds = ["relates", "supports", "contradicts"] as const;

function asFlowNode(model: FlowNodeModel): MindNode {
  return {
    id: model.id,
    type: model.type,
    position: model.position,
    data: model.data,
    style: { width: model.type === "code" ? 280 : 220 },
    dragHandle: model.type === "code" ? ".code-drag" : undefined,
  };
}

function TextNode({ id, data, type }: NodeProps<MindNode>) {
  return (
    <div
      data-testid="mind-node"
      data-node-id={id}
      data-node-type={type}
      data-x={data.x}
      data-y={data.y}
      className="select-none rounded-xl bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/10"
    >
      <Handle
        type="target"
        position={Position.Left}
        data-testid="node-target"
        className="!size-4 !border-2 !bg-background"
      />
      <div
        data-testid="note-drag"
        className="mb-2 cursor-grab px-1 py-2 text-xs font-medium text-muted-foreground"
      >
        {type === "excerpt" ? "摘录 · 拖动" : "笔记 · 拖动"}
      </div>
      <p className="pointer-events-none whitespace-pre-wrap">{data.text}</p>
      <Handle
        type="source"
        position={Position.Right}
        data-testid="node-source"
        className="!size-4 !border-2 !bg-primary"
      />
    </div>
  );
}

function CodeNode({ id, data }: NodeProps<MindNode>) {
  const workspaceId = useContext(WorkspaceContext);
  const [language, setLanguage] = useState(data.language ?? "python");
  const [source, setSource] = useState(data.source ?? "print(1+1)");
  const [status, setStatus] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("running");
    setStdout("");
    setStderr("");
    try {
      const response = await fetch("/api/code-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, nodeId: id, language, source }),
      });
      const body = (await response.json()) as {
        run?: { status: string; stdout?: string; stderr?: string };
        error?: string;
      };
      if (!response.ok || !body.run) {
        setStatus("failed");
        setStderr(body.error ?? "运行失败");
        return;
      }
      setStatus(body.run.status);
      setStdout(body.run.stdout ?? "");
      setStderr(body.run.stderr ?? "");
    } catch (error) {
      setStatus("failed");
      setStderr(error instanceof Error ? error.message : "运行失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="code-node"
      data-node-id={id}
      data-node-type="code"
      className="rounded-xl bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/10"
    >
      <Handle
        type="target"
        position={Position.Left}
        data-testid="node-target"
        className="!size-4 !border-2 !bg-background"
      />
      <div className="code-drag mb-2 flex cursor-grab items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">代码</span>
        <select
          data-testid="code-language"
          className="nodrag nopan rounded border border-border bg-background px-1 py-0.5 text-xs"
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value);
          }}
        >
          <option value="python">python</option>
          <option value="javascript">javascript</option>
          <option value="go">go</option>
        </select>
      </div>
      <textarea
        data-testid="code-source"
        className="nodrag nopan nowheel mb-2 h-24 w-full resize-none rounded border border-border bg-background p-2 font-mono text-xs"
        value={source}
        spellCheck={false}
        onChange={(event) => {
          setSource(event.target.value);
        }}
      />
      <button
        type="button"
        data-testid="run-code"
        className="nodrag rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
        disabled={busy}
        onClick={() => {
          void run();
        }}
      >
        运行
      </button>
      <p data-testid="code-status" className="mt-2 text-xs text-muted-foreground">
        {status}
      </p>
      <pre
        data-testid="code-stdout"
        className="mt-1 max-h-24 overflow-auto font-mono text-xs whitespace-pre-wrap"
      >
        {stdout}
      </pre>
      {stderr ? (
        <pre
          data-testid="code-stderr"
          className="mt-1 font-mono text-xs whitespace-pre-wrap text-destructive"
        >
          {stderr}
        </pre>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        data-testid="node-source"
        className="!size-4 !border-2 !bg-primary"
      />
    </div>
  );
}

function MindEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<MindEdge>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return (
    <path
      id={id}
      d={edgePath}
      data-testid="mind-edge"
      data-edge-id={id}
      className="react-flow__edge-path"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  );
}

const nodeTypes = {
  note: TextNode,
  excerpt: TextNode,
  code: CodeNode,
};

const edgeTypes = {
  mind: MindEdge,
};

export default function MindMapCanvas({ workspaceId }: { workspaceId: string }) {
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [edges, setEdges] = useState<MindEdge[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapState, setMapState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nodeResponse, edgeResponse] = await Promise.all([
          fetch(`/api/nodes?workspaceId=${encodeURIComponent(workspaceId)}`),
          fetch(`/api/edges?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        if (!nodeResponse.ok || !edgeResponse.ok) throw new Error("无法打开脑图");
        const nodeBody = (await nodeResponse.json()) as { nodes: StoredNode[] };
        const edgeBody = (await edgeResponse.json()) as { edges: StoredEdge[] };
        if (cancelled) return;
        setNodes(toFlowNodes(nodeBody.nodes).map(asFlowNode));
        setEdges(toFlowEdges(edgeBody.edges));
        setReady(true);
      } catch {
        if (!cancelled) setError("无法打开脑图。");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const onNodesChange = useCallback((changes: NodeChange<MindNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  async function addNode(type: "note" | "code") {
    const position = { x: 40 + (nodes.length % 4) * 300, y: 80 };
    const payload =
      type === "note"
        ? { text: `笔记 ${nodes.length + 1}` }
        : { language: "python" as const, source: "print(1+1)" };
    setMapState("saving");
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, type, payload, position }),
    });
    if (!response.ok) {
      setMapState("error");
      return;
    }
    const body = (await response.json()) as { node: StoredNode };
    const model = toFlowNodes([body.node])[0];
    if (!model) {
      setMapState("error");
      return;
    }
    setNodes((current) => [...current, asFlowNode(model)]);
    setMapState("saved");
  }

  async function onNodeDragStop(_event: MouseEvent | TouchEvent, node: MindNode) {
    const position = { x: node.position.x, y: node.position.y };
    setMapState("saving");
    const response = await fetch(`/api/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, position }),
    });
    if (!response.ok) {
      setMapState("error");
      return;
    }
    setNodes((current) =>
      current.map((item) =>
        item.id === node.id
          ? {
              ...item,
              position,
              data: { ...item.data, x: position.x, y: position.y },
            }
          : item,
      ),
    );
    setMapState("saved");
  }

  async function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setMapState("saving");
    const response = await fetch("/api/edges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        fromNodeId: connection.source,
        toNodeId: connection.target,
        kind: "relates",
      }),
    });
    if (!response.ok) {
      setMapState("error");
      return;
    }
    const body = (await response.json()) as { edge: StoredEdge };
    setEdges((current) => [...current, ...toFlowEdges([body.edge])]);
    setMapState("saved");
  }

  async function updateKind(id: string, kind: string) {
    setMapState("saving");
    const response = await fetch(`/api/edges/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, kind }),
    });
    if (!response.ok) {
      setMapState("error");
      return;
    }
    setEdges((current) =>
      current.map((edge) =>
        edge.id === id ? { ...edge, label: kind, data: { kind } } : edge,
      ),
    );
    setMapState("saved");
  }

  async function removeEdge(id: string) {
    setMapState("saving");
    const response = await fetch(
      `/api/edges/${id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setMapState("error");
      return;
    }
    setEdges((current) => current.filter((edge) => edge.id !== id));
    setMapState("saved");
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!ready) return <p className="text-sm text-muted-foreground">正在打开脑图…</p>;

  return (
    <WorkspaceContext.Provider value={workspaceId}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="add-note"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              void addNode("note");
            }}
          >
            新建笔记
          </button>
          <button
            type="button"
            data-testid="add-code-node"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
            onClick={() => {
              void addNode("code");
            }}
          >
            新建代码
          </button>
          <p data-testid="map-status" data-state={mapState} className="text-xs text-muted-foreground">
            {mapState === "saving"
              ? "保存中…"
              : mapState === "saved"
                ? "已保存"
                : mapState === "error"
                  ? "保存失败"
                  : "拖动笔记，从圆点拖到另一张卡片即可连线。"}
          </p>
        </div>
        <div className="h-[640px] overflow-hidden rounded-xl ring-1 ring-foreground/10" data-testid="mind-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            connectionRadius={48}
            deleteKeyCode={null}
            fitView={false}
          >
            <Background />
          </ReactFlow>
        </div>
        <ul className="flex flex-col gap-2" data-testid="edge-list">
          {edges.map((edge) => (
            <li key={edge.id} data-testid="edge-row" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {edge.source.slice(0, 8)} → {edge.target.slice(0, 8)}
              </span>
              <select
                data-testid="edge-kind"
                className="rounded border border-border bg-background px-2 py-1"
                value={edge.data?.kind ?? "relates"}
                onChange={(event) => {
                  void updateKind(edge.id, event.target.value);
                }}
              >
                {edgeKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="delete-edge"
                className="rounded border border-border px-2 py-1"
                onClick={() => {
                  void removeEdge(edge.id);
                }}
              >
                删除连线
              </button>
            </li>
          ))}
        </ul>
      </div>
    </WorkspaceContext.Provider>
  );
}
