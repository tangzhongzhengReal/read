"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  createContext,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Handle,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { cardExtras } from "@/src/lib/excerpt/card";
import { POPOVER_COLOR_IDS, excerptColor, titleBarColor } from "@/src/lib/excerpt/colors";
import { hiddenNodeIds } from "@/src/lib/mind-map/collapse";
import { orthogonalEdgePath } from "@/src/lib/mind-map/edge-path";
import {
  toFlowEdges,
  toFlowNodes,
  type FlowNodeData,
  type FlowNodeModel,
} from "@/src/lib/mind-map/graph";
import type { Edge as StoredEdge, Node as StoredNode } from "@/src/lib/models";

type MindData = FlowNodeData;
type MindNode = Node<MindData, "note" | "excerpt" | "code">;
type MindEdge = Edge<{ kind: string }, "mind">;

type CardActions = {
  selectedId: string | null;
  onCollapse: (id: string) => void;
  onColor: (id: string, color: number) => void;
  onTag: (id: string, tag: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onEdit: (id: string, patch: { text?: string; title?: string }) => void;
  saveNotice: { id: string; label: string } | null;
};

const WorkspaceContext = createContext("local");
const CardContext = createContext<CardActions | null>(null);
const edgeKinds = ["relates", "supports", "contradicts", "child"] as const;

function asFlowNode(model: FlowNodeModel): MindNode {
  return {
    id: model.id,
    type: model.type,
    position: model.position,
    data: model.data,
    style: { width: model.type === "code" ? 280 : 240 },
    dragHandle: model.type === "code" ? ".code-drag" : "[data-testid='note-drag']",
  };
}

function payloadFrom(data: MindData, patch: Partial<MindData> = {}): Record<string, unknown> {
  const next = { ...data, ...patch };
  const extras = cardExtras({
    text: next.text,
    title: next.title,
    comment: next.comment,
    color: next.color,
    tags: next.tags,
    highlight: next.highlight,
    collapsed: next.collapsed,
    asTitle: next.asTitle,
  });
  if (data.nodeType === "code") {
    return {
      language: next.language ?? "python",
      source: next.source ?? "",
      ...extras,
    };
  }
  return { text: next.text ?? "", ...extras };
}

function CardChrome({
  id,
  data,
  type,
  selected,
  children,
  titleNode,
  onTitleDoubleClick,
  saveLabel,
}: {
  id: string;
  data: MindData;
  type: string | undefined;
  selected: boolean;
  children: ReactNode;
  titleNode?: ReactNode;
  onTitleDoubleClick?: () => void;
  saveLabel?: string | null;
}) {
  const actions = useContext(CardContext);
  const colorId = data.color ?? (type === "excerpt" ? 1 : type === "code" ? 14 : 3);
  const swatch = excerptColor(colorId);
  const title = data.title || (type === "excerpt" ? "摘录" : type === "code" ? "代码" : "笔记");
  return (
    <div
      data-testid={type === "code" ? undefined : "mind-node"}
      data-node-id={id}
      data-node-type={type}
      data-x={data.x}
      data-y={data.y}
      data-selected={selected ? "true" : "false"}
      data-color={String(colorId)}
      data-collapsed={data.collapsed ? "true" : "false"}
      className="relative rounded-lg bg-white text-sm text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
      style={{ outline: selected ? "2px dashed #2233D9" : undefined, outlineOffset: 3 }}
    >
      {selected && actions ? (
        <CardPopup nodeId={id} colorId={colorId} actions={actions} />
      ) : null}
      <div
        className="flex items-center gap-2 rounded-t-lg pr-2"
        style={{ background: titleBarColor(swatch.hex) }}
      >
        <div
          data-testid={type === "code" ? undefined : "note-drag"}
          className={`${type === "code" ? "code-drag" : ""} min-w-0 flex-1 cursor-grab px-3 py-2`}
        >
          {titleNode ?? (
            <span
              data-testid="note-title"
              className="block truncate text-xs font-semibold"
              title="双击编辑标题"
              onDoubleClick={(event) => {
                event.stopPropagation();
                onTitleDoubleClick?.();
              }}
            >
              {title}
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="node-collapse"
          data-card-control="true"
          aria-label={data.collapsed ? "展开" : "折叠"}
          className="nodrag nopan grid size-5 shrink-0 place-items-center rounded-full bg-white/80 text-xs font-semibold"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            actions?.onCollapse(id);
          }}
        >
          {data.collapsed ? "+" : "−"}
        </button>
      </div>
      {data.collapsed ? null : children}
      {saveLabel ? (
        <p data-testid="note-save-status" aria-live="polite" className="px-3 pb-2 text-[11px] text-[#8E8E93]">
          {saveLabel}
        </p>
      ) : null}
      <Handle type="target" position={Position.Left} data-testid="node-target" className="!size-4 !border-2 !bg-white" />
      <Handle type="source" position={Position.Right} data-testid="node-source" className="!size-4 !border-2 !bg-[#4894F3]" />
    </div>
  );
}

function CardPopup({
  nodeId,
  colorId,
  actions,
}: {
  nodeId: string;
  colorId: number;
  actions: CardActions;
}) {
  const [tag, setTag] = useState("");
  return (
    <div
      data-testid="card-popup"
      data-card-control="true"
      className="nodrag nopan nowheel absolute top-[calc(100%+8px)] left-1/2 z-20 w-64 -translate-x-1/2 rounded-2xl bg-menu-dark p-2 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
    >
      <p className="px-1 pb-1 text-[10px] tracking-wide text-white/60">基础</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" data-testid="card-add-child" className="rounded-lg bg-white/10 px-2 py-1 text-xs" onClick={() => actions.onAddChild(nodeId)}>
          新建子
        </button>
        <button type="button" data-testid="card-add-sibling" className="rounded-lg bg-white/10 px-2 py-1 text-xs" onClick={() => actions.onAddSibling(nodeId)}>
          新建兄弟
        </button>
        <button type="button" data-testid="card-delete" className="rounded-lg bg-white/10 px-2 py-1 text-xs" onClick={() => actions.onDelete(nodeId)}>
          删除
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {POPOVER_COLOR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            data-testid="card-color"
            data-color={id}
            aria-label={excerptColor(id).name}
            className="size-5 rounded"
            style={{
              background: excerptColor(id).hex,
              outline: colorId === id ? "2px solid #fff" : "1px solid rgba(255,255,255,.3)",
            }}
            onClick={() => actions.onColor(nodeId, id)}
          />
        ))}
      </div>
      <form
        className="mt-2 flex gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          const value = tag.trim();
          if (!value) return;
          actions.onTag(nodeId, value);
          setTag("");
        }}
      >
        <input
          data-testid="card-tag-input"
          className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1 text-xs text-[#1C1C1E]"
          value={tag}
          placeholder="标签"
          onChange={(event) => setTag(event.target.value)}
        />
      </form>
    </div>
  );
}

