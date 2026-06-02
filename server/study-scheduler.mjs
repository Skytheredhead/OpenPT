export const STUDY_SESSION_SIZE = 20;
export const STUDY_REVIEW_LIMIT = 8;
export const STUDY_MASTERY_TARGET = 4;
export const STUDY_FAST_ANSWER_MS = 15_000;
export const STUDY_INTERRUPTED_ANSWER_MS = 120_000;

export function sanitizeQuestionKeys(keys = []) {
  const seen = new Set();
  const clean = [];
  for (const key of keys) {
    const value = String(key || "").trim().slice(0, 220);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    clean.push(value);
  }
  return clean;
}

export function scheduleStudySession({ questionKeys = [], progressRows = [], now = new Date(), rng = Math.random } = {}) {
  const pool = sanitizeQuestionKeys(questionKeys);
  const poolSet = new Set(pool);
  const progress = new Map(progressRows.filter((row) => poolSet.has(row.question_key)).map((row) => [row.question_key, normalizeProgressRow(row)]));
  const selected = [];
  const selectedSet = new Set();
  const nowMs = new Date(now).getTime();

  const dueReviews = [...progress.values()]
    .filter((row) => isWeak(row) && !row.mastered_at && row.next_due_at && new Date(row.next_due_at).getTime() <= nowMs)
    .sort(compareReviewRows)
    .slice(0, STUDY_REVIEW_LIMIT);
  addKeys(selected, selectedSet, dueReviews.map((row) => row.question_key));

  const unseen = shuffle(pool.filter((key) => !progress.has(key)), rng);
  addKeys(selected, selectedSet, unseen);

  if (selected.length < Math.min(STUDY_SESSION_SIZE, pool.length)) {
    const weakSeen = [...progress.values()]
      .filter((row) => !selectedSet.has(row.question_key))
      .sort(compareFallbackRows)
      .map((row) => row.question_key);
    addKeys(selected, selectedSet, weakSeen);
  }

  return selected.slice(0, Math.min(STUDY_SESSION_SIZE, pool.length));
}

export function nextProgressForAttempt(row, { correct, durationMs = null, now = new Date() } = {}) {
  const current = normalizeProgressRow(row || {});
  const timestamp = new Date(now).toISOString();
  const wasNew = !row;
  const wasReview = isWeak(current) && !current.mastered_at;
  const answerMs = Number.isFinite(Number(durationMs)) ? Math.max(0, Math.round(Number(durationMs))) : null;
  const isInterrupted = answerMs != null && answerMs > STUDY_INTERRUPTED_ANSWER_MS;
  const isSlow = answerMs != null && answerMs > STUDY_FAST_ANSWER_MS && !isInterrupted;
  let reviewStreak = current.review_streak;
  let masteredAt = current.mastered_at || null;
  let nextDueAt = current.next_due_at || null;
  let missCount = current.miss_count;
  let slowCount = current.slow_count;
  let interruptedCount = current.interrupted_count;
  const seenCount = current.seen_count + 1;
  const timedSeenCount = current.timed_seen_count + (answerMs != null && !isInterrupted ? 1 : 0);
  const avgAnswerMs = answerMs == null || isInterrupted
    ? current.avg_answer_ms
    : Math.round(((current.avg_answer_ms * current.timed_seen_count) + answerMs) / Math.max(1, timedSeenCount));

  if (isInterrupted) {
    interruptedCount += 1;
    reviewStreak = 0;
    masteredAt = null;
    nextDueAt = timestamp;
  } else if (correct && !isSlow) {
    if (isWeak(current)) {
      reviewStreak += 1;
      if (reviewStreak >= STUDY_MASTERY_TARGET) {
        masteredAt = timestamp;
        nextDueAt = null;
      } else {
        nextDueAt = timestamp;
      }
    }
  } else if (correct && isSlow) {
    slowCount += 1;
    reviewStreak = 0;
    masteredAt = null;
    nextDueAt = timestamp;
  } else {
    missCount += 1;
    reviewStreak = 0;
    masteredAt = null;
    nextDueAt = timestamp;
  }

  return {
    progress: {
      seen_count: seenCount,
      correct_count: current.correct_count + (correct && !isInterrupted ? 1 : 0),
      miss_count: missCount,
      slow_count: slowCount,
      interrupted_count: interruptedCount,
      review_streak: reviewStreak,
      mastered_at: masteredAt,
      next_due_at: nextDueAt,
      avg_answer_ms: avgAnswerMs,
      last_answer_ms: answerMs,
      timed_seen_count: timedSeenCount,
      last_seen_at: timestamp
    },
    attempt: {
      isNew: wasNew,
      wasReview,
      isSlow,
      isInterrupted,
      durationMs: answerMs,
      reviewStreakAfter: reviewStreak,
      masteredAfter: !!masteredAt
    }
  };
}

function normalizeProgressRow(row) {
  return {
    question_key: row.question_key || row.questionKey || "",
    seen_count: Number(row.seen_count || row.seenCount || 0),
    correct_count: Number(row.correct_count || row.correctCount || 0),
    miss_count: Number(row.miss_count || row.missCount || 0),
    slow_count: Number(row.slow_count || row.slowCount || 0),
    interrupted_count: Number(row.interrupted_count || row.interruptedCount || 0),
    review_streak: Number(row.review_streak || row.reviewStreak || 0),
    mastered_at: row.mastered_at || row.masteredAt || null,
    next_due_at: row.next_due_at || row.nextDueAt || null,
    avg_answer_ms: Number(row.avg_answer_ms || row.avgAnswerMs || 0),
    last_answer_ms: row.last_answer_ms == null ? null : Number(row.last_answer_ms),
    timed_seen_count: Number(row.timed_seen_count || row.timedSeenCount || row.seen_count || row.seenCount || 0),
    last_seen_at: row.last_seen_at || row.lastSeenAt || null
  };
}

function compareReviewRows(a, b) {
  return (
    b.miss_count - a.miss_count ||
    b.slow_count - a.slow_count ||
    b.interrupted_count - a.interrupted_count ||
    a.review_streak - b.review_streak ||
    timeValue(a.next_due_at) - timeValue(b.next_due_at) ||
    timeValue(a.last_seen_at) - timeValue(b.last_seen_at) ||
    a.question_key.localeCompare(b.question_key)
  );
}

function compareFallbackRows(a, b) {
  const aActive = isWeak(a) && !a.mastered_at ? 1 : 0;
  const bActive = isWeak(b) && !b.mastered_at ? 1 : 0;
  return (
    bActive - aActive ||
    b.miss_count - a.miss_count ||
    b.slow_count - a.slow_count ||
    b.interrupted_count - a.interrupted_count ||
    a.review_streak - b.review_streak ||
    timeValue(a.last_seen_at) - timeValue(b.last_seen_at) ||
    a.seen_count - b.seen_count ||
    a.question_key.localeCompare(b.question_key)
  );
}

function isWeak(row) {
  return row.miss_count > 0 || row.slow_count > 0 || row.interrupted_count > 0;
}

function timeValue(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function addKeys(selected, selectedSet, keys) {
  for (const key of keys) {
    if (selected.length >= STUDY_SESSION_SIZE) return;
    if (selectedSet.has(key)) continue;
    selectedSet.add(key);
    selected.push(key);
  }
}

function shuffle(values, rng) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
