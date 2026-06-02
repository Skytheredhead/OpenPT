import test from "node:test";
import assert from "node:assert/strict";
import { scheduleStudySession, nextProgressForAttempt, STUDY_FAST_ANSWER_MS, STUDY_INTERRUPTED_ANSWER_MS } from "./study-scheduler.mjs";

const keys = Array.from({ length: 30 }, (_, index) => `q-${String(index + 1).padStart(2, "0")}`);

test("study scheduler caps due reviews and fills the rest with unseen questions", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const progressRows = keys.slice(0, 12).map((question_key, index) => ({
    question_key,
    seen_count: 2,
    miss_count: index + 1,
    slow_count: 0,
    review_streak: 0,
    next_due_at: now.toISOString(),
    last_seen_at: new Date(now.getTime() - index * 1000).toISOString(),
  }));
  const selected = scheduleStudySession({ questionKeys: keys, progressRows, now, rng: () => 0 });
  assert.equal(selected.length, 20);
  assert.deepEqual(selected.slice(0, 8), ["q-12", "q-11", "q-10", "q-09", "q-08", "q-07", "q-06", "q-05"]);
  assert.equal(selected.slice(8).every((key) => !keys.slice(0, 12).includes(key)), true);
});

test("study scheduler treats slow questions as due reviews", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const selected = scheduleStudySession({
    questionKeys: keys,
    now,
    rng: () => 0,
    progressRows: [{
      question_key: "q-03",
      seen_count: 1,
      miss_count: 0,
      slow_count: 2,
      review_streak: 0,
      next_due_at: now.toISOString(),
    }],
  });
  assert.equal(selected[0], "q-03");
});

test("four fast later wins master a missed question while slow answers reset confidence", () => {
  const missed = nextProgressForAttempt(null, { correct: false, durationMs: 3000, now: new Date("2026-01-01T00:00:00.000Z") });
  assert.equal(missed.progress.miss_count, 1);
  assert.equal(missed.progress.review_streak, 0);

  const slowCorrect = nextProgressForAttempt({ question_key: "q-1", ...missed.progress }, {
    correct: true,
    durationMs: STUDY_FAST_ANSWER_MS + 1,
    now: new Date("2026-01-01T00:01:00.000Z"),
  });
  assert.equal(slowCorrect.progress.slow_count, 1);
  assert.equal(slowCorrect.progress.review_streak, 0);
  assert.equal(slowCorrect.progress.mastered_at, null);

  let row = { question_key: "q-1", ...slowCorrect.progress };
  for (let i = 0; i < 4; i++) {
    const next = nextProgressForAttempt(row, {
      correct: true,
      durationMs: 2500,
      now: new Date(`2026-01-01T00:0${i + 2}:00.000Z`),
    });
    row = { question_key: "q-1", ...next.progress };
  }
  assert.equal(row.review_streak, 4);
  assert.ok(row.mastered_at);
});

test("interrupted answers are due later without miss or slow penalties", () => {
  const interrupted = nextProgressForAttempt(null, {
    correct: false,
    durationMs: STUDY_INTERRUPTED_ANSWER_MS + 1000,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.equal(interrupted.attempt.isInterrupted, true);
  assert.equal(interrupted.attempt.isSlow, false);
  assert.equal(interrupted.progress.miss_count, 0);
  assert.equal(interrupted.progress.slow_count, 0);
  assert.equal(interrupted.progress.interrupted_count, 1);
  assert.equal(interrupted.progress.correct_count, 0);
  assert.equal(interrupted.progress.review_streak, 0);
  assert.ok(interrupted.progress.next_due_at);

  const selected = scheduleStudySession({
    questionKeys: keys,
    progressRows: [{ question_key: "q-04", ...interrupted.progress }],
    now: new Date("2026-01-01T00:01:00.000Z"),
    rng: () => 0,
  });
  assert.equal(selected[0], "q-04");
});
