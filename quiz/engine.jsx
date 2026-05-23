// QuizEngine — pure state logic for both Practice and Quiz modes.
// Practice mode: get each question right ONCE → mastered. Wrong → bumped down 5-10.
// Quiz mode:     get each question right TWICE → mastered. Wrong → bumped down 5-10 AND streak resets.
//                After 1st correct, question goes back into the queue ~5-10 later for confirmation.

const QuizEngine = {
  create({ poolIds, size = 50, mode = 'practice' }) {
    const ids = shuffle([...poolIds]).slice(0, Math.min(size, poolIds.length));
    return {
      mode,                       // 'practice' | 'quiz'
      quizIds: ids,
      // Practice-mode fields
      queue: [...ids],
      activeId: null,
      optionOrder: [],
      selected: new Set(),
      answered: false,
      correctStreak: Object.fromEntries(ids.map(id => [id, 0])),
      mastered: new Set(),
      firstTryMastered: new Set(),
      attemptsById: Object.fromEntries(ids.map(id => [id, 0])),
      totalAttempts: 0,
      correctAttempts: 0,
      wrongAttempts: 0,
      history: [],
      // Quiz-mode fields (linear test)
      cursor: 0,
      answers: {},        // qid -> [optionIndex]
      optionOrders: {},   // qid -> [optionIndex, ...] (stable shuffled)
      // Lifecycle
      startedAt: Date.now(),
      endedAt: null,
    };
  },

  // Pop next question from the queue (with re-shuffle of unmastered remnants if empty).
  advance(s) {
    if (s.mastered.size >= s.quizIds.length) return { ...s, activeId: null };
    if (s.queue.length === 0) {
      const remaining = s.quizIds.filter(id => !s.mastered.has(id) && id !== s.activeId);
      s = { ...s, queue: shuffle(remaining) };
      if (s.queue.length === 0 && s.activeId != null && !s.mastered.has(s.activeId)) {
        s = { ...s, queue: [s.activeId] };
      }
    }
    const queue = [...s.queue];
    const activeId = queue.shift();
    return {
      ...s,
      queue,
      activeId,
      optionOrder: shuffle(window.QUESTIONS[activeId].options.map((_, i) => i)),
      selected: new Set(),
      answered: false,
    };
  },

  toggle(s, optIdx) {
    const q = window.QUESTIONS[s.activeId];
    if (s.answered) return s;
    let selected;
    if (q.multi) {
      selected = new Set(s.selected);
      if (selected.has(optIdx)) {
        selected.delete(optIdx);
      } else if (selected.size < q.answers.length) {
        // Cap selection at the exact number required ("choose N")
        selected.add(optIdx);
      }
    } else {
      selected = new Set([optIdx]);
    }
    return { ...s, selected };
  },

  // Grade the current answer; mutates lookup arrays as needed.
  grade(s) {
    const q = window.QUESTIONS[s.activeId];
    const correctSet = new Set(q.answers);
    const isCorrect = sameSet(s.selected, correctSet);

    const attemptsById = { ...s.attemptsById, [s.activeId]: (s.attemptsById[s.activeId] || 0) + 1 };
    const totalAttempts = s.totalAttempts + 1;
    let correctAttempts = s.correctAttempts;
    let wrongAttempts = s.wrongAttempts;
    let correctStreak = { ...s.correctStreak };
    let mastered = new Set(s.mastered);
    let firstTryMastered = new Set(s.firstTryMastered);
    let queue = [...s.queue];

    const masterAt = s.mode === 'quiz' ? 2 : 1;

    if (isCorrect) {
      correctAttempts++;
      correctStreak[s.activeId] = (correctStreak[s.activeId] || 0) + 1;
      if (correctStreak[s.activeId] >= masterAt) {
        mastered.add(s.activeId);
        if ((attemptsById[s.activeId] || 0) === masterAt) {
          // first-try mastery (only counted if mastered with no wrong attempts at all)
          firstTryMastered.add(s.activeId);
        }
      } else {
        // schedule next confirmation pass (5-10 later)
        const delay = randInt(5, 10);
        queue = insertAt(queue, Math.min(delay, queue.length), s.activeId);
      }
    } else {
      wrongAttempts++;
      correctStreak[s.activeId] = 0;
      // bump 5-10 later
      const delay = randInt(5, 10);
      queue = insertAt(queue, Math.min(delay, queue.length), s.activeId);
    }

    const history = [...s.history, { id: s.activeId, correct: isCorrect, ts: Date.now() }];

    return {
      ...s,
      answered: true,
      attemptsById,
      totalAttempts,
      correctAttempts,
      wrongAttempts,
      correctStreak,
      mastered,
      firstTryMastered,
      queue,
      history,
      endedAt: mastered.size >= s.quizIds.length ? Date.now() : null,
    };
  },

  // After grading, find what position the active id will return at (1-indexed). Used for feedback copy.
  nextReturnIn(s) {
    if (!s.queue.length) return 1;
    const idx = s.queue.indexOf(s.activeId);
    if (idx < 0) return null;
    return idx + 1;
  },

  // Progress fraction (0..1) — counts each mastered + partial streak.
  progress(s) {
    const target = s.quizIds.length * (s.mode === 'quiz' ? 2 : 1);
    if (target === 0) return 0;
    let earned = 0;
    for (const id of s.quizIds) {
      const streak = s.correctStreak[id] || 0;
      const masterAt = s.mode === 'quiz' ? 2 : 1;
      earned += Math.min(streak, masterAt);
    }
    return Math.min(1, earned / target);
  },

  accuracy(s) {
    return s.totalAttempts ? Math.round((s.correctAttempts / s.totalAttempts) * 100) : 100;
  },
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
function insertAt(arr, idx, val) {
  const copy = [...arr];
  copy.splice(idx, 0, val);
  return copy;
}

window.QuizEngine = QuizEngine;
