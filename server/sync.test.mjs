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
