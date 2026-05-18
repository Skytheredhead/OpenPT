import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";

async function loadSyncClient({ windowSetup = () => {}, fetchImpl = async () => new Response(JSON.stringify({ ok: true }), { status: 200 }) } = {}) {
  const source = await readFile(join(process.cwd(), "sync-client.js"), "utf8");
  const context = {
    window: {},
    location: { hostname: "127.0.0.1", protocol: "http:", origin: "http://127.0.0.1:5173" },
    crypto: { randomUUID: () => "client-test-id" },
    navigator: { userAgent: "Mac" },
    fetch: fetchImpl,
    Response,
    setTimeout,
    clearTimeout,
  };
  windowSetup(context.window);
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "sync-client.js" });
  return context.window.OpenPTSync;
}

test("sync client tolerates blocked browser storage", async () => {
  const Sync = await loadSyncClient({
    windowSetup(window) {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("localStorage blocked");
        },
      });
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new Error("sessionStorage blocked");
        },
      });
    },
  });
  assert.doesNotThrow(() => new Sync.OpenPTSyncClient());
});

test("logout sends csrf when present and clears cached csrf", async () => {
  const sessionValues = new Map([["openpt:csrf", "csrf-token"]]);
  const Sync = await loadSyncClient({
    windowSetup(window) {
      window.localStorage = new MapStorage();
      window.sessionStorage = new MapStorage(sessionValues);
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/auth/logout");
      assert.equal(options.headers["x-openpt-csrf"], "csrf-token");
      assert.equal(options.headers["content-type"], undefined);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  const client = new Sync.OpenPTSyncClient();
  await client.logout();
  assert.equal(sessionValues.has("openpt:csrf"), false);
});

class MapStorage {
  constructor(values = new Map()) {
    this.values = values;
  }
  getItem(key) {
    return this.values.get(key) || null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
