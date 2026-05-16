import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

export class ObjectStore {
  constructor(root) {
    this.root = root;
  }

  async putJson(kind, value) {
    const raw = Buffer.from(JSON.stringify(value));
    const gz = gzipSync(raw);
    const hash = createHash("sha256").update(gz).digest("hex");
    const key = `${kind}/${hash.slice(0, 2)}/${hash}.json.gz`;
    const file = join(this.root, key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, gz);
    return { key, bytes: gz.length, rawBytes: raw.length, hash };
  }

  async getJson(key) {
    const gz = await readFile(join(this.root, key));
    return JSON.parse(gunzipSync(gz).toString("utf8"));
  }
}
