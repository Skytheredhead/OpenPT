import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import argon2 from "argon2";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectStore } from "./object-store.mjs";
import { OpenPTStore } from "./storage.mjs";
import { applyPendingRestore, cleanupObjects, createBackup, writePendingRestore } from "./storage-admin.mjs";
import { AbuseGuard, clientIp } from "./abuse-guard.mjs";
import { reportFingerprint, sanitizeErrorReport, sendErrorReportEmail } from "./error-report.mjs";
import { sanitizeFeedback, sendFeedbackEmail } from "./feedback.mjs";
import { publicBaseUrl, sendPasswordResetEmail, sendVerificationEmail } from "./account-email.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
try {
  process.loadEnvFile?.(join(root, ".env"));
} catch (err) {
  if (err?.code !== "ENOENT") console.warn("Could not load .env:", err.message);
}
const dataDir = resolve(process.env.OPENPT_DATA_DIR || join(root, ".openpt-data"));
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const defaultAllowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://openpt.dev",
  "https://openpt.skylarenns.com",
  "https://openpt.vercel.app",
  "https://open-pt.vercel.app"
];
const allowedOrigins = (process.env.OPENPT_ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const backendOnly = process.env.OPENPT_BACKEND_ONLY === "1";
const adminToken = process.env.OPENPT_ADMIN_TOKEN || "";

const app = Fastify({ logger: true, bodyLimit: 520 * 1024 * 1024 });
const pendingRestore = await applyPendingRestore({ dataDir });
if (pendingRestore) {
  app.log.info({ backupId: pendingRestore.backupId, preRestoreBackupId: pendingRestore.preRestoreBackupId }, "applied pending storage restore");
}
const store = new OpenPTStore({
  dbPath: join(dataDir, "openpt.sqlite"),
  objectStore: new ObjectStore(join(dataDir, "objects"))
});
await store.purgeScheduledAccounts().catch((err) => app.log?.warn?.({ err }, "scheduled account purge failed"));
const abuse = new AbuseGuard();
setInterval(() => abuse.sweep(), 10 * 60_000).unref();
setInterval(() => {
  store.purgeScheduledAccounts().catch((err) => app.log.warn({ err }, "scheduled account purge failed"));
}, 60 * 60_000).unref();

await app.register(cookie, {
  secret: process.env.OPENPT_COOKIE_SECRET || "openpt-dev-cookie-secret-change-me"
});

await app.register(cors, {
  credentials: true,
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["content-type", "x-openpt-csrf"],
  exposedHeaders: ["x-openpt-csrf"]
});

app.decorateRequest("user", null);
app.addHook("preHandler", async (req) => {
  if (req.raw.url?.startsWith("/api/")) abuse.check("global", clientIp(req));
  const user = store.sessionUser(req.cookies.openpt_session);
  req.user = user;
});

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.email_verified_at || user.emailVerifiedAt || null,
    deletionScheduledAt: user.deletion_scheduled_at || user.deletionScheduledAt || null
  };
}

function requireUser(req) {
  if (!req.user) {
    const err = new Error("Authentication required.");
    err.statusCode = 401;
    throw err;
  }
  return req.user;
}

function requireCsrf(req) {
  if (!req.user) return;
  const header = req.headers["x-openpt-csrf"];
  if (!header || header !== req.user.csrf) {
    const err = new Error("Invalid CSRF token.");
    err.statusCode = 403;
    throw err;
  }
}

function requireAdmin(req) {
  if (!adminToken) {
    const err = new Error("Not found");
    err.statusCode = 404;
    throw err;
  }
  if (req.headers.authorization !== `Bearer ${adminToken}`) {
    const err = new Error("Admin authorization required.");
    err.statusCode = 401;
    throw err;
  }
}

function setSessionCookie(reply, session) {
  const secureCookies = process.env.OPENPT_SECURE_COOKIES === "1";
  reply
    .setCookie("openpt_session", session.id, {
      path: "/",
      httpOnly: true,
      sameSite: secureCookies ? "none" : "lax",
      secure: secureCookies,
      expires: new Date(session.expires_at),
      signed: false
    })
    .header("x-openpt-csrf", session.csrf);
}

