import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyJsonPatch, byteLength } from "./json-patch.mjs";
import { nextProgressForAttempt, sanitizeQuestionKeys, scheduleStudySession } from "./study-scheduler.mjs";

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

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    return fallback;
  }
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

  studyProgressRows(userId, bankId = "ccna") {
    return this.db.prepare("SELECT * FROM study_question_progress WHERE user_id=? AND bank_id=?").all(userId, bankId);
  }

  studySummary(userId, bankId = "ccna", totalQuestionCount = 0) {
    const progress = this.studyProgressRows(userId, bankId);
    const aggregate = progress.reduce((acc, row) => {
      acc.seen += row.seen_count > 0 ? 1 : 0;
      acc.activeWeak += (row.miss_count > 0 || row.slow_count > 0 || row.interrupted_count > 0) && !row.mastered_at ? 1 : 0;
      acc.mastered += row.mastered_at ? 1 : 0;
      acc.misses += row.miss_count || 0;
      acc.slow += row.slow_count || 0;
      acc.interrupted += row.interrupted_count || 0;
      if (row.avg_answer_ms) {
        acc.timingTotal += row.avg_answer_ms;
        acc.timingRows += 1;
      }
      return acc;
    }, { seen: 0, activeWeak: 0, mastered: 0, misses: 0, slow: 0, interrupted: 0, timingTotal: 0, timingRows: 0 });
    const sessions = this.db.prepare(`
      SELECT id, question_count, scored_count, correct_count, miss_count, slow_count, interrupted_count, avg_answer_ms, mastered_count, started_at, ended_at, summary_json
      FROM study_sessions
      WHERE user_id=? AND bank_id=? AND ended_at IS NOT NULL
      ORDER BY ended_at DESC
      LIMIT 20
    `).all(userId, bankId);
    const scored = sessions.filter((session) => session.scored_count > 0);
    const averageScore = scored.length
      ? Math.round(scored.reduce((sum, session) => sum + ((session.correct_count / session.scored_count) * 100), 0) / scored.length)
      : null;
    const recentScore = scored[0] ? Math.round((scored[0].correct_count / scored[0].scored_count) * 100) : null;
    const avgAnswerMs = aggregate.timingRows
      ? Math.round(aggregate.timingTotal / aggregate.timingRows)
      : (scored.length ? Math.round(scored.reduce((sum, session) => sum + (session.avg_answer_ms || 0), 0) / scored.length) : 0);
    const confidenceScore = Math.max(0, Math.min(100, Math.round(
      (recentScore ?? averageScore ?? 0) * 0.54 +
      (totalQuestionCount ? (aggregate.seen / totalQuestionCount) * 100 : 0) * 0.18 +
      (aggregate.mastered / Math.max(1, aggregate.activeWeak + aggregate.mastered)) * 100 * 0.18 -
      Math.min(20, aggregate.activeWeak * 1.5) -
      Math.min(12, aggregate.slow * 0.7)
    )));
    const weakest = progress
      .filter((row) => (row.miss_count > 0 || row.slow_count > 0 || row.interrupted_count > 0) && !row.mastered_at)
      .sort((a, b) => (
        b.miss_count - a.miss_count ||
        b.slow_count - a.slow_count ||
        b.interrupted_count - a.interrupted_count ||
        a.review_streak - b.review_streak ||
        String(a.last_seen_at || "").localeCompare(String(b.last_seen_at || ""))
      ))
      .slice(0, 10)
      .map((row) => ({
        questionKey: row.question_key,
        missCount: row.miss_count,
        slowCount: row.slow_count,
        interruptedCount: row.interrupted_count,
        reviewStreak: row.review_streak,
        avgAnswerMs: row.avg_answer_ms,
        lastSeenAt: row.last_seen_at
      }));
    return {
      totalQuestionCount,
      seenCount: aggregate.seen,
      masteredCount: aggregate.mastered,
      activeWeakCount: aggregate.activeWeak,
      missCount: aggregate.misses,
      slowCount: aggregate.slow,
      interruptedCount: aggregate.interrupted,
      recentScore,
      averageScore,
      averageAnswerMs: avgAnswerMs,
      confidenceScore,
      sessions: sessions.slice(0, 8).map((session) => ({
        id: session.id,
        score: session.scored_count ? Math.round((session.correct_count / session.scored_count) * 100) : null,
        correctCount: session.correct_count,
        questionCount: session.question_count,
        scoredCount: session.scored_count,
        missCount: session.miss_count,
        slowCount: session.slow_count,
        interruptedCount: session.interrupted_count,
        masteredCount: session.mastered_count,
        avgAnswerMs: session.avg_answer_ms,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        summary: parseJson(session.summary_json, null)
      })),
      weakest
    };
  }

  createStudySession(userId, bankId = "ccna", questionKeys = []) {
    const pool = sanitizeQuestionKeys(questionKeys);
    if (pool.length < 20) {
      const err = new Error("At least 20 study questions are required.");
      err.statusCode = 400;
      throw err;
    }
    const selected = scheduleStudySession({
      questionKeys: pool,
      progressRows: this.studyProgressRows(userId, bankId)
    });
    const now = nowIso();
    const row = {
      id: randomUUID(),
      user_id: userId,
      bank_id: bankId,
      question_keys_json: JSON.stringify(selected),
      question_count: selected.length,
      started_at: now
    };
    this.db.prepare(`
      INSERT INTO study_sessions (id,user_id,bank_id,question_keys_json,question_count,started_at)
      VALUES (@id,@user_id,@bank_id,@question_keys_json,@question_count,@started_at)
    `).run(row);
    return {
      id: row.id,
      bankId,
      questionKeys: selected,
      startedAt: now,
      summary: this.studySummary(userId, bankId, pool.length)
    };
  }

  recordStudyAttempt(userId, bankId = "ccna", sessionId, body = {}) {
    const session = this.db.prepare("SELECT * FROM study_sessions WHERE id=? AND user_id=? AND bank_id=?").get(sessionId, userId, bankId);
    if (!session) {
      const err = new Error("Study session not found.");
      err.statusCode = 404;
      throw err;
    }
    if (session.ended_at) {
      const err = new Error("Study session is already finished.");
      err.statusCode = 409;
      throw err;
    }
    const questionKey = String(body.questionKey || body.question_key || "").trim().slice(0, 220);
    const sessionKeys = new Set(parseJson(session.question_keys_json, []));
    if (!sessionKeys.has(questionKey)) {
      const err = new Error("Question is not part of this study session.");
      err.statusCode = 400;
      throw err;
    }
    const existing = this.db.prepare("SELECT * FROM study_attempts WHERE session_id=? AND question_key=?").get(sessionId, questionKey);
    if (existing) return this.studyAttemptResponse(existing);
    const selectedAnswers = Array.isArray(body.selectedAnswers) ? body.selectedAnswers : [];
    const correct = !!body.correct;
    const durationMs = Number.isFinite(Number(body.answerDurationMs)) ? Math.max(0, Math.round(Number(body.answerDurationMs))) : null;
    const current = this.db.prepare("SELECT * FROM study_question_progress WHERE user_id=? AND bank_id=? AND question_key=?").get(userId, bankId, questionKey);
    const next = nextProgressForAttempt(current, { correct, durationMs });
    const now = nowIso();
    const attempt = {
      id: randomUUID(),
      session_id: sessionId,
      user_id: userId,
      bank_id: bankId,
      question_key: questionKey,
      selected_answers_json: JSON.stringify(selectedAnswers),
      correct: correct ? 1 : 0,
      answer_duration_ms: next.attempt.durationMs,
      slow: next.attempt.isSlow ? 1 : 0,
      interrupted: next.attempt.isInterrupted ? 1 : 0,
      is_new: next.attempt.isNew ? 1 : 0,
      was_review: next.attempt.wasReview ? 1 : 0,
      review_streak_after: next.attempt.reviewStreakAfter,
      mastered_after: next.attempt.masteredAfter ? 1 : 0,
      created_at: now
    };
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO study_question_progress (
          user_id, bank_id, question_key, seen_count, correct_count, miss_count, slow_count, interrupted_count,
          review_streak, mastered_at, next_due_at, avg_answer_ms, last_answer_ms, timed_seen_count, last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, bank_id, question_key) DO UPDATE SET
          seen_count=excluded.seen_count,
          correct_count=excluded.correct_count,
          miss_count=excluded.miss_count,
          slow_count=excluded.slow_count,
          interrupted_count=excluded.interrupted_count,
          review_streak=excluded.review_streak,
          mastered_at=excluded.mastered_at,
          next_due_at=excluded.next_due_at,
          avg_answer_ms=excluded.avg_answer_ms,
          last_answer_ms=excluded.last_answer_ms,
          timed_seen_count=excluded.timed_seen_count,
          last_seen_at=excluded.last_seen_at
      `).run(
        userId, bankId, questionKey,
        next.progress.seen_count,
        next.progress.correct_count,
        next.progress.miss_count,
        next.progress.slow_count,
        next.progress.interrupted_count,
        next.progress.review_streak,
        next.progress.mastered_at,
        next.progress.next_due_at,
        next.progress.avg_answer_ms,
        next.progress.last_answer_ms,
        next.progress.timed_seen_count,
        next.progress.last_seen_at
      );
      this.db.prepare(`
        INSERT INTO study_attempts (
          id, session_id, user_id, bank_id, question_key, selected_answers_json, correct,
          answer_duration_ms, slow, interrupted, is_new, was_review, review_streak_after, mastered_after, created_at
        )
        VALUES (
          @id, @session_id, @user_id, @bank_id, @question_key, @selected_answers_json, @correct,
          @answer_duration_ms, @slow, @interrupted, @is_new, @was_review, @review_streak_after, @mastered_after, @created_at
        )
      `).run(attempt);
    })();
    return this.studyAttemptResponse(attempt);
  }

  studyAttemptResponse(row) {
    return {
      attempt: {
        id: row.id,
        questionKey: row.question_key,
        selectedAnswers: parseJson(row.selected_answers_json, []),
        correct: !!row.correct,
        answerDurationMs: row.answer_duration_ms,
        slow: !!row.slow,
        interrupted: !!row.interrupted,
        isNew: !!row.is_new,
        wasReview: !!row.was_review,
        reviewStreakAfter: row.review_streak_after,
        masteredAfter: !!row.mastered_after,
        createdAt: row.created_at
      }
    };
  }

  finishStudySession(userId, bankId = "ccna", sessionId, totalQuestionCount = 0) {
    const session = this.db.prepare("SELECT * FROM study_sessions WHERE id=? AND user_id=? AND bank_id=?").get(sessionId, userId, bankId);
    if (!session) {
      const err = new Error("Study session not found.");
      err.statusCode = 404;
      throw err;
    }
    const attempts = this.db.prepare("SELECT * FROM study_attempts WHERE session_id=? ORDER BY created_at").all(sessionId);
    const scoredAttempts = attempts.filter((attempt) => !attempt.interrupted);
    const correctCount = scoredAttempts.filter((attempt) => attempt.correct).length;
    const missCount = scoredAttempts.filter((attempt) => !attempt.correct).length;
    const newCount = attempts.filter((attempt) => attempt.is_new).length;
    const reviewCount = attempts.filter((attempt) => attempt.was_review).length;
    const slowCount = attempts.filter((attempt) => attempt.slow).length;
    const interruptedCount = attempts.filter((attempt) => attempt.interrupted).length;
    const masteredCount = attempts.filter((attempt) => attempt.mastered_after).length;
    const timed = attempts.filter((attempt) => attempt.answer_duration_ms != null && !attempt.interrupted);
    const avgAnswerMs = timed.length ? Math.round(timed.reduce((sum, attempt) => sum + attempt.answer_duration_ms, 0) / timed.length) : 0;
    const scoredCount = scoredAttempts.length;
    const ended = session.ended_at || nowIso();
    const summary = {
      score: scoredCount ? Math.round((correctCount / scoredCount) * 100) : null,
      questionCount: session.question_count,
      answeredCount: attempts.length,
      scoredCount,
      correctCount,
      missCount,
      newCount,
      reviewCount,
      slowCount,
      interruptedCount,
      masteredCount,
      avgAnswerMs,
      startedAt: session.started_at,
      endedAt: ended
    };
    this.db.prepare(`
      UPDATE study_sessions
      SET correct_count=?, miss_count=?, new_count=?, review_count=?, slow_count=?, interrupted_count=?, mastered_count=?, scored_count=?,
          avg_answer_ms=?, summary_json=?, ended_at=?
      WHERE id=? AND user_id=? AND bank_id=?
    `).run(
      correctCount, missCount, newCount, reviewCount, slowCount, interruptedCount, masteredCount, scoredCount,
      avgAnswerMs, JSON.stringify(summary), ended, sessionId, userId, bankId
    );
    return {
      session: { id: sessionId, ...summary },
      dashboard: this.studySummary(userId, bankId, totalQuestionCount)
    };
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