function TextNode({ id, data, type, selected }: NodeProps<MindNode>) {
  const actions = useContext(CardContext);
  const [mode, setMode] = useState<null | "title" | "body">(null);
  const [draft, setDraft] = useState("");
  const editingRef = useRef(false);
  const cancelRef = useRef(false);
  const isSelected = Boolean(selected);

  useEffect(() => {
    if (!isSelected || mode) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "F2") return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      cancelRef.current = false;
      editingRef.current = true;
      setDraft(data.text ?? "");
      setMode("body");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.text, isSelected, mode]);

  function begin(next: "title" | "body") {
    cancelRef.current = false;
    editingRef.current = true;
    setDraft(next === "title" ? (data.title ?? "") : (data.text ?? ""));
    setMode(next);
  }

  function cancelEdit() {
    cancelRef.current = true;
    editingRef.current = false;
    setMode(null);
  }

  function commit(which: "title" | "body") {
    if (!editingRef.current || cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    editingRef.current = false;
    setMode(null);
    if (which === "title") {
      const title = draft.trim().slice(0, 250);
      if (title === (data.title ?? "")) return;
      actions?.onEdit(id, { title });
      return;
    }
    const text = draft.trim();
    if (!text || text === (data.text ?? "")) return;
    actions?.onEdit(id, { text });
  }

  const editorStop = {
    onPointerDown: (event: ReactPointerEvent) => event.stopPropagation(),
    onMouseDown: (event: ReactMouseEvent) => event.stopPropagation(),
  };

  const titleEditor =
    mode === "title" ? (
      <input
        data-testid="note-title-editor"
        data-card-control="true"
        className="nodrag nopan nowheel w-full rounded border border-[#4894F3] bg-white px-1 py-0.5 text-xs font-semibold text-[#1C1C1E] outline-none"
        value={draft}
        autoFocus
        placeholder="标题"
        aria-label="标题"
        {...editorStop}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit("title")}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelEdit();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            commit("title");
          }
        }}
      />
    ) : undefined;

  return (
    <CardChrome
      id={id}
      data={data}
      type={type}
      selected={isSelected}
      titleNode={titleEditor}
      onTitleDoubleClick={() => begin("title")}
      saveLabel={actions?.saveNotice?.id === id ? actions.saveNotice.label : null}
    >
      <div className="px-3 py-2">
        {mode === "body" ? (
          <div className="flex flex-col gap-1">
            <textarea
              data-testid="note-editor"
              data-card-control="true"
              className="nodrag nopan nowheel h-24 w-full resize-none rounded border border-[#4894F3] bg-white p-1 text-sm outline-none"
              value={draft}
              autoFocus
              placeholder="正文"
              aria-label="正文"
              {...editorStop}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => commit("body")}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelEdit();
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  commit("body");
                }
              }}
            />
            <button
              type="button"
              data-testid="note-save"
              data-card-control="true"
              className="nodrag nopan ml-auto inline-flex min-h-11 items-center rounded-lg bg-[#4894F3] px-3 text-xs font-medium text-white"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit("body")}
            >
              保存
            </button>
          </div>
        ) : (
          <p
            data-testid="note-body"
            className="cursor-text whitespace-pre-wrap"
            title="双击编辑正文，或选中后按 F2"
            onDoubleClick={(event) => {
              event.stopPropagation();
              begin("body");
            }}
          >
            {data.text}
          </p>
        )}
        {data.comment ? (
          <p data-testid="node-comment" className="mt-1 text-xs text-[#8E8E93]">
            {data.comment}
          </p>
        ) : null}
        {data.tags && data.tags.length > 0 ? (
          <p data-testid="node-tags" className="mt-1 text-xs text-[#2F6FEB]">
            {data.tags.map((tag) => `#${tag}`).join(" ")}
          </p>
        ) : null}
      </div>
    </CardChrome>
  );
}

