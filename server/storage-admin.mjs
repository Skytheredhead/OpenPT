import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { ObjectStore } from "./object-store.mjs";

export const DEFAULT_CLEANUP_GRACE_DAYS = 30;
export const RESTORE_CONFIRMATION = "RESTORE_OPENPT";
const backupManifestName = "manifest.json";
const pendingRestoreName = "pending-restore.json";

function nowIso() {
  return new Date().toISOString();
}

function backupIdFromDate(date = new Date()) {
  return `openpt-${date.toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

function assertInside(root, path) {
  const rel = relative(root, path);
  if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new Error("Path is outside the storage directory.");
  }
}

function backupsRoot(dataDir) {
  return join(resolve(dataDir), "backups");
}

function safeBackupPath(dataDir, backupId) {
  if (!backupId || backupId !== basename(backupId) || !/^openpt-[A-Za-z0-9._-]+$/.test(backupId)) {
    throw new Error("Invalid backup id.");
  }
  const root = backupsRoot(dataDir);
  const dir = resolve(root, backupId);
  assertInside(root, dir);
  return dir;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

function readMigrationIds(db) {
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  if (!hasTable) return [];
  return db.prepare("SELECT id FROM schema_migrations ORDER BY id").all().map((row) => row.id);
}

function referencedObjectKeys(db, excludedProjectIds = []) {
  const excluded = new Set(excludedProjectIds);
  const rows = db.prepare(`
    SELECT projects.id AS project_id, projects.head_object_key AS object_key, NULL AS patch_key
    FROM projects
    WHERE projects.head_object_key IS NOT NULL
    UNION
    SELECT project_id, object_key, patch_key FROM project_versions
  `).all();
  const keys = new Set();
  for (const row of rows) {
    if (excluded.has(row.project_id)) continue;
    if (row.object_key) keys.add(row.object_key);
    if (row.patch_key) keys.add(row.patch_key);
  }
  return keys;
}

async function copyObjects(sourceRoot, destinationRoot) {
  await mkdir(destinationRoot, { recursive: true });
  if (!(await exists(sourceRoot))) return;
  await cp(sourceRoot, destinationRoot, { recursive: true, force: true, errorOnExist: false });
}

async function backupDatabase(store, dbPath, destinationPath) {
  if (store?.db) {
    await store.db.backup(destinationPath);
    return;
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destinationPath);
  } finally {
    db.close();
  }
}

export async function createBackup({ dataDir, store = null, reason = "manual" }) {
  const root = resolve(dataDir);
  const id = backupIdFromDate();
  const finalDir = safeBackupPath(root, id);
  const stageDir = join(backupsRoot(root), `.tmp-${id}`);
  const dbPath = store?.dbPath || join(root, "openpt.sqlite");
  const objectStore = store?.objects || new ObjectStore(join(root, "objects"));

  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });
  try {
    await backupDatabase(store, dbPath, join(stageDir, "openpt.sqlite"));
    await objectStore.copyTo(join(stageDir, "objects"));
    const db = new Database(join(stageDir, "openpt.sqlite"), { readonly: true, fileMustExist: true });
    let migrations = [];
    let objectKeys = [];
    try {
      migrations = readMigrationIds(db);
      objectKeys = [...referencedObjectKeys(db)].sort();
    } finally {
      db.close();
    }
    const manifest = {
      version: 1,
      id,
      createdAt: nowIso(),
      reason,
      dbFile: "openpt.sqlite",
      objectsDir: "objects",
      migrations,
      referencedObjectCount: objectKeys.length
    };
    await writeFile(join(stageDir, backupManifestName), `${JSON.stringify(manifest, null, 2)}\n`);
    await mkdir(dirname(finalDir), { recursive: true });
    await rename(stageDir, finalDir);
    return { id, path: finalDir, manifest };
  } catch (err) {
    await rm(stageDir, { recursive: true, force: true });
    throw err;
  }
}

export async function validateBackup({ dataDir, backupId }) {
  const backupDir = safeBackupPath(dataDir, backupId);
  const manifestPath = join(backupDir, backupManifestName);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== 1 || manifest.id !== backupId || manifest.dbFile !== "openpt.sqlite" || manifest.objectsDir !== "objects") {
    throw new Error("Backup manifest is not valid for this OpenPT version.");
  }
  const dbPath = join(backupDir, "openpt.sqlite");
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  let keys;
  try {
    const integrity = db.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrity !== "ok") throw new Error(`Backup database integrity check failed: ${integrity}`);
    keys = referencedObjectKeys(db);
  } finally {
    db.close();
  }
  const objectStore = new ObjectStore(join(backupDir, "objects"));
  const missing = [];
  for (const key of keys) {
    try {
      await objectStore.statKey(key);
    } catch (err) {
      if (err?.code === "ENOENT") missing.push(key);
      else throw err;
    }
  }
  if (missing.length) {
    const err = new Error("Backup is missing referenced object files.");
    err.missingObjectKeys = missing;
    throw err;
  }
  return { backupDir, manifest, referencedObjectCount: keys.size };
}

export async function restoreBackup({ dataDir, backupId, store = null }) {
  const root = resolve(dataDir);
  const { backupDir, manifest } = await validateBackup({ dataDir: root, backupId });
  const preRestore = await createBackup({ dataDir: root, store, reason: `pre-restore-${backupId}` });
  const restoreStage = join(root, `.restore-${backupId}-${randomUUID().slice(0, 8)}`);
  const oldDb = join(root, `.old-openpt.sqlite-${randomUUID().slice(0, 8)}`);
  const oldObjects = join(root, `.old-objects-${randomUUID().slice(0, 8)}`);

  await rm(restoreStage, { recursive: true, force: true });
  await mkdir(restoreStage, { recursive: true });
  try {
    await cp(join(backupDir, "openpt.sqlite"), join(restoreStage, "openpt.sqlite"), { force: true });
    await copyObjects(join(backupDir, "objects"), join(restoreStage, "objects"));
    if (await exists(join(root, "openpt.sqlite"))) await rename(join(root, "openpt.sqlite"), oldDb);
    if (await exists(join(root, "objects"))) await rename(join(root, "objects"), oldObjects);
    await rm(join(root, "openpt.sqlite-wal"), { force: true });
    await rm(join(root, "openpt.sqlite-shm"), { force: true });
    await rename(join(restoreStage, "openpt.sqlite"), join(root, "openpt.sqlite"));
    await rename(join(restoreStage, "objects"), join(root, "objects"));
    await rm(restoreStage, { recursive: true, force: true });
    await rm(oldDb, { force: true });
    await rm(oldObjects, { recursive: true, force: true });
    return { ok: true, backupId, preRestoreBackupId: preRestore.id, manifest };
  } catch (err) {
    if (await exists(oldDb)) {
      await rm(join(root, "openpt.sqlite"), { force: true });
      await rename(oldDb, join(root, "openpt.sqlite"));
    }
    if (await exists(oldObjects)) {
      await rm(join(root, "objects"), { recursive: true, force: true });
      await rename(oldObjects, join(root, "objects"));
    }
    await rm(restoreStage, { recursive: true, force: true });
    throw err;
  }
}

export async function cleanupObjects({ store, objectStore = store.objects, olderThanDays = DEFAULT_CLEANUP_GRACE_DAYS, dryRun = false }) {
  const graceDays = Number.isFinite(Number(olderThanDays)) && Number(olderThanDays) >= 0 ? Number(olderThanDays) : DEFAULT_CLEANUP_GRACE_DAYS;
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60_000).toISOString();
  const expiredProjects = store.db.prepare("SELECT id FROM projects WHERE deleted_at IS NOT NULL AND deleted_at <= ?").all(cutoff);
  const expiredProjectIds = expiredProjects.map((row) => row.id);

  if (!dryRun && expiredProjectIds.length) {
    const removeVersions = store.db.prepare("DELETE FROM project_versions WHERE project_id=?");
    const removeShares = store.db.prepare("DELETE FROM share_links WHERE project_id=?");
    const removeLeases = store.db.prepare("DELETE FROM leases WHERE project_id=?");
    const removeProject = store.db.prepare("DELETE FROM projects WHERE id=?");
    const removeTransaction = store.db.transaction((projectIds) => {
      for (const id of projectIds) {
        removeVersions.run(id);
        removeShares.run(id);
        removeLeases.run(id);
        removeProject.run(id);
      }
    });
    removeTransaction(expiredProjectIds);
  }

  const referenced = referencedObjectKeys(store.db, expiredProjectIds);
  const keys = await objectStore.listKeys();
  let reclaimedBytes = 0;
  let deletedObjectFiles = 0;
  const unreferenced = [];
  const missingReferencedObjects = [];

  for (const key of referenced) {
    try {
      await objectStore.statKey(key);
    } catch (err) {
      if (err?.code === "ENOENT") missingReferencedObjects.push(key);
      else throw err;
    }
  }

  for (const key of keys) {
    if (referenced.has(key)) continue;
    const info = await objectStore.statKey(key);
    unreferenced.push(key);
    reclaimedBytes += info.size;
    if (!dryRun) {
      await objectStore.deleteKey(key);
      deletedObjectFiles += 1;
    }
  }

  return {
    dryRun: !!dryRun,
    olderThanDays: graceDays,
    cutoff,
    deletedProjects: dryRun ? 0 : expiredProjectIds.length,
    purgeableProjects: expiredProjectIds.length,
    deletedObjectFiles,
    purgeableObjectFiles: unreferenced.length,
    retainedObjects: keys.length - unreferenced.length,
    missingReferencedObjects,
    reclaimedBytes: dryRun ? 0 : reclaimedBytes,
    reclaimableBytes: reclaimedBytes
  };
}

export async function writePendingRestore({ dataDir, backupId, confirm }) {
  if (confirm !== RESTORE_CONFIRMATION) {
    throw new Error(`Restore requires confirm="${RESTORE_CONFIRMATION}".`);
  }
  await validateBackup({ dataDir, backupId });
  const root = resolve(dataDir);
  const pendingPath = join(root, pendingRestoreName);
  await mkdir(root, { recursive: true });
  const payload = { backupId, requestedAt: nowIso() };
  await writeFile(pendingPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
  return payload;
}

export async function applyPendingRestore({ dataDir }) {
  const root = resolve(dataDir);
  const pendingPath = join(root, pendingRestoreName);
  if (!(await exists(pendingPath))) return null;
  const pending = JSON.parse(await readFile(pendingPath, "utf8"));
  const result = await restoreBackup({ dataDir: root, backupId: pending.backupId });
  await rm(pendingPath, { force: true });
  return { ...result, requestedAt: pending.requestedAt };
}