function clearSessionCookie(reply) {
  reply.clearCookie("openpt_session", { path: "/" });
}

function sessionMeta(req) {
  return {
    clientLabel: req.body?.clientLabel,
    userAgent: req.headers["user-agent"],
    ip: clientIp(req)
  };
}

function authError(reply, statusCode, code, message, extra = {}) {
  reply.status(statusCode);
  return { error: message, code, statusCode, ...extra };
}

async function issueVerification(user, req, log = console) {
  const token = store.createAccountToken(user.id, "email_verify", 24 * 60 * 60_000);
  const result = await sendVerificationEmail(user.email, token.token, { baseUrl: publicBaseUrl(req, process.env, allowedOrigins) });
  if (result.token) log.info?.({ email: user.email, link: result.link }, "verification email debug link");
  return { expiresAt: token.expiresAt, link: result.sent ? undefined : result.link, token: result.sent ? undefined : result.token };
}

async function issuePasswordReset(user, req, log = console) {
  const token = store.createAccountToken(user.id, "password_reset", 60 * 60_000);
  const result = await sendPasswordResetEmail(user.email, token.token, { baseUrl: publicBaseUrl(req, process.env, allowedOrigins) });
  if (result.token) log.info?.({ email: user.email, link: result.link }, "password reset email debug link");
  return { expiresAt: token.expiresAt, link: result.sent ? undefined : result.link, token: result.sent ? undefined : result.token };
}

function projectSummary(row, extra = {}) {
  return {
    id: row.id,
    title: row.title,
    version: row.head_version ?? row.version,
    bytes: row.head_bytes ?? row.bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extra
  };
}

function accountExistsError() {
  const err = new Error("Account already exists.");
  err.statusCode = 409;
  return err;
}

function isUniqueUserError(err) {
  return err?.code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint failed: users\.email/i.test(err?.message || "");
}

app.setErrorHandler((err, req, reply) => {
  const status = err.statusCode || 500;
  req.log[status >= 500 ? "error" : "warn"](err);
  if (err.retryAfter) reply.header("retry-after", String(err.retryAfter));
  reply.status(status).send({
    error: err.message || "Server error",
    code: err.code,
    statusCode: status,
    lease: err.lease ? {
      clientId: err.lease.client_id,
      clientLabel: err.lease.client_label,
      expiresAt: err.lease.expires_at
    } : undefined,
    serverVersion: err.serverVersion
  });
});

app.get("/api/health", async () => ({ ok: true, limits: store.limits }));

app.post("/api/admin/backups", async (req) => {
  requireAdmin(req);
  const result = await createBackup({ dataDir, store, reason: "http-admin" });
  return { backup: { id: result.id, createdAt: result.manifest.createdAt, path: result.path, referencedObjectCount: result.manifest.referencedObjectCount } };
});

app.post("/api/admin/storage/cleanup", async (req) => {
  requireAdmin(req);
  return cleanupObjects({
    store,
    objectStore: store.objects,
    dryRun: !!req.body?.dryRun,
    olderThanDays: req.body?.olderThanDays
  });
});

app.post("/api/admin/restore", async (req, reply) => {
  requireAdmin(req);
  const pending = await writePendingRestore({
    dataDir,
    backupId: req.body?.backupId,
    confirm: req.body?.confirm
  });
  reply.status(202);
  return { restore: pending, applyOnRestart: true };
});

app.post("/api/error-reports", { bodyLimit: 256 * 1024 }, async (req, reply) => {
  if (req.user) requireCsrf(req);
  const report = sanitizeErrorReport(req.body || {});
  const fingerprint = reportFingerprint(report);
  try {
    abuse.check("errorReportIp", clientIp(req));
    abuse.check("errorReportFingerprint", fingerprint);
    if (req.user?.id) abuse.check("errorReportUser", req.user.id);
  } catch (err) {
    req.log.warn({ err, fingerprint }, "error report throttled");
    return { ok: true };
  }
  sendErrorReportEmail(report, { logger: req.log }).catch((err) => {
    req.log.warn({ err, fingerprint }, "error report email failed");
  });
  reply.status(202);
  return { ok: true };
});

