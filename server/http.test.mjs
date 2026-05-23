import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

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
  assert.equal(res.status, 200);
  const body = await res.json();
  return {
    cookie: res.headers.get("set-cookie").split(";")[0],
    csrf: body.csrf || res.headers.get("x-openpt-csrf"),
    user: body.user,
  };
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
    assert.equal(first.status, 200);
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
        origin: "https://openpt.skylarenns.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://openpt.skylarenns.com");

    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        origin: "https://openpt.skylarenns.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "custom-origin@example.com", password: "password123" }),
    });
    assert.equal(register.status, 200);
    assert.equal(register.headers.get("access-control-allow-origin"), "https://openpt.skylarenns.com");
  });
});

test("frontend serves lab and quiz path entrypoints", { timeout: 15_000 }, async () => {
  await withTestServer({}, async (baseUrl) => {
    const labRedirect = await fetch(`${baseUrl}/lab`, { redirect: "manual" });
    assert.equal(labRedirect.status, 308);
    assert.equal(labRedirect.headers.get("location"), "/lab/");

    const lab = await fetch(`${baseUrl}/lab/`);
    assert.equal(lab.status, 200);
    const labHtml = await lab.text();
    assert.match(labHtml, /<title>OpenPT<\/title>/);
    assert.match(labHtml, /<base href="\/" \/>/);

    const quizRedirect = await fetch(`${baseUrl}/quiz`, { redirect: "manual" });
    assert.equal(quizRedirect.status, 308);
    assert.equal(quizRedirect.headers.get("location"), "/quiz/");

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
