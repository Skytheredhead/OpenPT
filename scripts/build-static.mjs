import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = join(root, "dist");

const rootFiles = [
  "index.html",
  "jeopardy.html",
  "wordle.html",
  "styles.css",
  "favicon.svg",
  "tweaks-panel.jsx",
  "icons.jsx",
  "device-glyphs.jsx",
  "engine.jsx",
  "openpt-format.js",
  "sim-services.jsx",
  "protocol-runtime.jsx",
  "palette.jsx",
  "topology.jsx",
  "cli.jsx",
  "inspector.jsx",
  "packet-tracer-importer.js",
  "sync-client.js",
  "home.jsx",
  "jeopardy.jsx",
  "wordle.jsx",
  "app.jsx",
  "wordle-real-words.js",
  "01 Jeopardy (Main Theme).m4a"
];

const directories = ["public", "quiz", "vendor"];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of rootFiles) {
  await cp(join(root, file), join(outDir, file));
}

for (const directory of directories) {
  await cp(join(root, directory), join(outDir, directory), { recursive: true });
}

console.log(`Static site copied to ${outDir}`);