app.post("/api/feedback", { bodyLimit: 15 * 1024 * 1024 }, async (req, reply) => {
  if (req.user) requireCsrf(req);
  const ip = clientIp(req);
  abuse.check("feedbackIpMinute", ip);
  abuse.check("feedbackIpHour", ip);
  const feedback = sanitizeFeedback(req.body || {});
  await sendFeedbackEmail(feedback);
  reply.status(202);
  return { ok: true };
});

app.post("/api/auth/register", async (req, reply) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (String(req.body?.company || "").trim()) {
    reply.status(202);
    return { ok: true };
  }
  abuse.check("registerIp", clientIp(req));
  abuse.check("registerEmail", email || "missing");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    reply.status(400);
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    reply.status(400);
    return { error: "Password must be at least 8 characters." };
  }
  if (store.getUserByEmail(email)) throw accountExistsError();
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  let user;
  try {
    user = store.createUser(email, hash);
  } catch (err) {
    if (isUniqueUserError(err)) throw accountExistsError();
    throw err;
  }
  const verification = await issueVerification(user, req, req.log);
  reply.status(202);
  return { ok: true, needsVerification: true, email: user.email, verification };
});

app.post("/api/auth/login", async (req, reply) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  abuse.check("loginIp", clientIp(req));
  abuse.check("loginEmail", email || "missing");
  const privateUser = store.getUserByEmail(email);
  if (!privateUser || !(await argon2.verify(privateUser.password_hash, password))) {
    reply.status(401);
    return { error: "Invalid email or password." };
  }
  if (privateUser.deletion_scheduled_at) {
    return authError(reply, 403, "ACCOUNT_DELETION_PENDING", "This account is scheduled for deletion.", {
      email,
      deletionScheduledAt: privateUser.deletion_scheduled_at
    });
  }
  if (!privateUser.email_verified_at) {
    return authError(reply, 403, "EMAIL_NOT_VERIFIED", "Verify your email before signing in.", { email });
  }
  const user = store.getUserById(privateUser.id);
  const session = store.createSession(user.id, sessionMeta(req));
  setSessionCookie(reply, session);
  return { user: publicUser(user), csrf: session.csrf };
});

app.post("/api/auth/verify-email", async (req, reply) => {
  abuse.check("verifyEmailIp", clientIp(req));
  const consumed = store.consumeAccountToken("email_verify", req.body?.token);
  if (!consumed) return authError(reply, 400, "INVALID_TOKEN", "Verification link is invalid or expired.");
  const user = store.verifyUserEmail(consumed.userId);
  return { ok: true, user: publicUser(user) };
});

app.post("/api/auth/resend-verification", async (req) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  abuse.check("resendVerificationIp", clientIp(req));
  abuse.check("resendVerificationEmail", email || "missing");
  const user = store.getUserByEmail(email);
  if (!user || user.email_verified_at || user.deletion_scheduled_at) return { ok: true };
  const verification = await issueVerification(user, req, req.log);
  return { ok: true, email, verification };
});

app.post("/api/auth/forgot-password", async (req) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  abuse.check("forgotPasswordIp", clientIp(req));
  abuse.check("forgotPasswordEmail", email || "missing");
  const user = store.getUserByEmail(email);
  if (!user || user.deletion_scheduled_at) return { ok: true };
  const reset = await issuePasswordReset(user, req, req.log);
  return { ok: true, reset };
});

app.post("/api/auth/reset-password", async (req, reply) => {
  abuse.check("resetPasswordIp", clientIp(req));
  const password = String(req.body?.password || "");
  if (password.length < 8) {
    reply.status(400);
    return { error: "Password must be at least 8 characters." };
  }
  const consumed = store.consumeAccountToken("password_reset", req.body?.token);
  if (!consumed) return authError(reply, 400, "INVALID_TOKEN", "Password reset link is invalid or expired.");
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  store.setPasswordHash(consumed.userId, hash);
  store.verifyUserEmail(consumed.userId);
  store.deleteUserSessions(consumed.userId);
  return { ok: true };
});

