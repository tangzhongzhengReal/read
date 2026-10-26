import { CodeRunSchema, type CodeRun } from "@/src/lib/models";
import { getCodeRunStore } from "@/src/lib/store/code-runs";
import type { CodeExecutionResult } from "./executor";
import { getCodeExecutor } from "./executor";
import { nextCodeRunStatus } from "./state-machine";

export async function executeQueuedCodeRun(workspaceId: string, runId: string): Promise<CodeRun> {
  const store = getCodeRunStore(workspaceId);
  const queued = await store.get(runId);
  if (!queued || queued.status !== "queued") {
    throw new Error(`code run is not queued: ${runId}`);
  }

  const running = CodeRunSchema.parse({
    ...queued,
    status: nextCodeRunStatus(queued.status, "running"),
    updatedAt: new Date().toISOString(),
  });
  await store.append(running);

  let result: CodeExecutionResult;
  try {
    result = await getCodeExecutor()({
      language: running.language,
      source: running.source,
      stdin: running.stdin,
    });
  } catch (error) {
    result = {
      stdout: "",
      stderr: error instanceof Error ? error.message : "runner failed",
      exitCode: 1,
      timedOut: false,
    };
  }

  const status = result.timedOut ? "timed_out" : result.exitCode === 0 ? "succeeded" : "failed";
  const finished = CodeRunSchema.parse({
    ...running,
    status: nextCodeRunStatus("running", status),
    stdout: result.stdout,
    stderr: result.stderr,
    updatedAt: new Date().toISOString(),
  });
  await store.append(finished);
  return finished;
}
