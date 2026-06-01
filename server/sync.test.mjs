import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObjectStore } from "./object-store.mjs";
import { OpenPTStore } from "./storage.mjs";
import { applyJsonPatch } from "./json-patch.mjs";
import { AbuseGuard } from "./abuse-guard.mjs";

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), "openpt-sync-"));
  const store = new OpenPTStore({
    dbPath: join(dir, "openpt.sqlite"),
    objectStore: new ObjectStore(join(dir, "objects"))
  });
  return { dir, store };
}

test("applies object-map style project patches", () => {
  const next = applyJsonPatch({ devices: { a: { hostname: "R1" } }, links: [] }, [
    { op: "replace", path: "/devices/a", value: { hostname: "R2" } },
    { op: "add", path: "/devices/b", value: { hostname: "SW1" } },
    { op: "replace", path: "/links", value: [{ id: "l1" }] }
  ]);
  assert.equal(next.devices.a.hostname, "R2");
  assert.equal(next.devices.b.hostname, "SW1");
  assert.equal(next.links.length, 1);
});

test("rejects missing replace/remove paths and handles root replacement", () => {
  assert.throws(() => applyJsonPatch({ title: "Lab" }, [
    { op: "replace", path: "/missing", value: "Nope" }
  ]), /Patch path not found/);
  assert.throws(() => applyJsonPatch({ title: "Lab" }, [
    { op: "remove", path: "/missing" }
  ]), /Patch path not found/);
  assert.deepEqual(applyJsonPatch({ title: "Lab" }, [
    { op: "replace", path: "", value: { title: "Root", devices: {} } }
  ]), { title: "Root", devices: {} });
  assert.throws(() => applyJsonPatch({ title: "Lab" }, [
    { op: "remove", path: "" }
  ]), /document root/);
});

test("requires current base version and valid edit lease for patch saves", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("a@example.com", "hash");
    const project = await store.createProject(user.id, "Lab", { schemaVersion: 1, title: "Lab", devices: {}, links: [], uiState: {} });
    store.db.prepare("UPDATE projects SET last_save_at=? WHERE id=?").run(new Date(Date.now() - 11_000).toISOString(), project.id);
    project.last_save_at = new Date(Date.now() - 11_000).toISOString();
    const lease = store.acquireLease(project.id, { clientId: "client-a", clientLabel: "Mac browser", userId: user.id });
    const saved = await store.savePatch(project, {
      baseVersion: 1,
      leaseId: lease.lease_id,
      clientId: "client-a",
      patches: [{ op: "replace", path: "/title", value: "Lab 2" }],
      uiStatePatch: []
    });
    assert.equal(saved.project.head_version, 2);
    assert.equal(saved.document.title, "Lab 2");
    await assert.rejects(() => store.savePatch(saved.project, {
      baseVersion: 1,
      leaseId: lease.lease_id,
      clientId: "client-a",
      patches: [],
      uiStatePatch: []
    }), /newer project version|Autosave rate limit/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("share links load the latest saved project document", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("share@example.com", "hash");
    const project = await store.createProject(user.id, "Lab", { schemaVersion: 1, title: "Lab", devices: {}, links: [], uiState: {} });
    store.db.prepare("UPDATE projects SET last_save_at=? WHERE id=?").run(new Date(Date.now() - 11_000).toISOString(), project.id);
    project.last_save_at = new Date(Date.now() - 11_000).toISOString();
    const lease = store.acquireLease(project.id, { clientId: "client-a", clientLabel: "Mac browser", userId: user.id });
    const saved = await store.savePatch(project, {
      baseVersion: 1,
      leaseId: lease.lease_id,
      clientId: "client-a",
      patches: [{ op: "replace", path: "/title", value: "Latest Lab" }],
      uiStatePatch: []
    });
    const share = store.createShare(saved.project.id, "read");
    const sharedProject = store.getProjectByShare(share.token);
    const sharedDocument = await store.loadProjectDocument(sharedProject);
    assert.equal(sharedProject.head_version, 2);
    assert.equal(sharedDocument.title, "Latest Lab");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("account tokens are hashed, single-use, and expire", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("token@example.com", "hash");
    const issued = store.createAccountToken(user.id, "email_verify", 60_000);
    const raw = store.db.prepare("SELECT token_hash FROM account_tokens WHERE user_id=?").get(user.id);
    assert.notEqual(raw.token_hash, issued.token);
    assert.equal(store.consumeAccountToken("email_verify", issued.token).userId, user.id);
    assert.equal(store.consumeAccountToken("email_verify", issued.token), null);

    const expired = store.createAccountToken(user.id, "password_reset", 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(store.consumeAccountToken("password_reset", expired.token), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scheduled account purge removes user rows and unreferenced objects", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("purge@example.com", "hash", { verified: true });
    const project = await store.createProject(user.id, "Purge Lab", { schemaVersion: 1, title: "Purge Lab", devices: {}, links: [], uiState: {} });
    const objectKey = project.head_object_key;
    store.db.prepare("UPDATE users SET deletion_requested_at=?, deletion_scheduled_at=? WHERE id=?")
      .run(new Date(Date.now() - 2_000).toISOString(), new Date(Date.now() - 1_000).toISOString(), user.id);
    const result = await store.purgeScheduledAccounts();
    assert.equal(result.purged, 1);
    assert.equal(store.getUserByEmail("purge@example.com"), undefined);
    assert.equal(store.objectKeyStillReferenced(objectKey), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renames, duplicates, and soft-deletes projects", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("browser@example.com", "hash");
    const project = await store.createProject(user.id, "Lab", { schemaVersion: 1, title: "Lab", devices: { d1: { hostname: "R1" } }, links: [], uiState: {} });
    const renamed = store.renameProject(project, "Renamed Lab");
    assert.equal(renamed.title, "Renamed Lab");

    const copy = await store.duplicateProject(user.id, renamed, "Renamed Lab copy");
    const copyDoc = await store.loadProjectDocument(copy);
    assert.equal(copy.title, "Renamed Lab copy");
    assert.equal(copyDoc.title, "Renamed Lab copy");
    assert.equal(copyDoc.devices.d1.hostname, "R1");

    store.deleteProject(renamed);
    assert.equal(store.getProject(renamed.id, user.id), undefined);
    assert.equal(store.listProjects(user.id).some((item) => item.id === copy.id), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("blocks a second client unless takeover is requested", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("b@example.com", "hash");
    const project = await store.createProject(user.id, "Lab", { schemaVersion: 1, title: "Lab", devices: {}, links: [], uiState: {} });
    store.acquireLease(project.id, { clientId: "client-a", clientLabel: "Desktop", userId: user.id });
    assert.throws(() => store.acquireLease(project.id, { clientId: "client-b", clientLabel: "Laptop", userId: user.id }), /another device/);
    const lease = store.acquireLease(project.id, { clientId: "client-b", clientLabel: "Laptop", userId: user.id, takeover: true });
    assert.equal(lease.client_id, "client-b");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("abuse guard rate limits repeated keys with retry-after", () => {
  const guard = new AbuseGuard({ tiny: { limit: 2, windowMs: 60_000 } });
  guard.check("tiny", "ip:1");
  guard.check("tiny", "ip:1");
  assert.throws(() => guard.check("tiny", "ip:1"), (err) => {
    assert.equal(err.statusCode, 429);
    assert.ok(err.retryAfter > 0);
    return true;
  });
});
