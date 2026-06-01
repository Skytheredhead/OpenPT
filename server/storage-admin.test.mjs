import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { ObjectStore } from "./object-store.mjs";
import { OpenPTStore } from "./storage.mjs";
import { byteLength } from "./json-patch.mjs";
import { cleanupObjects, createBackup, restoreBackup, validateBackup } from "./storage-admin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

async function makeStore(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "openpt-storage-"));
  const store = new OpenPTStore({
    dbPath: join(dir, "openpt.sqlite"),
    objectStore: new ObjectStore(join(dir, "objects")),
    ...options
  });
  return { dir, store };
}

async function runCli(args, env = {}) {
  const child = spawn(process.execPath, ["server/storage-cli.mjs", ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.once("exit", resolve));
  if (code !== 0) throw new Error(`CLI failed with code ${code}: ${stderr}`);
  return JSON.parse(stdout);
}

test("fresh and reopened databases record tracked migrations once", async () => {
  const { dir, store } = await makeStore();
  try {
    const applied = store.db.prepare("SELECT id FROM schema_migrations ORDER BY id").all().map((row) => row.id);
    assert.ok(applied.includes("001_initial_schema.sql"));
    const appliedCount = applied.length;
    store.db.close();
    const reopened = new OpenPTStore({ dbPath: join(dir, "openpt.sqlite"), objectStore: new ObjectStore(join(dir, "objects")) });
    try {
      assert.equal(reopened.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, appliedCount);
    } finally {
      reopened.db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("existing current-shape databases are baselined by idempotent migrations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "openpt-baseline-"));
  try {
    const db = new Database(join(dir, "openpt.sqlite"));
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE projects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, head_version INTEGER NOT NULL DEFAULT 0, head_object_key TEXT, head_bytes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, last_save_at TEXT);
      CREATE TABLE project_versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, version INTEGER NOT NULL, object_key TEXT NOT NULL, patch_key TEXT, bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE leases (project_id TEXT PRIMARY KEY, lease_id TEXT NOT NULL, client_id TEXT NOT NULL, client_label TEXT NOT NULL, user_id TEXT, share_token TEXT, expires_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE share_links (token TEXT PRIMARY KEY, project_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('read','edit')), created_at TEXT NOT NULL, revoked_at TEXT);
    `);
    db.close();
    const store = new OpenPTStore({ dbPath: join(dir, "openpt.sqlite"), objectStore: new ObjectStore(join(dir, "objects")) });
    try {
      assert.equal(store.db.prepare("SELECT id FROM schema_migrations").get().id, "001_initial_schema.sql");
      assert.ok(store.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_projects_deleted_at'").get());
    } finally {
      store.db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("backup and restore recover the database and object documents", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("backup@example.com", "hash");
    const project = await store.createProject(user.id, "Backup Lab", { schemaVersion: 1, title: "Backup Lab", devices: {}, links: [], uiState: {} });
    const backup = await createBackup({ dataDir: dir, store, reason: "test" });
    assert.ok(existsSync(join(backup.path, "openpt.sqlite")));
    assert.ok(existsSync(join(backup.path, "manifest.json")));
    assert.equal(JSON.parse(await readFile(join(backup.path, "manifest.json"), "utf8")).id, backup.id);

    store.deleteProject(project);
    store.db.close();
    const result = await restoreBackup({ dataDir: dir, backupId: backup.id });
    assert.equal(result.backupId, backup.id);

    const restored = new OpenPTStore({ dbPath: join(dir, "openpt.sqlite"), objectStore: new ObjectStore(join(dir, "objects")) });
    try {
      const row = restored.getProject(project.id, user.id);
      assert.equal(row.title, "Backup Lab");
      assert.equal((await restored.loadProjectDocument(row)).title, "Backup Lab");
    } finally {
      restored.db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("restore rejects backups with missing referenced objects without touching live data", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("missing-object@example.com", "hash");
    const project = await store.createProject(user.id, "Live Lab", { schemaVersion: 1, title: "Live Lab", devices: {}, links: [], uiState: {} });
    const backup = await createBackup({ dataDir: dir, store, reason: "test" });
    await rm(join(backup.path, "objects", project.head_object_key), { force: true });
    await assert.rejects(() => validateBackup({ dataDir: dir, backupId: backup.id }), /missing referenced object/);
    const live = store.getProject(project.id, user.id);
    assert.equal(live.title, "Live Lab");
  } finally {
    store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("cleanup reports orphans, preserves recent deletes, and purges expired deleted projects", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("cleanup@example.com", "hash");
    const active = await store.createProject(user.id, "Active", { schemaVersion: 1, title: "Active", devices: {}, links: [], uiState: {} });
    const recent = await store.createProject(user.id, "Recent", { schemaVersion: 1, title: "Recent", devices: {}, links: [], uiState: {} });
    const expired = await store.createProject(user.id, "Expired", { schemaVersion: 1, title: "Expired", devices: {}, links: [], uiState: {} });
    const orphan = await store.objects.putJson("snapshots", { orphan: true });

    store.deleteProject(recent);
    store.deleteProject(expired);
    store.db.prepare("UPDATE projects SET deleted_at=? WHERE id=?").run(new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString(), expired.id);

    const dryRun = await cleanupObjects({ store, dryRun: true, olderThanDays: 30 });
    assert.equal(dryRun.purgeableProjects, 1);
    assert.ok(dryRun.purgeableObjectFiles >= 2);
    assert.ok(await stat(store.objects.resolveKey(orphan.key)));

    const result = await cleanupObjects({ store, dryRun: false, olderThanDays: 30 });
    assert.equal(result.deletedProjects, 1);
    assert.equal(store.getProject(active.id, user.id).title, "Active");
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM projects WHERE id=?").get(recent.id).count, 1);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM projects WHERE id=?").get(expired.id).count, 0);
    await assert.rejects(() => stat(store.objects.resolveKey(orphan.key)), /ENOENT/);
  } finally {
    store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("quota checks reject project, account, and patch saves before writing new objects", async () => {
  const { dir, store } = await makeStore({ limits: { projectBytes: 120, userBytes: 190, minSaveIntervalMs: 0, leaseTtlMs: 45_000 } });
  try {
    const user = store.createUser("quota@example.com", "hash");
    await assert.rejects(
      () => store.createProject(user.id, "Huge", { schemaVersion: 1, title: "Huge", data: "x".repeat(200), devices: {}, links: [], uiState: {} }),
      (err) => err.statusCode === 413
    );
    assert.equal((await store.objects.listKeys()).length, 0);

    const document = { schemaVersion: 1, title: "Small", data: "x".repeat(20), devices: {}, links: [], uiState: {} };
    assert.ok(byteLength(document) < 120);
    const first = await store.createProject(user.id, "Small", document);
    store.limits.userBytes = store.userUsage(user.id) + 10;
    await assert.rejects(
      () => store.createProject(user.id, "Second", { ...document, title: "Second" }),
      (err) => err.statusCode === 413
    );

    const beforeKeys = await store.objects.listKeys();
    const beforeVersionCount = store.db.prepare("SELECT COUNT(*) AS count FROM project_versions WHERE project_id=?").get(first.id).count;
    const lease = store.acquireLease(first.id, { clientId: "client-a", clientLabel: "A", userId: user.id });
    await assert.rejects(() => store.savePatch(first, {
      baseVersion: 1,
      clientId: "client-a",
      leaseId: lease.lease_id,
      patches: [{ op: "replace", path: "/data", value: "y".repeat(200) }],
      uiStatePatch: []
    }), (err) => err.statusCode === 413);
    assert.deepEqual(await store.objects.listKeys(), beforeKeys);
    assert.equal(store.getProject(first.id, user.id).head_version, 1);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM project_versions WHERE project_id=?").get(first.id).count, beforeVersionCount);
  } finally {
    store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("storage CLI operates against OPENPT_DATA_DIR", async () => {
  const dir = await mkdtemp(join(tmpdir(), "openpt-cli-"));
  try {
    const backup = await runCli(["backup"], { OPENPT_DATA_DIR: dir });
    assert.ok(backup.backup.id.startsWith("openpt-"));
    const cleanup = await runCli(["cleanup:dry-run"], { OPENPT_DATA_DIR: dir });
    assert.equal(cleanup.dryRun, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
