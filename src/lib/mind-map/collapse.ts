export function hiddenNodeIds(
  nodes: Array<{ id: string; collapsed?: boolean }>,
  edges: Array<{ source: string; target: string; kind?: string }>,
): Set<string> {
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "child") continue;
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const hidden = new Set<string>();
  const stack = nodes.filter((node) => node.collapsed).flatMap((node) => children.get(node.id) ?? []);
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || hidden.has(id)) continue;
    hidden.add(id);
    for (const child of children.get(id) ?? []) stack.push(child);
  }
  return hidden;
}
