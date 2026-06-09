import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { findLesson } from "./lesson-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child) {
  const started = Date.now();
  while (Date.now() - started < 8_000) {
    if (child.exitCode != null) throw new Error(`Server exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch (err) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for test server health endpoint.");
}

async function stopChild(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function withTestServer(env, fn) {
  const dir = await mkdtemp(join(tmpdir(), "openpt-http-"));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: join(__dirname, ".."),
    env: {
      ...process.env,
      OPENPT_DATA_DIR: dir,
      PORT: String(port),
      HOST: "127.0.0.1",
      OPENPT_ACCOUNT_EMAIL_DEBUG: "1",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForHealth(baseUrl, child);
    await fn(baseUrl, child);
  } finally {
    await stopChild(child);
    await rm(dir, { recursive: true, force: true });
  }
}

async function registerSession(baseUrl, email = "lease@example.com") {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.needsVerification, true);
  assert.ok(body.verification?.token);
  const verify = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: body.verification.token }),
  });
  assert.equal(verify.status, 200);
  return loginSession(baseUrl, email);
}

async function loginSession(baseUrl, email = "lease@example.com") {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  return {
    cookie: res.headers.get("set-cookie").split(";")[0],
    csrf: body.csrf || res.headers.get("x-openpt-csrf"),
    user: body.user,
  };
}

test("duplicate registration returns 409 without leaking sqlite internals", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const payload = { email: "duplicate@example.com", password: "password123" };
    const first = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(first.status, 202);
    const second = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await second.json();
    assert.equal(second.status, 409);
    assert.equal(body.error, "Account already exists.");
    assert.match(JSON.stringify(body), /^((?!UNIQUE|SQLITE|constraint).)*$/);
  });
});

test("production frontend origin can register against backend-only API", { timeout: 15_000 }, async () => {
  await withTestServer({ OPENPT_BACKEND_ONLY: "1" }, async (baseUrl) => {
    const root = await fetch(`${baseUrl}/`);
    assert.equal(root.status, 404);
    assert.equal(root.headers.get("content-type")?.includes("application/json"), true);

    const preflight = await fetch(`${baseUrl}/api/auth/register`, {
      method: "OPTIONS",
      headers: {
        origin: "https://openpt.dev",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://openpt.dev");

    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        origin: "https://openpt.dev",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "custom-origin@example.com", password: "password123" }),
    });
    assert.equal(register.status, 202);
    assert.equal(register.headers.get("access-control-allow-origin"), "https://openpt.dev");
  });
});

test("email verification gates login and uses single-use token", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const email = "verify@example.com";
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    assert.equal(register.status, 202);
    const registered = await register.json();

    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, "EMAIL_NOT_VERIFIED");

    const verify = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: registered.verification.token }),
    });
    assert.equal(verify.status, 200);

    const reused = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: registered.verification.token }),
    });
    assert.equal(reused.status, 400);

    const session = await loginSession(baseUrl, email);
    assert.equal(session.user.email, email);
  });
});

test("password reset is generic, single-use, and revokes sessions", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const email = "reset@example.com";
    const session = await registerSession(baseUrl, email);
    const forgot = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert.equal(forgot.status, 200);
    const forgotBody = await forgot.json();
    assert.ok(forgotBody.reset?.token);

    const reset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: forgotBody.reset.token, password: "newpassword123" }),
    });
    assert.equal(reset.status, 200);

    const oldMe = await fetch(`${baseUrl}/api/me`, { headers: { cookie: session.cookie } });
    assert.equal((await oldMe.json()).user, null);

    const reused = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: forgotBody.reset.token, password: "anotherpass123" }),
    });
    assert.equal(reused.status, 400);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "newpassword123" }),
    });
    assert.equal(login.status, 200);
  });
});

test("sessions can be listed and revoked by public ids", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const email = "sessions@example.com";
    const first = await registerSession(baseUrl, email);
    const second = await loginSession(baseUrl, email);
    const list = await fetch(`${baseUrl}/api/sessions`, { headers: { cookie: first.cookie } });
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.equal(body.sessions.length, 2);
    assert.ok(body.sessions.every((session) => session.id && !session.id.includes("=")));
    assert.ok(body.sessions.some((session) => session.current));

    const other = body.sessions.find((session) => !session.current);
    const revoke = await fetch(`${baseUrl}/api/sessions/${other.id}`, {
      method: "DELETE",
      headers: { cookie: first.cookie, "x-openpt-csrf": first.csrf },
    });
    assert.equal(revoke.status, 200);

    const secondMe = await fetch(`${baseUrl}/api/me`, { headers: { cookie: second.cookie } });
    assert.equal((await secondMe.json()).user, null);
  });
});

test("ccna study endpoints require auth and record timed session progress", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const anonSummary = await fetch(`${baseUrl}/api/study/ccna/summary`);
    assert.equal(anonSummary.status, 401);

    const session = await registerSession(baseUrl, "study@example.com");
    const questionKeys = Array.from({ length: 25 }, (_, index) => `ccna/test/q-${index + 1}`);

    const blockedCreate = await fetch(`${baseUrl}/api/study/ccna/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
      },
      body: JSON.stringify({ questionKeys }),
    });
    assert.equal(blockedCreate.status, 403);

    const create = await fetch(`${baseUrl}/api/study/ccna/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ questionKeys }),
    });
    assert.equal(create.status, 200);
    const created = await create.json();
    assert.equal(created.session.questionKeys.length, 20);

    const firstKey = created.session.questionKeys[0];
    const attempt = await fetch(`${baseUrl}/api/study/ccna/sessions/${created.session.id}/attempts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({
        questionKey: firstKey,
        selectedAnswers: [0],
        correct: true,
        answerDurationMs: 21_000,
      }),
    });
    assert.equal(attempt.status, 200);
    const attemptBody = await attempt.json();
    assert.equal(attemptBody.attempt.correct, true);
    assert.equal(attemptBody.attempt.slow, true);
    assert.equal(attemptBody.attempt.interrupted, false);

    const interruptedAttempt = await fetch(`${baseUrl}/api/study/ccna/sessions/${created.session.id}/attempts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({
        questionKey: created.session.questionKeys[1],
        selectedAnswers: [1],
        correct: false,
        answerDurationMs: 130_000,
      }),
    });
    assert.equal(interruptedAttempt.status, 200);
    const interruptedBody = await interruptedAttempt.json();
    assert.equal(interruptedBody.attempt.correct, false);
    assert.equal(interruptedBody.attempt.slow, false);
    assert.equal(interruptedBody.attempt.interrupted, true);

    const finish = await fetch(`${baseUrl}/api/study/ccna/sessions/${created.session.id}/finish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ totalQuestionCount: questionKeys.length }),
    });
    assert.equal(finish.status, 200);
    const finished = await finish.json();
    assert.equal(finished.session.scoredCount, 1);
    assert.equal(finished.session.score, 100);
    assert.equal(finished.session.slowCount, 1);
    assert.equal(finished.session.interruptedCount, 1);
    assert.equal(finished.dashboard.slowCount, 1);
    assert.equal(finished.dashboard.interruptedCount, 1);
    assert.equal(finished.dashboard.activeWeakCount, 2);

    const summary = await fetch(`${baseUrl}/api/study/ccna/summary?total=${questionKeys.length}`, {
      headers: { cookie: session.cookie },
    });
    assert.equal(summary.status, 200);
    const summaryBody = await summary.json();
    assert.equal(summaryBody.dashboard.recentScore, 100);
  });
});

