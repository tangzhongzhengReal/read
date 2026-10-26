import type { CodeLanguage } from "@/src/lib/models";
import { runInDocker, type CodeExecutionResult } from "./docker-runner";

export type { CodeExecutionResult };

export type CodeExecutorInput = {
  language: CodeLanguage;
  source: string;
  stdin?: string;
};

export type CodeExecutor = (input: CodeExecutorInput) => Promise<CodeExecutionResult>;

function dockerExecutor(input: CodeExecutorInput): Promise<CodeExecutionResult> {
  return runInDocker({
    language: input.language,
    source: input.source,
    stdin: input.stdin,
  });
}

let current: CodeExecutor = dockerExecutor;

export function getCodeExecutor(): CodeExecutor {
  return current;
}

export function setCodeExecutor(next: CodeExecutor): void {
  current = next;
}

export function resetCodeExecutor(): void {
  current = dockerExecutor;
}