app.post("/api/auth/logout", async (req, reply) => {
  if (req.user) requireCsrf(req);
  if (req.cookies.openpt_session) store.deleteSession(req.cookies.openpt_session);
  clearSessionCookie(reply);
  return { ok: true };
});

app.get("/api/me", async (req) => {
  if (!req.user) return { user: null };
  return { user: publicUser(req.user), csrf: req.user.csrf, usageBytes: store.userUsage(req.user.id), limits: store.limits };
});

app.get("/api/study/ccna/summary", async (req) => {
  const user = requireUser(req);
  const total = Number(req.query?.total || 0);
  return { dashboard: store.studySummary(user.id, "ccna", Number.isFinite(total) ? total : 0) };
});

app.post("/api/study/ccna/sessions", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("studySessionUser", user.id, { limit: 80, windowMs: 60 * 60_000 });
  const session = store.createStudySession(user.id, "ccna", req.body?.questionKeys || []);
  return { session };
});

app.post("/api/study/ccna/sessions/:id/attempts", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("studyAttemptUser", user.id, { limit: 900, windowMs: 60 * 60_000 });
  return store.recordStudyAttempt(user.id, "ccna", req.params.id, req.body || {});
});

app.post("/api/study/ccna/sessions/:id/finish", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const total = Number(req.body?.totalQuestionCount || 0);
  return store.finishStudySession(user.id, "ccna", req.params.id, Number.isFinite(total) ? total : 0);
});

app.get("/api/lessons/ccna/summary", async (req) => {
  const user = requireUser(req);
  return { dashboard: store.lessonSummary(user.id, "ccna") };
});

app.post("/api/lessons/ccna/:lessonId/start", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("lessonStartUser", user.id, { limit: 120, windowMs: 60 * 60_000 });
  return store.startLesson(user.id, "ccna", req.params.lessonId);
});

app.post("/api/lessons/ccna/:lessonId/events", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("lessonEventUser", user.id, { limit: 1200, windowMs: 60 * 60_000 });
  return store.recordLessonEvent(user.id, "ccna", req.params.lessonId, req.body || {});
});

app.post("/api/lessons/ccna/:lessonId/finish", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("lessonFinishUser", user.id, { limit: 240, windowMs: 60 * 60_000 });
  return store.finishLesson(user.id, "ccna", req.params.lessonId, req.body || {});
});

app.get("/api/sessions", async (req) => {
  const user = requireUser(req);
  return { sessions: store.listSessions(user.id, user.sessionId) };
});

app.delete("/api/sessions/:publicId", async (req, reply) => {
  const user = requireUser(req);
  requireCsrf(req);
  const currentRevoked = req.params.publicId === user.sessionPublicId;
  store.deleteSessionByPublicId(user.id, req.params.publicId);
  if (currentRevoked) clearSessionCookie(reply);
  return { ok: true, currentRevoked };
});

app.delete("/api/sessions", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const revoked = store.deleteOtherSessions(user.id, user.sessionId);
  return { ok: true, revoked };
});

app.delete("/api/account", async (req, reply) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("accountDeleteUser", user.id);
  const privateUser = store.getUserByEmail(user.email);
  const password = String(req.body?.password || "");
  if (!password || !privateUser || !(await argon2.verify(privateUser.password_hash, password))) {
    return authError(reply, 401, "INVALID_PASSWORD", "Password confirmation failed.");
  }
  const deletion = store.scheduleAccountDeletion(user.id);
  clearSessionCookie(reply);
  return { ok: true, ...deletion };
});

app.post("/api/account/deletion/cancel", async (req, reply) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  abuse.check("accountDeletionCancelIp", clientIp(req));
  abuse.check("accountDeletionCancelEmail", email || "missing");
  const privateUser = store.getUserByEmail(email);
  if (!privateUser || !privateUser.deletion_scheduled_at || !(await argon2.verify(privateUser.password_hash, password))) {
    return authError(reply, 401, "INVALID_EMAIL_OR_PASSWORD", "Invalid email or password.");
  }
  const user = store.cancelAccountDeletion(privateUser.id);
  const session = store.createSession(user.id, sessionMeta(req));
  setSessionCookie(reply, session);
  return { ok: true, user: publicUser(user), csrf: session.csrf };
});

