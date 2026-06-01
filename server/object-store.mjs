import { cp, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

export class ObjectStore {
  constructor(root) {
    this.root = resolve(root);
  }

  resolveKey(key) {
    if (!key || typeof key !== "string" || key.includes("\\") || key.startsWith("/") || key.includes("\0")) {
      throw new Error("Invalid object key.");
    }
    const file = resolve(this.root, key);
    const rel = relative(this.root, file);
    if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`)) {
      throw new Error("Invalid object key.");
    }
    return file;
  }

  async putJson(kind, value) {
    const raw = Buffer.from(JSON.stringify(value));
    const gz = gzipSync(raw);
    const hash = createHash("sha256").update(gz).digest("hex");
    const key = `${kind}/${hash.slice(0, 2)}/${hash}.json.gz`;
    const file = this.resolveKey(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, gz);
    return { key, bytes: gz.length, rawBytes: raw.length, hash };
  }

  async getJson(key) {
    const gz = await readFile(this.resolveKey(key));
    return JSON.parse(gunzipSync(gz).toString("utf8"));
  }

  async deleteJson(key) {
    if (!key) return false;
    try {
      await unlink(this.resolveKey(key));
      return true;
    } catch (err) {
      if (err?.code === "ENOENT") return false;
      throw err;
    }
  }

  async listKeys() {
    const keys = [];
    const walk = async (dir) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (err) {
        if (err?.code === "ENOENT") return;
        throw err;
      }
      for (const entry of entries) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(file);
        } else if (entry.isFile()) {
          keys.push(relative(this.root, file).split(sep).join("/"));
        }
      }
    };
    await walk(this.root);
    keys.sort();
    return keys;
  }

  async statKey(key) {
    return stat(this.resolveKey(key));
  }

  async deleteKey(key) {
    await rm(this.resolveKey(key), { force: true });
  }

  async copyTo(destinationRoot) {
    await mkdir(destinationRoot, { recursive: true });
    try {
      await cp(this.root, destinationRoot, { recursive: true, force: true, errorOnExist: false });
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
  }
}
