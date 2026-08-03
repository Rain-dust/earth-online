import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "src"), { recursive: true });

await Promise.all([
  cp(resolve(root, "assets"), resolve(output, "assets"), { recursive: true }),
  cp(resolve(root, "src", "styles"), resolve(output, "src", "styles"), { recursive: true }),
  cp(resolve(root, "src", "styles.css"), resolve(output, "src", "styles.css")),
]);

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const productionHtml = sourceHtml.replace(
  /\s*<script type="importmap">[\s\S]*?<\/script>/,
  "",
);
await writeFile(resolve(output, "index.html"), productionHtml, "utf8");

await build({
  entryPoints: [resolve(root, "src", "main.js")],
  outfile: resolve(output, "src", "main.js"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
  legalComments: "eof",
});

console.log(`Earth Online production build created at ${output}`);
