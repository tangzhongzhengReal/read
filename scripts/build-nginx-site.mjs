import { spawn } from "node:child_process";
import { access, rename } from "node:fs/promises";

const apiDir = "app/api";
const holdDir = "app/_api_hold";
const proxyFile = "proxy.ts";
const proxyHold = "proxy.ts.hold";

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn("node_modules/.bin/next", ["build"], {
      stdio: "inherit",
      env: { ...process.env, STATIC_EXPORT: "1" },
    });
    child.on("error", reject);
    child.on("exit", (status) => {
      if (status === 0) resolve();
      else reject(new Error(`next build exited with ${status}`));
    });
  });
}

if (await exists(holdDir)) {
  throw new Error("app/_api_hold already exists");
}

let moved = false;
let movedProxy = false;
if (await exists(apiDir)) {
  await rename(apiDir, holdDir);
  moved = true;
}
if (await exists(proxyFile)) {
  await rename(proxyFile, proxyHold);
  movedProxy = true;
}

try {
  await runNextBuild();
} finally {
  if (movedProxy && (await exists(proxyHold))) await rename(proxyHold, proxyFile);
  if (moved) await rename(holdDir, apiDir);
}
