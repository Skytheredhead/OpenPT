import assert from "node:assert/strict";
import test from "node:test";
import { lessonCatalogStats, loadLessonCatalog, validateLessonCatalog } from "./lesson-catalog.mjs";

test("CCNA lesson catalog exposes exactly the Semester 1 guided mission path", () => {
  const catalog = loadLessonCatalog();
  const errors = validateLessonCatalog(catalog);
  assert.deepEqual(errors, []);

  assert.equal(catalog.lessons.length, 13);
  assert.equal(catalog.lessons.every((lesson) => lesson.semester === "sem-01"), true);
  assert.equal(catalog.semesters.find((semester) => semester.id === "sem-01")?.status, "available");
  assert.equal(catalog.semesters.find((semester) => semester.id === "sem-02")?.status, "planned");
  assert.equal(catalog.semesters.find((semester) => semester.id === "sem-03")?.status, "planned");
});

test("CCNA lesson prerequisites, factories, banks, and checkpoints are internally valid", () => {
  const catalog = loadLessonCatalog();
  const lessonIds = new Set(catalog.lessons.map((lesson) => lesson.id));
  const moduleBanks = new Set(catalog.moduleBanks);
  const factories = new Set(catalog.labFactories);

  for (const lesson of catalog.lessons) {
    assert.ok(moduleBanks.has(lesson.moduleBank), `${lesson.id} has a known module bank`);
    assert.ok(factories.has(lesson.labFactory), `${lesson.id} has a known lab factory`);
    assert.ok(lesson.estimatedMinutes >= 10 && lesson.estimatedMinutes <= 15, `${lesson.id} stays in the 10-15 minute range`);
    assert.ok(lesson.prerequisites.every((id) => lessonIds.has(id)), `${lesson.id} prerequisites exist`);
    assert.ok(lesson.steps.length >= 4, `${lesson.id} has a real mission arc`);

    const stepIds = new Set();
    let stepXp = 0;
    for (const step of lesson.steps) {
      assert.ok(!stepIds.has(step.id), `${lesson.id}/${step.id} is unique`);
      stepIds.add(step.id);
      assert.ok(step.prompt.trim().length > 20, `${lesson.id}/${step.id} has an authored prompt`);
      assert.ok(step.hints.length > 0, `${lesson.id}/${step.id} has staged hints`);
      assert.ok(step.checks.length > 0, `${lesson.id}/${step.id} has simulator checks`);
      assert.ok(step.commandCoach.trim(), `${lesson.id}/${step.id} has command coaching`);
      assert.ok(step.explanation.trim(), `${lesson.id}/${step.id} has an explanation`);
      stepXp += step.xp;
    }
    assert.ok(stepXp <= lesson.xp, `${lesson.id} step XP does not exceed lesson cap`);
  }
});

test("CCNA lesson catalog stats are stable for progress summary consumers", () => {
  const stats = lessonCatalogStats();
  assert.equal(stats.courseId, "ccna");
  assert.equal(stats.totalLessons, 13);
  assert.ok(stats.totalXp > 0);
  assert.equal(stats.lessons[0].id, "sem1-m1-3-network-roles");
  assert.equal(stats.lessons.at(-1).id, "sem1-final-small-office-capstone");
});
