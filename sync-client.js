(function () {
  const CLIENT_KEY = "openpt:sync:client-id";
  const LABEL_KEY = "openpt:sync:client-label";
  const DB_NAME = "openpt-sync";
  const DB_VERSION = 1;
  const DEFAULT_API_BASE = location.hostname.endsWith("vercel.app") ? "https://openptapi.skylarenns.com" : "";

  function apiBase() {
    const configured = window.OPENPT_API_BASE || localStorage.getItem("openpt:api-base") || DEFAULT_API_BASE;
    return String(configured || "").replace(/\/+$/, "");
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function esc(part) {
    return String(part).replace(/~/g, "~0").replace(/\//g, "~1");
  }

  function diffObjectMap(base = {}, next = {}, prefix) {
    const patches = [];
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(next || {})]);
    for (const key of keys) {
      const a = base?.[key];
      const b = next?.[key];
      const path = `${prefix}/${esc(key)}`;
      if (typeof b === "undefined") patches.push({ op: "remove", path });
      else if (typeof a === "undefined") patches.push({ op: "add", path, value: clone(b) });
      else if (stableStringify(a) !== stableStringify(b)) patches.push({ op: "replace", path, value: clone(b) });
    }
    return patches;
  }

  function buildProjectPatches(base = {}, next = {}) {
    const patches = [];
    if ((base.title || "") !== (next.title || "")) patches.push({ op: "replace", path: "/title", value: next.title || "Untitled OpenPT project" });
    patches.push(...diffObjectMap(base.devices || {}, next.devices || {}, "/devices"));
    if (stableStringify(base.links || []) !== stableStringify(next.links || [])) patches.push({ op: "replace", path: "/links", value: clone(next.links || []) });
    if (stableStringify(base.metadata || {}) !== stableStringify(next.metadata || {})) patches.push({ op: "replace", path: "/metadata", value: clone(next.metadata || {}) });
    return patches;
  }

  function buildUiPatches(base = {}, next = {}) {
    const patches = [];
    if (stableStringify(base.uiState || {}) !== stableStringify(next.uiState || {})) patches.push({ op: "replace", path: "/uiState", value: clone(next.uiState || {}) });
    return patches;
  }

  function getClientId() {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  }

  function getClientLabel() {
    let label = localStorage.getItem(LABEL_KEY);
    if (!label) {
      const ua = navigator.userAgent.includes("Mac") ? "Mac browser" : "Browser";
      label = `${ua} ${getClientId().slice(0, 4)}`;
      localStorage.setItem(LABEL_KEY, label);
    }
    return label;
  }

  function setClientLabel(label) {
    localStorage.setItem(LABEL_KEY, label || getClientLabel());
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("documents")) db.createObjectStore("documents", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function withStore(name, mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, mode);
      const store = tx.objectStore(name);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    }).finally(() => db.close());
  }

  async function enqueue(batch) {
    await withStore("queue", "readwrite", (store) => store.add({ ...batch, queuedAt: Date.now() }));
  }

  async function queued() {
    return withStore("queue", "readonly", (store) => new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  async function dequeue(id) {
    await withStore("queue", "readwrite", (store) => store.delete(id));
  }

  async function saveLocalDocument(key, document, meta = {}) {
    await withStore("documents", "readwrite", (store) => store.put({ key, document, meta, updatedAt: Date.now() }));
  }

  async function request(path, options = {}) {
    const headers = { "content-type": "application/json", ...(options.headers || {}) };
    const csrf = sessionStorage.getItem("openpt:csrf");
    if (csrf) headers["x-openpt-csrf"] = csrf;
    const base = apiBase();
    const url = `${base}${path}`;
    const res = await fetch(url, { credentials: "include", ...options, headers });
    const nextCsrf = res.headers.get("x-openpt-csrf");
    if (nextCsrf) sessionStorage.setItem("openpt:csrf", nextCsrf);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    if (data.csrf) sessionStorage.setItem("openpt:csrf", data.csrf);
    return data;
  }

  class OpenPTSyncClient {
    constructor() {
      this.clientId = getClientId();
      this.clientLabel = getClientLabel();
    }

    setClientLabel(label) {
      setClientLabel(label);
      this.clientLabel = getClientLabel();
      return this.clientLabel;
    }

    async me() { return request("/api/me"); }
    async register(email, password) { return request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }); }
    async login(email, password) { return request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); }
    async logout() { return request("/api/auth/logout", { method: "POST" }); }
    async listProjects() { return request("/api/projects"); }
    async createProject(title, document) { return request("/api/projects", { method: "POST", body: JSON.stringify({ title, document }) }); }
    async loadProject(id) { return request(`/api/projects/${encodeURIComponent(id)}`); }
    async acquireLease(id, takeover = false) {
      return request(`/api/projects/${encodeURIComponent(id)}/lease`, {
        method: "POST",
        body: JSON.stringify({ clientId: this.clientId, clientLabel: this.clientLabel, takeover })
      });
    }
    async renewLease(id, leaseId) {
      return request(`/api/projects/${encodeURIComponent(id)}/lease/renew`, {
        method: "POST",
        body: JSON.stringify({ clientId: this.clientId, leaseId })
      });
    }
    async savePatch(id, batch) {
      return request(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...batch, clientId: this.clientId })
      });
    }
    async shareProject(id, mode) {
      return request(`/api/projects/${encodeURIComponent(id)}/share`, {
        method: "POST",
        body: JSON.stringify({ mode })
      });
    }
    async rollback(id, target) {
      return request(`/api/projects/${encodeURIComponent(id)}/rollback`, {
        method: "POST",
        body: JSON.stringify({ target })
      });
    }
    async loadShare(token) { return request(`/api/share/${encodeURIComponent(token)}`); }
    async acquireShareLease(token, takeover = false) {
      return request(`/api/share/${encodeURIComponent(token)}/lease`, {
        method: "POST",
        body: JSON.stringify({ clientId: this.clientId, clientLabel: this.clientLabel, takeover })
      });
    }
    async saveSharePatch(token, batch) {
      return request(`/api/share/${encodeURIComponent(token)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...batch, clientId: this.clientId })
      });
    }
  }

  window.OpenPTSync = {
    OpenPTSyncClient,
    buildProjectPatches,
    buildUiPatches,
    saveLocalDocument,
    enqueue,
    queued,
    dequeue,
    stableStringify,
    clone
  };
})();