function CodeNode({ id, data, selected }: NodeProps<MindNode>) {
  const workspaceId = useContext(WorkspaceContext);
  const [language, setLanguage] = useState(data.language ?? "python");
  const [source, setSource] = useState(data.source ?? "print(1+1)");
  const [status, setStatus] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/code-runs?workspaceId=${encodeURIComponent(workspaceId)}&nodeId=${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          runs: Array<{ status: string; stdout?: string; stderr?: string }>;
        };
        const latest = body.runs.at(-1);
        if (!latest || cancelled) return;
        setStatus(latest.status);
        setStdout(latest.stdout ?? "");
        setStderr(latest.stderr ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, workspaceId]);

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
    <div data-testid="code-node" data-node-id={id} data-node-type="code">
      <CardChrome id={id} data={data} type="code" selected={Boolean(selected)}>
        <div className="px-3 py-2">
          <select
            data-testid="code-language"
            className="nodrag nopan mb-2 rounded border border-[#E6E6E6] bg-white px-1 py-0.5 text-xs"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="python">python</option>
            <option value="javascript">javascript</option>
            <option value="go">go</option>
          </select>
          <textarea
            data-testid="code-source"
            className="nodrag nopan nowheel mb-2 h-24 w-full resize-none rounded border border-[#E6E6E6] bg-white p-2 font-mono text-xs"
            value={source}
            spellCheck={false}
            onChange={(event) => setSource(event.target.value)}
          />
          <button
            type="button"
            data-testid="run-code"
            className="nodrag rounded bg-[#4894F3] px-2 py-1 text-xs text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void run()}
          >
            运行
          </button>
          <p data-testid="code-status" className="mt-2 text-xs text-[#8E8E93]">
            {status}
          </p>
          <pre data-testid="code-stdout" className="mt-1 max-h-24 overflow-auto font-mono text-xs whitespace-pre-wrap">
            {stdout}
          </pre>
          {stderr ? (
            <pre data-testid="code-stderr" className="mt-1 font-mono text-xs whitespace-pre-wrap text-destructive">
              {stderr}
            </pre>
          ) : null}
        </div>
      </CardChrome>
    </div>
  );
}

function MindEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<MindEdge>) {
  const edgePath = orthogonalEdgePath(sourceX, sourceY, targetX, targetY);
  return (
    <path
      id={id}
      d={edgePath}
      data-testid="mind-edge"
      data-edge-id={id}
      className="react-flow__edge-path"
      fill="none"
      stroke="#7A8494"
      strokeWidth={1.75}
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

export default function MindMapCanvas({
  workspaceId,
  fill = false,
  focusNodeId = null,
  focusToken = 0,
  revision = 0,
  onNodeActivate,
}: {
  workspaceId: string;
  fill?: boolean;
  focusNodeId?: string | null;
  focusToken?: number;
  revision?: number;
  onNodeActivate?: (node: { id: string; documentId?: string; anchor?: Record<string, unknown> }) => void;
}) {
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [edges, setEdges] = useState<MindEdge[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapState, setMapState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<{ id: string; label: string } | null>(null);
  const [appliedFocus, setAppliedFocus] = useState(0);
  if (
    focusToken !== 0 &&
    focusNodeId &&
    focusToken !== appliedFocus &&
    nodes.some((node) => node.id === focusNodeId)
  ) {
    setAppliedFocus(focusToken);
    setSelectedId(focusNodeId);
  }

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
  }, [workspaceId, revision]);

  const onNodesChange = useCallback((changes: NodeChange<MindNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  async function patchNode(id: string, patch: Partial<MindData>, announce = false) {
    const current = nodes.find((node) => node.id === id);
    if (!current) return;
    const nextData = { ...current.data, ...patch };
    if ("title" in patch) {
      const title = typeof patch.title === "string" ? patch.title.trim().slice(0, 250) : "";
      nextData.title = title || undefined;
    }
    setMapState("saving");
    if (announce) setSaveNotice({ id, label: "保存中…" });
    const response = await fetch(`/api/nodes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, payload: payloadFrom(current.data, nextData) }),
    });
    if (!response.ok) {
      setMapState("error");
      if (announce) setSaveNotice({ id, label: "保存失败" });
      return;
    }
    setNodes((items) => items.map((item) => (item.id === id ? { ...item, data: nextData } : item)));
    setMapState("saved");
    if (announce) setSaveNotice({ id, label: "已保存" });
  }

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

  async function addRelative(id: string, kind: "child" | "sibling") {
    const parent = nodes.find((node) => node.id === id);
    if (!parent) return;
    let fromId = kind === "child" ? id : "";
    let position = { x: parent.position.x + 280, y: parent.position.y + 24 };
    if (kind === "sibling") {
      const incoming = edges.find((edge) => edge.target === id && edge.data?.kind === "child");
      fromId = incoming?.source ?? "";
      position = { x: parent.position.x, y: parent.position.y + 160 };
    }
    setMapState("saving");
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        type: "note",
        payload: {
          text: kind === "child" ? "子卡片" : "同级卡片",
          ...(parent.data.color ? { color: parent.data.color } : {}),
        },
        position,
      }),
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
    if (!fromId) {
      setMapState("saved");
      return;
    }
    const edgeResponse = await fetch("/api/edges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        fromNodeId: fromId,
        toNodeId: body.node.id,
        kind: "child",
      }),
    });
    if (!edgeResponse.ok) {
      setMapState("error");
      return;
    }
    const edgeBody = (await edgeResponse.json()) as { edge: StoredEdge };
    setEdges((current) => [...current, ...toFlowEdges([edgeBody.edge])]);
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
        item.id === node.id ? { ...item, position, data: { ...item.data, x: position.x, y: position.y } } : item,
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
    setEdges((current) => current.map((edge) => (edge.id === id ? { ...edge, label: kind, data: { kind } } : edge)));
    setMapState("saved");
  }

  async function removeEdge(id: string) {
    setMapState("saving");
    const response = await fetch(`/api/edges/${id}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
    if (!response.ok) {
      setMapState("error");
      return;
    }
    setEdges((current) => current.filter((edge) => edge.id !== id));
    setMapState("saved");
  }

  async function deleteNode(id: string) {
    setMapState("saving");
    const response = await fetch(`/api/nodes/${id}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
    if (!response.ok) {
      setMapState("error");
      return;
    }
    const related = edges.filter((edge) => edge.source === id || edge.target === id);
    await Promise.all(
      related.map((edge) =>
        fetch(`/api/edges/${edge.id}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" }),
      ),
    );
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setNodes((current) => current.filter((node) => node.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    setMapState("saved");
  }

  const hidden = hiddenNodeIds(
    nodes.map((node) => ({ id: node.id, collapsed: node.data.collapsed })),
    edges.map((edge) => ({ source: edge.source, target: edge.target, kind: edge.data?.kind })),
  );
  const visibleNodes = nodes
    .filter((node) => !hidden.has(node.id))
    .map((node) => ({ ...node, selected: node.id === selectedId, zIndex: node.id === selectedId ? 20 : 0 }));
  const visibleEdges = edges.filter((edge) => !hidden.has(edge.source) && !hidden.has(edge.target));

  const actions: CardActions = {
    selectedId,
    onCollapse: (id) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;
      void patchNode(id, { collapsed: !node.data.collapsed });
    },
    onColor: (id, next) => void patchNode(id, { color: next }),
    onTag: (id, tag) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;
      const tags = [...(node.data.tags ?? [])];
      if (!tags.includes(tag)) tags.push(tag);
      void patchNode(id, { tags });
    },
    onDelete: (id) => void deleteNode(id),
    onAddChild: (id) => void addRelative(id, "child"),
    onAddSibling: (id) => void addRelative(id, "sibling"),
    onEdit: (id, patch) => void patchNode(id, patch, true),
    saveNotice,
  };

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!ready) return <p className="text-sm text-[#8E8E93]">正在打开脑图…</p>;

  return (
    <WorkspaceContext.Provider value={workspaceId}>
      <CardContext.Provider value={actions}>
        <div className={fill ? "flex h-full min-h-0 flex-col gap-2 px-2 pt-1 pb-2" : "flex flex-col gap-4"}>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="add-note"
              className="inline-flex min-h-11 items-center rounded-lg bg-[#4894F3] px-3 text-sm font-medium text-white"
              onClick={() => void addNode("note")}
            >
              新建笔记
            </button>
            <button
              type="button"
              data-testid="add-code-node"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#E6E6E6] bg-white px-3 text-sm font-medium"
              onClick={() => void addNode("code")}
            >
              新建代码
            </button>
            <p data-testid="map-status" data-state={mapState} className="text-xs text-[#8E8E93]">
              {mapState === "saving" ? "保存中…" : mapState === "saved" ? "已保存" : mapState === "error" ? "保存失败" : "拖动卡片，从圆点连到另一张。"}
            </p>
          </div>
          <div
            className={`relative w-full max-w-full touch-none overflow-hidden bg-[#F2F2F2] ${fill ? "min-h-0 flex-1" : "h-[min(70dvh,640px)] min-h-80 rounded-xl"}`}
            data-testid="mind-canvas"
          >
            <ReactFlow
              nodes={visibleNodes}
              edges={visibleEdges}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onNodeClick={(event, node) => {
                const element = event.target instanceof Element ? event.target : null;
                if (element?.closest("[data-card-control]")) return;
                setSelectedId(node.id);
                onNodeActivate?.({
                  id: node.id,
                  documentId: node.data.documentId,
                  anchor: node.data.anchor,
                });
              }}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              connectionRadius={48}
              deleteKeyCode={null}
              fitView={false}
              panOnDrag
              zoomOnPinch
              zoomOnScroll
              preventScrolling
              proOptions={{ hideAttribution: true }}
              style={{ background: "#F2F2F2" }}
            />
          </div>
          <ul className={`flex flex-col gap-2 ${fill ? "max-h-24 overflow-auto" : ""}`} data-testid="edge-list">
            {edges.map((edge) => {
              const kind = edge.data?.kind ?? "relates";
              const options = edgeKinds.includes(kind as (typeof edgeKinds)[number]) ? edgeKinds : [...edgeKinds, kind];
              return (
                <li key={edge.id} data-testid="edge-row" className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[#8E8E93]">
                    {edge.source.slice(0, 8)} → {edge.target.slice(0, 8)}
                  </span>
                  <select
                    data-testid="edge-kind"
                    className="rounded border border-[#E6E6E6] bg-white px-2 py-1"
                    value={kind}
                    onChange={(event) => void updateKind(edge.id, event.target.value)}
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="delete-edge"
                    className="rounded border border-[#E6E6E6] bg-white px-2 py-1"
                    onClick={() => void removeEdge(edge.id)}
                  >
                    删除连线
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContext.Provider>
    </WorkspaceContext.Provider>
  );
}
