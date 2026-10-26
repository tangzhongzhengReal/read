import { createRequire } from "node:module";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const publicDir = path.join(process.cwd(), "public");

await mkdir(publicDir, { recursive: true });
await cp(
  path.join(packageDir, "legacy", "build", "pdf.worker.min.mjs"),
  path.join(publicDir, "pdf.worker.min.mjs"),
);
await cp(path.join(packageDir, "standard_fonts"), path.join(publicDir, "standard_fonts"), {
  recursive: true,
});
