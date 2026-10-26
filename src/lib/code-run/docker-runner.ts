import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CodeLanguage } from "@/src/lib/models";

const IMAGES: Record<CodeLanguage, string> = {
  javascript: "node:22-alpine",
  python: "python:3.12-alpine",
  go: "golang:1.23-alpine",
};

const FILE_NAMES: Record<CodeLanguage, string> = {
  javascript: "main.js",
  python: "main.py",
  go: "main.go",
};

const DEFAULT_MAX_OUTPUT = 100_000;

export type CodeExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

export function buildDockerArgs(input: {
  containerName: string;
  language: CodeLanguage;
  workDir: string;
}): string[] {
  const image = IMAGES[input.language];
  const fileName = FILE_NAMES[input.language];
  const command =
    input.language === "javascript"
      ? ["node", `/work/${fileName}`]
      : input.language === "python"
        ? ["python", "-I", `/work/${fileName}`]
        : ["go", "run", `/work/${fileName}`];

  const args = [
    "run",
    "--rm",
    "--name",
    input.containerName,
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--memory=512m",
    "--memory-swap=512m",
    "--cpus=1",
    "--pids-limit=256",
    "--user",
    "65534:65534",
    "--tmpfs",
    input.language === "go"
      ? "/tmp:rw,nosuid,exec,size=256m"
      : "/tmp:rw,nosuid,noexec,size=64m",
    "--mount",
    `type=bind,src=${input.workDir},dst=/work,readonly`,
  ];

  if (input.language === "go") {
    args.push(
      "--env",
      "GOCACHE=/tmp/gocache",
      "--env",
      "GOPATH=/tmp/gopath",
      "--env",
      "HOME=/tmp",
      "--env",
      "GO111MODULE=off",
    );
  }

  args.push(image, ...command);
  return args;
}

export async function runInDocker(input: {
  language: CodeLanguage;
  source: string;
  stdin?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}): Promise<CodeExecutionResult> {
  const workDir = await mkdtemp(path.join(tmpdir(), "read-code-"));
  try {
    await chmod(workDir, 0o755);
    const filePath = path.join(/*turbopackIgnore: true*/ workDir, FILE_NAMES[input.language]);
    await writeFile(filePath, input.source, {
      encoding: "utf8",
      mode: 0o644,
    });
    await chmod(filePath, 0o644);
    await ensureImage(IMAGES[input.language]);
    const containerName = `read-run-${randomUUID()}`;
    const timeoutMs = input.timeoutMs ?? (input.language === "go" ? 60_000 : 10_000);
    return await runDocker(buildDockerArgs({
      containerName,
      language: input.language,
      workDir,
    }), {
      stdin: input.stdin ?? "",
      timeoutMs,
      containerName,
      maxOutputBytes: input.maxOutputBytes ?? DEFAULT_MAX_OUTPUT,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function ensureImage(image: string): Promise<void> {
  const inspect = await runDocker(["image", "inspect", image], {
    stdin: "",
    timeoutMs: 20_000,
    containerName: "",
    maxOutputBytes: 8_000,
  });
  if (inspect.exitCode === 0) return;
  const pull = await runDocker(["pull", image], {
    stdin: "",
    timeoutMs: 180_000,
    containerName: "",
    maxOutputBytes: DEFAULT_MAX_OUTPUT,
  });
  if (pull.exitCode !== 0) {
    throw new Error(pull.stderr || `unable to pull ${image}`);
  }
}

function runDocker(
  args: string[],
  options: {
    stdin: string;
    timeoutMs: number;
    containerName: string;
    maxOutputBytes: number;
  },
): Promise<CodeExecutionResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout = appendCapped(stdout, chunk.toString("utf8"), options.maxOutputBytes);
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr = appendCapped(stderr, chunk.toString("utf8"), options.maxOutputBytes);
    });
    if (options.stdin) proc.stdin.write(options.stdin);
    proc.stdin.end();

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      if (options.containerName) {
        spawn("docker", ["kill", options.containerName], { shell: false, stdio: "ignore" });
      } else {
        proc.kill("SIGKILL");
      }
    }, options.timeoutMs);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    proc.on("error", (error) => {
      finish(() => reject(error));
    });
    proc.on("close", (code) => {
      finish(() =>
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut,
        }),
      );
    });
  });
}

function appendCapped(current: string, chunk: string, max: number): string {
  if (current.endsWith("…[truncated]")) return current;
  const next = current + chunk;
  if (next.length <= max) return next;
  return `${next.slice(0, max)}\n…[truncated]`;
}
