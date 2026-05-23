import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import argon2 from "argon2";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectStore } from "./object-store.mjs";
import { OpenPTStore, LIMITS } from "./storage.mjs";
import { AbuseGuard, clientIp } from "./abuse-guard.mjs";
import { reportFingerprint, sanitizeErrorReport, sendErrorReportEmail } from "./error-report.mjs";
import { sanitizeFeedback, sendFeedbackEmail } from "./feedback.mjs";

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
  "https://openpt.skylarenns.com",
  "https://openpt.vercel.app",
  "https://open-pt.vercel.app"
];
const allowedOrigins = (process.env.OPENPT_ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const backendOnly = process.env.OPENPT_BACKEND_ONLY === "1";

const app = Fastify({ logger: true, bodyLimit: 520 * 1024 * 1024 });
const store = new OpenPTStore({
  dbPath: join(dataDir, "openpt.sqlite"),
  objectStore: new ObjectStore(join(dataDir, "objects"))
});
const abuse = new AbuseGuard();
setInterval(() => abuse.sweep(), 10 * 60_000).unref();

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
  return { id: user.id, email: user.email };
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
    statusCode: status,
    lease: err.lease ? {
      clientId: err.lease.client_id,
      clientLabel: err.lease.client_label,
      expiresAt: err.lease.expires_at
    } : undefined,
    serverVersion: err.serverVersion
  });
});

app.get("/api/health", async () => ({ ok: true, limits: LIMITS }));

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
  const session = store.createSession(user.id);
  setSessionCookie(reply, session);
  return { user: publicUser(user), csrf: session.csrf };
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
  const user = store.getUserById(privateUser.id);
  const session = store.createSession(user.id);
  setSessionCookie(reply, session);
  return { user: publicUser(user), csrf: session.csrf };
});

app.post("/api/auth/logout", async (req, reply) => {
  if (req.user) requireCsrf(req);
  if (req.cookies.openpt_session) store.deleteSession(req.cookies.openpt_session);
  reply.clearCookie("openpt_session", { path: "/" });
  return { ok: true };
});

app.get("/api/me", async (req) => {
  if (!req.user) return { user: null };
  return { user: publicUser(req.user), csrf: req.user.csrf, usageBytes: store.userUsage(req.user.id), limits: LIMITS };
});

app.get("/api/projects", async (req) => {
  const user = requireUser(req);
  return { projects: store.listProjects(user.id), usageBytes: store.userUsage(user.id), limits: LIMITS };
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
  await app.register(staticPlugin, {
    root,
    prefix: "/",
    wildcard: false
  });

  app.get("/lab", async (req, reply) => {
    return reply.redirect("/lab/", 308);
  });

  app.get("/lab/", async (req, reply) => {
    return reply.sendFile("index.html");
  });

  app.get("/quiz", async (req, reply) => {
    return reply.redirect("/quiz/", 308);
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