app.get("/api/projects", async (req) => {
  const user = requireUser(req);
  return { projects: store.listProjects(user.id), usageBytes: store.userUsage(user.id), limits: store.limits };
});

app.post("/api/projects", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("projectCreateUser", user.id);
  const project = await store.createProject(user.id, req.body?.title, req.body?.document);
  const document = await store.loadProjectDocument(project);
  return { project: projectSummary(project), document };
});

app.get("/api/projects/:id", async (req) => {
  const user = requireUser(req);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const document = await store.loadProjectDocument(project);
  const lease = store.currentLease(project.id);
  return {
    project: projectSummary(project),
    document,
    lease: lease ? { clientId: lease.client_id, clientLabel: lease.client_label, expiresAt: lease.expires_at } : null
  };
});

app.post("/api/projects/:id", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const renamed = store.renameProject(project, req.body?.title);
  return { project: projectSummary(renamed) };
});

app.post("/api/projects/:id/duplicate", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("projectCreateUser", user.id);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const duplicate = await store.duplicateProject(user.id, project, req.body?.title);
  const document = await store.loadProjectDocument(duplicate);
  return { project: projectSummary(duplicate), document };
});

app.delete("/api/projects/:id", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const project = store.getProject(req.params.id, user.id);
  if (!project) return { ok: true };
  return store.deleteProject(project);
});

app.post("/api/projects/:id/lease", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const lease = store.acquireLease(project.id, {
    clientId: req.body?.clientId,
    clientLabel: req.body?.clientLabel,
    userId: user.id,
    takeover: !!req.body?.takeover
  });
  return { lease: { id: lease.lease_id, clientId: lease.client_id, clientLabel: lease.client_label, expiresAt: lease.expires_at } };
});

app.post("/api/projects/:id/lease/renew", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const lease = store.renewLease(project.id, req.body?.leaseId, req.body?.clientId);
  return { lease: { id: lease.lease_id, clientId: lease.client_id, clientLabel: lease.client_label, expiresAt: lease.expires_at } };
});

app.delete("/api/projects/:id/lease", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const project = store.getProject(req.params.id, user.id);
  if (project) store.releaseLease(project.id, req.body?.leaseId, req.body?.clientId);
  return { ok: true };
});

app.patch("/api/projects/:id", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("patchUser", user.id);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const result = await store.savePatch(project, req.body || {});
  return { project: projectSummary(result.project), document: result.document };
});

app.post("/api/projects/:id/share", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  abuse.check("shareCreateUser", user.id);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const mode = req.body?.mode === "edit" ? "edit" : "read";
  const share = store.createShare(project.id, mode);
  return { share: { token: share.token, mode, url: `/share/${share.token}` } };
});

app.post("/api/projects/:id/rollback", async (req) => {
  const user = requireUser(req);
  requireCsrf(req);
  const project = store.getProject(req.params.id, user.id);
  if (!project) {
    const err = new Error("Project not found.");
    err.statusCode = 404;
    throw err;
  }
  const result = await store.rollback(project, req.body?.target);
  return { project: { ...projectSummary(project), version: result.version }, document: result.document };
});

app.get("/api/share/:token", async (req) => {
  const project = store.getProjectByShare(req.params.token);
  if (!project) {
    const err = new Error("Share link not found.");
    err.statusCode = 404;
    throw err;
  }
  const document = await store.loadProjectDocument(project);
  const lease = store.currentLease(project.id);
  return {
    project: projectSummary(project, { shared: true, mode: project.mode }),
    document,
    lease: lease ? { clientId: lease.client_id, clientLabel: lease.client_label, expiresAt: lease.expires_at } : null
  };
});

app.post("/api/share/:token/lease", async (req) => {
  const project = store.getProjectByShare(req.params.token);
  if (!project || project.mode !== "edit") {
    const err = new Error("Editable share link not found.");
    err.statusCode = 404;
    throw err;
  }
  const lease = store.acquireLease(project.id, {
    clientId: req.body?.clientId,
    clientLabel: req.body?.clientLabel,
    shareToken: req.params.token,
    takeover: !!req.body?.takeover
  });
  return { lease: { id: lease.lease_id, clientId: lease.client_id, clientLabel: lease.client_label, expiresAt: lease.expires_at } };
});

