import type { CodeRunStatus } from "@/src/lib/models";

const transitions: Record<CodeRunStatus, readonly CodeRunStatus[]> = {
  queued: ["running"],
  running: ["succeeded", "failed", "timed_out"],
  succeeded: [],
  failed: [],
  timed_out: [],
};

export function nextCodeRunStatus(from: CodeRunStatus, to: CodeRunStatus): CodeRunStatus {
  if (!transitions[from].includes(to)) {
    throw new Error(`illegal code run transition: ${from} -> ${to}`);
  }
  return to;
}
