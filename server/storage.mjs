import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyJsonPatch, byteLength } from "./json-patch.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");

export const DEFAULT_LIMITS = {
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

export const LIMITS = DEFAULT_LIMITS;

function envNumber(env, key, fallback) {
  const value = Number(env?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function limitsFromEnv(env = process.env) {
  return {
    ...DEFAULT_LIMITS,
    userBytes: envNumber(env, "OPENPT_USER_BYTES_LIMIT", DEFAULT_LIMITS.userBytes),
    projectBytes: envNumber(env, "OPENPT_PROJECT_BYTES_LIMIT", DEFAULT_LIMITS.projectBytes),
    minSaveIntervalMs: envNumber(env, "OPENPT_MIN_SAVE_INTERVAL_MS", DEFAULT_LIMITS.minSaveIntervalMs),
    leaseTtlMs: envNumber(env, "OPENPT_LEASE_TTL_MS", DEFAULT_LIMITS.leaseTtlMs),
    rollbackTargets: DEFAULT_LIMITS.rollbackTargets
  };
}

function token(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function nowIso() {
  return new Date().toISOString();
}

function hashToken(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

function publicSessionLabel(meta = {}) {
  return String(meta.clientLabel || meta.client_label || "").trim().slice(0, 120) || "Browser";
}

export class OpenPTStore {
  constructor({ dbPath, objectStore, limits = limitsFromEnv() }) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.objects = objectStore;
    this.limits = { ...DEFAULT_LIMITS, ...limits, rollbackTargets: limits.rollbackTargets || DEFAULT_LIMITS.rollbackTargets };
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = new Set(this.db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id));
    const files = readdirSync(migrationsDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();
    const runMigration = this.db.transaction((id, sql) => {
      this.db.exec(sql);
      this.db.prepare("INSERT INTO schema_migrations (id,applied_at) VALUES (?,?)").run(id, nowIso());
    });
    for (const file of files) {
      if (applied.has(file)) continue;
      runMigration(file, readFileSync(join(migrationsDir, file), "utf8"));
    }
    const staleSessions = this.db.prepare("SELECT id, created_at FROM sessions WHERE public_id IS NULL").all();
    const updateSession = this.db.prepare("UPDATE sessions SET public_id=?, client_label=COALESCE(client_label, 'Browser'), last_seen_at=COALESCE(last_seen_at, ?) WHERE id=?");
    for (const row of staleSessions) updateSession.run(token(12), row.created_at || nowIso(), row.id);
  }

  createUser(email, passwordHash, { verified = false } = {}) {
    const id = randomUUID();
    const created = nowIso();
    this.db.prepare("INSERT INTO users (id,email,password_hash,created_at,email_verified_at) VALUES (?,?,?,?,?)")
      .run(id, email.toLowerCase(), passwordHash, created, verified ? created : null);
    return this.getUserById(id);
  }

  getUserByEmail(email) {
    return this.db.prepare("SELECT * FROM users WHERE email=?").get(email.toLowerCase());
  }

  getUserById(id) {
    return this.db.prepare("SELECT id,email,created_at,email_verified_at,deletion_requested_at,deletion_scheduled_at FROM users WHERE id=?").get(id);
  }

  createSession(userId, meta = {}) {
    const created = nowIso();
    const session = {
      id: token(),
      public_id: token(12),
      user_id: userId,
      csrf: token(18),
      client_label: publicSessionLabel(meta),
      user_agent: String(meta.userAgent || meta.user_agent || "").slice(0, 500) || null,
      ip: String(meta.ip || "").slice(0, 120) || null,
      created_at: created,
      last_seen_at: created,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString()
    };
    this.db.prepare(`
      INSERT INTO sessions (id,public_id,user_id,csrf,client_label,user_agent,ip,created_at,last_seen_at,expires_at)
      VALUES (@id,@public_id,@user_id,@csrf,@client_label,@user_agent,@ip,@created_at,@last_seen_at,@expires_at)
    `).run(session);
    return session;
  }

  deleteSession(id) {
    this.db.prepare("DELETE FROM sessions WHERE id=?").run(id);
  }

  sessionUser(sessionId) {
    if (!sessionId) return null;
    const row = this.db.prepare(`
      SELECT sessions.*, users.email, users.email_verified_at, users.deletion_scheduled_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.id=? AND sessions.expires_at > ? AND users.deletion_scheduled_at IS NULL
    `).get(sessionId, nowIso());
    if (!row) return null;
    this.db.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").run(nowIso(), sessionId);
    return {
      id: row.user_id,
      email: row.email,
      csrf: row.csrf,
      sessionId: row.id,
      sessionPublicId: row.public_id,
      emailVerifiedAt: row.email_verified_at,
      deletionScheduledAt: row.deletion_scheduled_at
    };
  }

  createAccountToken(userId, kind, ttlMs) {
    const raw = token();
    const created = nowIso();
    const row = {
      id: randomUUID(),
      user_id: userId,
      kind,
      token_hash: hashToken(raw),
      created_at: created,
      expires_at: new Date(Date.now() + ttlMs).toISOString()
    };
    this.db.prepare("UPDATE account_tokens SET used_at=? WHERE user_id=? AND kind=? AND used_at IS NULL").run(created, userId, kind);
    this.db.prepare(`
      INSERT INTO account_tokens (id,user_id,kind,token_hash,created_at,expires_at)
      VALUES (@id,@user_id,@kind,@token_hash,@created_at,@expires_at)
    `).run(row);
    return { token: raw, expiresAt: row.expires_at };
  }

  consumeAccountToken(kind, rawToken) {
    const row = this.db.prepare(`
      SELECT account_tokens.*, users.email
      FROM account_tokens JOIN users ON users.id = account_tokens.user_id
      WHERE token_hash=? AND kind=? AND used_at IS NULL AND expires_at > ?
    `).get(hashToken(rawToken), kind, nowIso());
    if (!row) return null;
    this.db.prepare("UPDATE account_tokens SET used_at=? WHERE id=?").run(nowIso(), row.id);
    return { userId: row.user_id, email: row.email };
  }

  verifyUserEmail(userId) {
    this.db.prepare("UPDATE users SET email_verified_at=COALESCE(email_verified_at, ?) WHERE id=?").run(nowIso(), userId);
    return this.getUserById(userId);
  }

  setPasswordHash(userId, passwordHash) {
    this.db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash, userId);
  }

  listSessions(userId, currentSessionId = "") {
    return this.db.prepare(`
      SELECT public_id, client_label, user_agent, ip, created_at, last_seen_at, expires_at,
             CASE WHEN id=? THEN 1 ELSE 0 END AS current
      FROM sessions
      WHERE user_id=? AND expires_at > ?
      ORDER BY current DESC, last_seen_at DESC
    `).all(currentSessionId, userId, nowIso()).map((row) => ({
      id: row.public_id,
      clientLabel: row.client_label || "Browser",
      userAgent: row.user_agent || "",
      ip: row.ip || "",
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      current: !!row.current
    }));
  }

  deleteSessionByPublicId(userId, publicId) {
    return this.db.prepare("DELETE FROM sessions WHERE user_id=? AND public_id=?").run(userId, publicId).changes;
  }

  deleteOtherSessions(userId, currentSessionId) {
    return this.db.prepare("DELETE FROM sessions WHERE user_id=? AND id<>?").run(userId, currentSessionId).changes;
  }

  deleteUserSessions(userId) {
    return this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId).changes;
  }

  scheduleAccountDeletion(userId) {
    const requested = nowIso();
    const scheduled = addDays(14);
    this.db.transaction(() => {
      this.db.prepare("UPDATE users SET deletion_requested_at=?, deletion_scheduled_at=? WHERE id=?").run(requested, scheduled, userId);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      this.db.prepare("DELETE FROM leases WHERE user_id=?").run(userId);
      this.db.prepare("DELETE FROM leases WHERE project_id IN (SELECT id FROM projects WHERE user_id=?)").run(userId);
    })();
    return { deletionRequestedAt: requested, deletionScheduledAt: scheduled };
  }

  cancelAccountDeletion(userId) {
    this.db.prepare("UPDATE users SET deletion_requested_at=NULL, deletion_scheduled_at=NULL WHERE id=?").run(userId);
    return this.getUserById(userId);
  }

  collectObjectKeysForUsers(userIds) {
    if (!userIds.length) return [];
    const placeholders = userIds.map(() => "?").join(",");
    const keys = new Set();
    for (const row of this.db.prepare(`SELECT head_object_key AS key FROM projects WHERE user_id IN (${placeholders})`).all(...userIds)) {
      if (row.key) keys.add(row.key);
    }
    for (const row of this.db.prepare(`
      SELECT project_versions.object_key, project_versions.patch_key
      FROM project_versions JOIN projects ON projects.id = project_versions.project_id
      WHERE projects.user_id IN (${placeholders})
    `).all(...userIds)) {
      if (row.object_key) keys.add(row.object_key);
      if (row.patch_key) keys.add(row.patch_key);
    }
    return [...keys];
  }

  objectKeyStillReferenced(key) {
    if (!key) return false;
    return !!(
      this.db.prepare("SELECT 1 FROM projects WHERE head_object_key=? LIMIT 1").get(key) ||
      this.db.prepare("SELECT 1 FROM project_versions WHERE object_key=? OR patch_key=? LIMIT 1").get(key, key)
    );
  }

  async purgeScheduledAccounts(referenceDate = new Date()) {
    const due = this.db.prepare("SELECT id FROM users WHERE deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= ?").all(referenceDate.toISOString());
    const userIds = due.map((row) => row.id);
    if (!userIds.length) return { purged: 0, objectsDeleted: 0 };
    const candidateKeys = this.collectObjectKeysForUsers(userIds);
    this.db.transaction((ids) => {
      const deleteLeases = this.db.prepare("DELETE FROM leases WHERE user_id=?");
      const deleteProjectLeases = this.db.prepare("DELETE FROM leases WHERE project_id IN (SELECT id FROM projects WHERE user_id=?)");
      const deleteUser = this.db.prepare("DELETE FROM users WHERE id=?");
      for (const id of ids) {
        deleteLeases.run(id);
        deleteProjectLeases.run(id);
        deleteUser.run(id);
      }
    })(userIds);
    let objectsDeleted = 0;
    for (const key of candidateKeys) {
      if (!this.objectKeyStillReferenced(key) && await this.objects.deleteJson?.(key)) objectsDeleted += 1;
    }
    return { purged: userIds.length, objectsDeleted };
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

  renameProject(project, title) {
    const cleanTitle = String(title || "").trim() || "Untitled OpenPT project";
    const updated = nowIso();
    this.db.prepare("UPDATE projects SET title=?, updated_at=? WHERE id=? AND user_id=?")
      .run(cleanTitle, updated, project.id, project.user_id);
    return this.getProject(project.id, project.user_id);
  }

  deleteProject(project) {
    const deleted = nowIso();
    this.db.prepare("UPDATE projects SET deleted_at=?, updated_at=? WHERE id=? AND user_id=?")
      .run(deleted, deleted, project.id, project.user_id);
    this.db.prepare("DELETE FROM leases WHERE project_id=?").run(project.id);
    this.db.prepare("UPDATE share_links SET revoked_at=? WHERE project_id=? AND revoked_at IS NULL")
      .run(deleted, project.id);
    return { ok: true, deletedAt: deleted };
  }

  async duplicateProject(userId, project, title = "") {
    const document = await this.loadProjectDocument(project);
    const clone = JSON.parse(JSON.stringify(document || { schemaVersion: 1, devices: {}, links: [], uiState: {}, metadata: {} }));
    clone.title = String(title || "").trim() || `${project.title || clone.title || "Untitled OpenPT project"} copy`;
    return this.createProject(userId, clone.title, clone);
  }

  assertQuota(userId, projectId, nextProjectBytes) {
    if (nextProjectBytes > this.limits.projectBytes) {
      const err = new Error("Project exceeds the 500MB project limit.");
      err.statusCode = 413;
      throw err;
    }
    const usage = this.userUsage(userId);
    const current = projectId ? this.db.prepare("SELECT head_bytes FROM projects WHERE id=? AND user_id=?").get(projectId, userId)?.head_bytes || 0 : 0;
    if (usage - current + nextProjectBytes > this.limits.userBytes) {
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
      expires_at: new Date(Date.now() + this.limits.leaseTtlMs).toISOString(),
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
    const expires = new Date(Date.now() + this.limits.leaseTtlMs).toISOString();
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
    if (project.last_save_at && Date.now() - new Date(project.last_save_at).getTime() < this.limits.minSaveIntervalMs) {
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
    const age = this.limits.rollbackTargets[target];
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