app.patch("/api/share/:token", async (req) => {
  abuse.check("sharePatchToken", req.params.token);
  const project = store.getProjectByShare(req.params.token);
  if (!project || project.mode !== "edit") {
    const err = new Error("Editable share link not found.");
    err.statusCode = 404;
    throw err;
  }
  const result = await store.savePatch(project, { ...(req.body || {}), shareToken: req.params.token });
  return { project: projectSummary(result.project, { shared: true, mode: project.mode }), document: result.document };
});

if (!backendOnly) {
  app.get("/_vercel/insights/script.js", async (_req, reply) => {
    return reply.type("application/javascript").send("");
  });

  await app.register(staticPlugin, {
    root,
    prefix: "/",
    wildcard: false
  });

  app.get("/jeopardy-theme.m4a", async (req, reply) => {
    return reply.sendFile("01 Jeopardy (Main Theme).m4a");
  });

  app.get("/jeopardy-sfx/:file", async (req, reply) => {
    const allowed = new Set([
      "answer-reveal.mp3",
      "correct.mp3",
      "final-sting.mp3",
      "incorrect.mp3",
      "score-change.mp3",
      "tile-open.mp3",
      "timer-warning.mp3",
    ]);
    if (!allowed.has(req.params.file)) {
      return reply.status(404).send({ error: "Sound effect not found." });
    }
    return reply.sendFile(`public/audio/jeopardy-sfx/${req.params.file}`);
  });

  app.get("/lab", async (req, reply) => {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return reply.redirect(`/lab/${query}`, 308);
  });

  app.get("/lab/", async (req, reply) => {
    return reply.sendFile("index.html");
  });

  app.get("/learn", async (req, reply) => {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return reply.redirect(`/learn/${query}`, 308);
  });

  app.get("/learn/", async (req, reply) => {
    return reply.sendFile("index.html");
  });

  app.get("/quiz", async (req, reply) => {
    return reply.redirect("/quiz/?view=library", 308);
  });

  app.get("/quiz/ccna-b-diagrams", async (req, reply) => {
    return reply.sendFile("quiz/index.html");
  });

  app.get("/jeopardy", async (req, reply) => {
    return reply.sendFile("jeopardy.html");
  });

  app.get("/jeopardy/", async (req, reply) => {
    return reply.sendFile("jeopardy.html");
  });

  app.get("/wordle", async (req, reply) => {
    return reply.sendFile("wordle.html");
  });

  app.get("/wordle/", async (req, reply) => {
    return reply.sendFile("wordle.html");
  });

  app.get("/games", async (req, reply) => {
    return reply.sendFile("games.html");
  });

  app.get("/games/", async (req, reply) => {
    return reply.sendFile("games.html");
  });

  app.get("/firewall", async (req, reply) => {
    return reply.sendFile("firewall.html");
  });

  app.get("/firewall/", async (req, reply) => {
    return reply.sendFile("firewall.html");
  });

  app.get("/bomb", async (req, reply) => {
    return reply.sendFile("bomb.html");
  });

  app.get("/bomb/", async (req, reply) => {
    return reply.sendFile("bomb.html");
  });

  app.get("/casino", async (req, reply) => {
    return reply.sendFile("ccnacasino.html");
  });

  app.get("/casino/", async (req, reply) => {
    return reply.sendFile("ccnacasino.html");
  });

  app.get("/share/:token", async (req, reply) => {
    return reply.sendFile("index.html");
  });
}

app.setNotFoundHandler((req, reply) => {
  if (req.raw.url?.startsWith("/api/")) return reply.status(404).send({ error: "Not found" });
  if (backendOnly) return reply.status(404).send({ error: "OpenPT API only." });
  return reply.sendFile("index.html");
});

await app.listen({ port, host });
app.log.info(`OpenPT running at http://${host}:${port}`);
