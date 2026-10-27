function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Parent-to-child orthogonal polyline with rounded corners. */
export function orthogonalEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  radius = 8,
): string {
  const sx = round(sourceX);
  const sy = round(sourceY);
  const tx = round(targetX);
  const ty = round(targetY);
  if (Math.abs(ty - sy) < 1) return `M ${sx} ${sy} H ${tx}`;
  const midX = round(sx + (tx - sx) / 2);
  const r = Math.min(radius, Math.abs(tx - sx) / 2, Math.abs(ty - sy) / 2);
  if (r < 1) return `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
  const dirX = tx >= sx ? 1 : -1;
  const dirY = ty > sy ? 1 : -1;
  const x1 = round(midX - dirX * r);
  const y1 = round(sy + dirY * r);
  const y2 = round(ty - dirY * r);
  const x2 = round(midX + dirX * r);
  return `M ${sx} ${sy} H ${x1} Q ${midX} ${sy} ${midX} ${y1} V ${y2} Q ${midX} ${ty} ${x2} ${ty} H ${tx}`;
}
