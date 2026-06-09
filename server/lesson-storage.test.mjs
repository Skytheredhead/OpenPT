import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObjectStore } from "./object-store.mjs";
import { OpenPTStore } from "./storage.mjs";

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), "openpt-lesson-store-"));
  const store = new OpenPTStore({
    dbPath: join(dir, "openpt.sqlite"),
    objectStore: new ObjectStore(join(dir, "objects"))
  });
  return { dir, store };
}

test("lesson events strip raw command and secret payload fields", async () => {
  const { dir, store } = await makeStore();
  try {
    const user = store.createUser("lesson-storage@example.com", "hash", { verified: true });
    const lessonId = "sem1-m1-3-network-roles";
    const stepId = "predict-traffic";

    store.startLesson(user.id, "ccna", lessonId);
    const recorded = store.recordLessonEvent(user.id, "ccna", lessonId, {
      eventType: "checkpoint",
      stepId,
      clientEventId: "lesson-storage-test-event",
      earnedXp: 9999,
      payload: {
        rawCommand: "enable secret class",
        command: "username admin secret class",
        commandKind: "hostname",
        password: "class",
        nested: { token: "secret-token", device: "SW1" }
      }
    });

    assert.equal(recorded.event.earnedXp, 15);
    const row = store.db.prepare("SELECT payload_json FROM lesson_events WHERE id=?").get("lesson-storage-test-event");
    const payload = JSON.parse(row.payload_json);
    assert.equal(payload.rawCommand, undefined);
    assert.equal(payload.command, undefined);
    assert.equal(payload.password, undefined);
    assert.equal(payload.nested.token, undefined);
    assert.equal(payload.commandKind, "hostname");
    assert.equal(payload.nested.device, "SW1");
  } finally {
    store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