test("ccna lesson endpoints require auth, csrf, and server-calculated XP", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const lesson = findLesson("sem1-m1-3-network-roles");
    const stepIds = lesson.steps.map((step) => step.id);
    const stepXp = lesson.steps.reduce((sum, step) => sum + step.xp, 0);

    const anonSummary = await fetch(`${baseUrl}/api/lessons/ccna/summary`);
    assert.equal(anonSummary.status, 401);

    const session = await registerSession(baseUrl, "lessons@example.com");

    const blockedStart = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
      },
      body: JSON.stringify({}),
    });
    assert.equal(blockedStart.status, 403);

    const summary = await fetch(`${baseUrl}/api/lessons/ccna/summary`, {
      headers: { cookie: session.cookie },
    });
    assert.equal(summary.status, 200);
    const summaryBody = await summary.json();
    assert.equal(summaryBody.dashboard.totalLessons, 13);
    assert.equal(summaryBody.dashboard.completedLessons, 0);

    const start = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/start`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({}),
    });
    assert.equal(start.status, 200);
    const started = await start.json();
    assert.equal(started.lesson.lessonId, lesson.id);
    assert.equal(started.lesson.currentStepId, stepIds[0]);

    const firstEventId = "lesson-test-first-event";
    const firstEvent = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({
        eventType: "checkpoint",
        stepId: stepIds[0],
        clientEventId: firstEventId,
        earnedXp: 9999,
        payload: { rawCommand: "enable secret forged", commandKind: "manual" },
      }),
    });
    assert.equal(firstEvent.status, 200);
    const firstEventBody = await firstEvent.json();
    assert.equal(firstEventBody.event.earnedXp, lesson.steps[0].xp);
    assert.equal(firstEventBody.lesson.xp, lesson.steps[0].xp);

    const duplicateEvent = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({
        eventType: "checkpoint",
        stepId: stepIds[0],
        clientEventId: firstEventId,
        earnedXp: 9999,
      }),
    });
    assert.equal(duplicateEvent.status, 200);
    const duplicateBody = await duplicateEvent.json();
    assert.equal(duplicateBody.lesson.xp, lesson.steps[0].xp);

    const earlyFinish = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/finish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ clientEventId: "lesson-test-early-finish", completed: true, earnedXp: 9999 }),
    });
    assert.equal(earlyFinish.status, 200);
    const earlyFinishBody = await earlyFinish.json();
    assert.equal(earlyFinishBody.lesson.status, "started");

    for (const stepId of stepIds.slice(1)) {
      const event = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: session.cookie,
          "x-openpt-csrf": session.csrf,
        },
        body: JSON.stringify({
          eventType: "checkpoint",
          stepId,
          clientEventId: `lesson-test-${stepId}`,
          earnedXp: 9999,
        }),
      });
      assert.equal(event.status, 200);
    }

    const finish = await fetch(`${baseUrl}/api/lessons/ccna/${lesson.id}/finish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ clientEventId: "lesson-test-final-finish", earnedXp: 9999 }),
    });
    assert.equal(finish.status, 200);
    const finished = await finish.json();
    assert.equal(finished.lesson.status, "completed");
    assert.equal(finished.lesson.xp, Math.min(lesson.xp, stepXp));
    assert.equal(finished.dashboard.completedLessons, 1);
    assert.equal(finished.dashboard.earnedXp, Math.min(lesson.xp, stepXp));
    assert.equal(finished.dashboard.currentStreak, 1);
  });
});

