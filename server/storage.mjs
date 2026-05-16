import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { applyJsonPatch, byteLength } from "./json-patch.mjs";

export const LIMITS = {
  userBytes: 5 * 1024 * 1024 * 1024,
  projectBytes: 500 * 1024 * 1024,
  minSaveIntervalMs: 10_000,
  leaseTtlMs: 45_000,
  rollbackTargets: {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "10m": 10 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000
  }
};

function token(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function nowIso() {
  return new Date().toISOString();
}

export class OpenPTStore {
  constructor({ dbPath, objectStore }) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.objects = objectStore;
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        csrf TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        head_version INTEGER NOT NULL DEFAULT 0,
        head_object_key TEXT,
        head_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        last_save_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS project_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        object_key TEXT NOT NULL,
        patch_key TEXT,
        bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS leases (
        project_id TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_label TEXT NOT NULL,
        user_id TEXT,
        share_token TEXT,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS share_links (
        token TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('read','edit')),
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_project_versions_project_time ON project_versions(project_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, deleted_at);
    `);
  }

  createUser(email, passwordHash) {
    const id = randomUUID();
    this.db.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)")
      .run(id, email.toLowerCase(), passwordHash, nowIso());
    return this.getUserById(id);
  }

  getUserByEmail(email) {
    return this.db.prepare("SELECT * FROM users WHERE email=?").get(email.toLowerCase());
  }

  getUserById(id) {
    return this.db.prepare("SELECT id,email,created_at FROM users WHERE id=?").get(id);
  }

  createSession(userId) {
    const session = {
      id: token(),
      user_id: userId,
      csrf: token(18),
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString()
    };
    this.db.prepare("INSERT INTO sessions (id,user_id,csrf,created_at,expires_at) VALUES (@id,@user_id,@csrf,@created_at,@expires_at)").run(session);
    return session;
  }

  deleteSession(id) {
    this.db.prepare("DELETE FROM sessions WHERE id=?").run(id);
  }

  sessionUser(sessionId) {
    if (!sessionId) return null;
    const row = this.db.prepare(`
      SELECT sessions.*, users.email
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.id=? AND sessions.expires_at > ?
    `).get(sessionId, nowIso());
    if (!row) return null;
    return { id: row.user_id, email: row.email, csrf: row.csrf };
  }

  userUsage(userId) {
    const row = this.db.prepare("SELECT COALESCE(SUM(head_bytes),0) AS bytes FROM projects WHERE user_id=? AND deleted_at IS NULL").get(userId);
    return row.bytes || 0;
  }

  listProjects(userId) {
    return this.db.prepare(`
      SELECT id,title,head_version AS version,head_bytes AS bytes,created_at,updated_at
      FROM projects
      WHERE user_id=? AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `).all(userId);
  }

  getProject(projectId, userId) {
    return this.db.prepare("SELECT * FROM projects WHERE id=? AND user_id=? AND deleted_at IS NULL").get(projectId, userId);
  }

  getProjectByShare(tokenValue) {
    const row = this.db.prepare(`
      SELECT share_links.token, share_links.mode, projects.*
      FROM share_links JOIN projects ON projects.id = share_links.project_id
      WHERE share_links.token=? AND share_links.revoked_at IS NULL AND projects.deleted_at IS NULL
    `).get(tokenValue);
    return row || null;
  }

  async loadProjectDocument(project) {
    if (!project?.head_object_key) return null;
    return this.objects.getJson(project.head_object_key);
  }

  async createProject(userId, title, document) {
    const id = randomUUID();
    const created = nowIso();
    const normalized = document || { schemaVersion: 1, title: title || "Untitled OpenPT project", devices: {}, links: [], uiState: {}, metadata: {} };
    normalized.title = title || normalized.title || "Untitled OpenPT project";
    const size = byteLength(normalized);
    this.assertQuota(userId, null, size);
    const object = await this.objects.putJson("snapshots", normalized);
    this.db.prepare(`
      INSERT INTO projects (id,user_id,title,head_version,head_object_key,head_bytes,created_at,updated_at,last_save_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, userId, normalized.title, 1, object.key, size, created, created, created);
    this.db.prepare("INSERT INTO project_versions (id,project_id,version,object_key,bytes,created_at) VALUES (?,?,?,?,?,?)")
      .run(randomUUID(), id, 1, object.key, size, created);
    return this.getProject(id, userId);
  }

  assertQuota(userId, projectId, nextProjectBytes) {
    if (nextProjectBytes > LIMITS.projectBytes) {
      const err = new Error("Project exceeds the 500MB project limit.");
      err.statusCode = 413;
      throw err;
    }
    const usage = this.userUsage(userId);
    const current = projectId ? this.db.prepare("SELECT head_bytes FROM projects WHERE id=? AND user_id=?").get(projectId, userId)?.head_bytes || 0 : 0;
    if (usage - current + nextProjectBytes > LIMITS.userBytes) {
      const err = new Error("Account exceeds the 5GB storage limit.");
      err.statusCode = 413;
      throw err;
    }
  }

  currentLease(projectId) {
    const lease = this.db.prepare("SELECT * FROM leases WHERE project_id=?").get(projectId);
    if (!lease) return null;
    if (new Date(lease.expires_at).getTime() <= Date.now()) {
      this.db.prepare("DELETE FROM leases WHERE project_id=?").run(projectId);
      return null;
    }
    return lease;
  }

  acquireLease(projectId, { clientId, clientLabel, userId = null, shareToken = null, takeover = false }) {
    const existing = this.currentLease(projectId);
    if (existing && !takeover && existing.client_id !== clientId) {
      const err = new Error("Project is open for editing on another device.");
      err.statusCode = 423;
      err.lease = existing;
      throw err;
    }
    const lease = {
      project_id: projectId,
      lease_id: existing?.client_id === clientId ? existing.lease_id : randomUUID(),
      client_id: clientId,
      client_label: clientLabel || "Unknown browser",
      user_id: userId,
      share_token: shareToken,
      expires_at: new Date(Date.now() + LIMITS.leaseTtlMs).toISOString(),
      updated_at: nowIso()
    };
    this.db.prepare(`
      INSERT INTO leases (project_id,lease_id,client_id,client_label,user_id,share_token,expires_at,updated_at)
      VALUES (@project_id,@lease_id,@client_id,@client_label,@user_id,@share_token,@expires_at,@updated_at)
      ON CONFLICT(project_id) DO UPDATE SET
        lease_id=excluded.lease_id,
        client_id=excluded.client_id,
        client_label=excluded.client_label,
        user_id=excluded.user_id,
        share_token=excluded.share_token,
        expires_at=excluded.expires_at,
        updated_at=excluded.updated_at
    `).run(lease);
    return lease;
  }

  renewLease(projectId, leaseId, clientId) {
    const existing = this.currentLease(projectId);
    if (!existing || existing.lease_id !== leaseId || existing.client_id !== clientId) {
      const err = new Error("Edit lease is no longer valid.");
      err.statusCode = 423;
      throw err;
    }
    const expires = new Date(Date.now() + LIMITS.leaseTtlMs).toISOString();
    this.db.prepare("UPDATE leases SET expires_at=?, updated_at=? WHERE project_id=?").run(expires, nowIso(), projectId);
    return { ...existing, expires_at: expires };
  }

  releaseLease(projectId, leaseId, clientId) {
    this.db.prepare("DELETE FROM leases WHERE project_id=? AND lease_id=? AND client_id=?").run(projectId, leaseId, clientId);
  }

  async savePatch(project, { baseVersion, patches, uiStatePatch, clientId, leaseId, shareToken = null }) {
    const lease = this.currentLease(project.id);
    if (!lease || lease.lease_id !== leaseId || lease.client_id !== clientId) {
      const err = new Error("A valid edit lease is required before saving.");
      err.statusCode = 423;
      err.lease = lease;
      throw err;
    }
    if (Number(baseVersion) !== project.head_version) {
      const err = new Error("Server has a newer project version.");
      err.statusCode = 409;
      err.serverVersion = project.head_version;
      throw err;
    }
    if (project.last_save_at && Date.now() - new Date(project.last_save_at).getTime() < LIMITS.minSaveIntervalMs) {
      const err = new Error("Autosave rate limit: wait before saving again.");
      err.statusCode = 429;
      throw err;
    }
    const current = await this.loadProjectDocument(project);
    const mergedPatches = [...(patches || []), ...(uiStatePatch || [])];
    const next = applyJsonPatch(current, mergedPatches);
    const size = byteLength(next);
    this.assertQuota(project.user_id, project.id, size);
    const snapshot = await this.objects.putJson("snapshots", next);
    const patchObject = await this.objects.putJson("patches", { baseVersion, patches: patches || [], uiStatePatch: uiStatePatch || [], clientId, shareToken, createdAt: nowIso() });
    const version = project.head_version + 1;
    const saved = nowIso();
    this.db.prepare("UPDATE projects SET title=?, head_version=?, head_object_key=?, head_bytes=?, updated_at=?, last_save_at=? WHERE id=?")
      .run(next.title || project.title, version, snapshot.key, size, saved, saved, project.id);
    this.db.prepare("INSERT INTO project_versions (id,project_id,version,object_key,patch_key,bytes,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(randomUUID(), project.id, version, snapshot.key, patchObject.key, size, saved);
    return { project: this.db.prepare("SELECT * FROM projects WHERE id=?").get(project.id), document: next };
  }

  createShare(projectId, mode) {
    const row = { token: token(18), project_id: projectId, mode, created_at: nowIso() };
    this.db.prepare("INSERT INTO share_links (token,project_id,mode,created_at) VALUES (@token,@project_id,@mode,@created_at)").run(row);
    return row;
  }

  rollbackCandidate(projectId, target) {
    const age = LIMITS.rollbackTargets[target];
    if (!age) {
      const err = new Error("Unknown rollback target.");
      err.statusCode = 400;
      throw err;
    }
    const cutoff = new Date(Date.now() - age).toISOString();
    return this.db.prepare(`
      SELECT * FROM project_versions
      WHERE project_id=? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(projectId, cutoff);
  }

  async rollback(project, target) {
    const version = this.rollbackCandidate(project.id, target);
    if (!version) {
      const err = new Error(`No version exists at least ${target} ago.`);
      err.statusCode = 404;
      throw err;
    }
    const document = await this.objects.getJson(version.object_key);
    const size = byteLength(document);
    this.assertQuota(project.user_id, project.id, size);
    const object = await this.objects.putJson("snapshots", document);
    const nextVersion = project.head_version + 1;
    const saved = nowIso();
    this.db.prepare("UPDATE projects SET title=?, head_version=?, head_object_key=?, head_bytes=?, updated_at=?, last_save_at=? WHERE id=?")
      .run(document.title || project.title, nextVersion, object.key, size, saved, saved, project.id);
    this.db.prepare("INSERT INTO project_versions (id,project_id,version,object_key,bytes,created_at) VALUES (?,?,?,?,?,?)")
      .run(randomUUID(), project.id, nextVersion, object.key, size, saved);
    return { version: nextVersion, document };
  }
}
