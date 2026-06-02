import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const skipDirs = new Set([".git", ".openpt-data", "coverage", "dist", "build", "tmp", "uploads", "screenshots", "node_modules"]);
const skipPathParts = new Set(["vendor", "spacetime"]);
const sourceExts = new Set([".js", ".jsx", ".mjs"]);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || skipPathParts.has(entry.name)) continue;
      await walk(join(dir, entry.name), out);
    } else if (sourceExts.has(extname(entry.name))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function sourceTypeFor(file) {
  return extname(file) === ".mjs" || file.endsWith("eslint.config.js") ? "module" : "script";
}

async function assertLocalScriptSourcesExist(htmlFile) {
  const htmlPath = join(root, htmlFile);
  const html = await readFile(htmlPath, "utf8");
  const srcPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const missing = [];
  for (const match of html.matchAll(srcPattern)) {
    const src = match[1];
    if (/^(https?:)?\/\//.test(src)) continue;
    if (src.startsWith("/_vercel/")) continue;
    const scriptPath = join(dirname(htmlPath), src);
    try {
      await access(scriptPath, constants.R_OK);
    } catch {
      missing.push(src);
    }
  }
  if (missing.length) {
    throw new Error(`${htmlFile} references missing scripts: ${missing.join(", ")}`);
  }
}

const files = await walk(root);
const failures = [];

for (const file of files) {
  const rel = relative(root, file);
  try {
    transformSync(await readFile(file, "utf8"), {
      filename: rel,
      presets: extname(file) === ".jsx" ? [["@babel/preset-react", { runtime: "classic" }]] : [],
      sourceType: sourceTypeFor(file),
      babelrc: false,
      configFile: false,
    });
  } catch (err) {
    failures.push(`${rel}: ${err.message}`);
  }
}

for (const htmlFile of ["index.html", "quiz/index.html"]) {
  try {
    await assertLocalScriptSourcesExist(htmlFile);
  } catch (err) {
    failures.push(err.message);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Static browser-script check passed for ${files.length} source files.`);