test("account deletion can be scheduled and cancelled during grace period", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const email = "delete-me@example.com";
    const session = await registerSession(baseUrl, email);
    const deletion = await fetch(`${baseUrl}/api/account`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ password: "password123" }),
    });
    assert.equal(deletion.status, 200);
    const deletionBody = await deletion.json();
    assert.ok(deletionBody.deletionScheduledAt);

    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, "ACCOUNT_DELETION_PENDING");

    const cancel = await fetch(`${baseUrl}/api/account/deletion/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    });
    assert.equal(cancel.status, 200);
    const cancelBody = await cancel.json();
    assert.equal(cancelBody.user.email, email);
    assert.ok(cancel.headers.get("set-cookie"));
  });
});

test("frontend serves lab and quiz path entrypoints", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const labRedirect = await fetch(`${baseUrl}/lab`, { redirect: "manual" });
    assert.equal(labRedirect.status, 308);
    assert.equal(labRedirect.headers.get("location"), "/lab/");

    const labQueryRedirect = await fetch(`${baseUrl}/lab?lab=ccna-b-q1-48-etherchannel-vlan&embed=quiz`, { redirect: "manual" });
    assert.equal(labQueryRedirect.status, 308);
    assert.equal(labQueryRedirect.headers.get("location"), "/lab/?lab=ccna-b-q1-48-etherchannel-vlan&embed=quiz");

    const lab = await fetch(`${baseUrl}/lab/`);
    assert.equal(lab.status, 200);
    const labHtml = await lab.text();
    assert.match(labHtml, /<title>OpenPT<\/title>/);
    assert.match(labHtml, /<base href="\/" \/>/);

    const learnRedirect = await fetch(`${baseUrl}/learn`, { redirect: "manual" });
    assert.equal(learnRedirect.status, 308);
    assert.equal(learnRedirect.headers.get("location"), "/learn/");

    const learn = await fetch(`${baseUrl}/learn/`);
    assert.equal(learn.status, 200);
    const learnHtml = await learn.text();
    assert.match(learnHtml, /learn\.jsx/);

    const quizRedirect = await fetch(`${baseUrl}/quiz`, { redirect: "manual" });
    assert.equal(quizRedirect.status, 308);
    assert.equal(quizRedirect.headers.get("location"), "/quiz/?view=library");

    const quiz = await fetch(`${baseUrl}/quiz/`);
    assert.equal(quiz.status, 200);
    const quizHtml = await quiz.text();
    assert.match(quizHtml, /<title>OpenPT Quiz v0\.1<\/title>/);

    const quizStyles = await fetch(`${baseUrl}/quiz/styles.css`);
    assert.equal(quizStyles.status, 200);
    assert.match(quizStyles.headers.get("content-type") || "", /text\/css/);
  });
});

test("logout requires csrf and released leases can be reacquired after logout", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const session = await registerSession(baseUrl);
    const projectRes = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({
        title: "Lease Lab",
        document: { schemaVersion: 1, title: "Lease Lab", devices: {}, links: [], uiState: {} },
      }),
    });
    assert.equal(projectRes.status, 200);
    const projectBody = await projectRes.json();

    const leaseRes = await fetch(`${baseUrl}/api/projects/${projectBody.project.id}/lease`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ clientId: "client-a", clientLabel: "A" }),
    });
    assert.equal(leaseRes.status, 200);
    const leaseBody = await leaseRes.json();

    const blockedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: session.cookie },
    });
    assert.equal(blockedLogout.status, 403);

    const releaseRes = await fetch(`${baseUrl}/api/projects/${projectBody.project.id}/lease`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
      body: JSON.stringify({ clientId: "client-a", leaseId: leaseBody.lease.id }),
    });
    assert.equal(releaseRes.status, 200);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
    });
    assert.equal(logoutRes.status, 200);

    const nextSession = await loginSession(baseUrl);
    const nextLeaseRes = await fetch(`${baseUrl}/api/projects/${projectBody.project.id}/lease`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: nextSession.cookie,
        "x-openpt-csrf": nextSession.csrf,
      },
      body: JSON.stringify({ clientId: "client-b", clientLabel: "B" }),
    });
    assert.equal(nextLeaseRes.status, 200);
    const nextLeaseBody = await nextLeaseRes.json();
    assert.equal(nextLeaseBody.lease.clientId, "client-b");
  });
});

test("admin storage endpoints are hidden without a token and guarded with bearer auth", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const hidden = await fetch(`${baseUrl}/api/admin/backups`, { method: "POST" });
    assert.equal(hidden.status, 404);
  });

  await withTestServer({ OPENPT_ADMIN_TOKEN: "test-admin-token" }, async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/admin/storage/cleanup`, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(invalid.status, 401);

    const cleanup = await fetch(`${baseUrl}/api/admin/storage/cleanup`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-admin-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(cleanup.status, 200);
    assert.equal((await cleanup.json()).dryRun, true);

    const backup = await fetch(`${baseUrl}/api/admin/backups`, {
      method: "POST",
      headers: { authorization: "Bearer test-admin-token" },
    });
    assert.equal(backup.status, 200);
    const body = await backup.json();
    assert.match(body.backup.id, /^openpt-/);
  });
});

test("project browser cloud actions rename duplicate and delete", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const session = await registerSession(baseUrl, "browser-actions@example.com");
    const authHeaders = {
      "content-type": "application/json",
      cookie: session.cookie,
      "x-openpt-csrf": session.csrf,
    };
    const create = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Browser Lab",
        document: { schemaVersion: 1, title: "Browser Lab", devices: { d1: { hostname: "R1" } }, links: [], uiState: {} },
      }),
    });
    assert.equal(create.status, 200);
    const created = await create.json();

    const rename = await fetch(`${baseUrl}/api/projects/${created.project.id}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ title: "Renamed Browser Lab" }),
    });
    assert.equal(rename.status, 200);
    assert.equal((await rename.json()).project.title, "Renamed Browser Lab");

    const duplicate = await fetch(`${baseUrl}/api/projects/${created.project.id}/duplicate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ title: "Browser Lab Copy" }),
    });
    assert.equal(duplicate.status, 200);
    const copied = await duplicate.json();
    assert.equal(copied.project.title, "Browser Lab Copy");
    assert.equal(copied.document.devices.d1.hostname, "R1");

    const del = await fetch(`${baseUrl}/api/projects/${created.project.id}`, {
      method: "DELETE",
      headers: {
        cookie: session.cookie,
        "x-openpt-csrf": session.csrf,
      },
    });
    assert.equal(del.status, 200);

    const list = await fetch(`${baseUrl}/api/projects`, { headers: { cookie: session.cookie } });
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.projects.some((project) => project.id === created.project.id), false);
    assert.equal(listed.projects.some((project) => project.id === copied.project.id), true);
  });
});
