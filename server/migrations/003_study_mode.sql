CREATE TABLE IF NOT EXISTS study_question_progress (
  user_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  slow_count INTEGER NOT NULL DEFAULT 0,
  review_streak INTEGER NOT NULL DEFAULT 0,
  mastered_at TEXT,
  next_due_at TEXT,
  avg_answer_ms INTEGER NOT NULL DEFAULT 0,
  last_answer_ms INTEGER,
  last_seen_at TEXT,
  PRIMARY KEY(user_id, bank_id, question_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_progress_due
  ON study_question_progress(user_id, bank_id, mastered_at, next_due_at, miss_count, review_streak);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  question_keys_json TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  slow_count INTEGER NOT NULL DEFAULT 0,
  mastered_count INTEGER NOT NULL DEFAULT 0,
  avg_answer_ms INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_bank_time
  ON study_sessions(user_id, bank_id, started_at);

CREATE TABLE IF NOT EXISTS study_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  selected_answers_json TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK(correct IN (0, 1)),
  answer_duration_ms INTEGER,
  slow INTEGER NOT NULL DEFAULT 0 CHECK(slow IN (0, 1)),
  is_new INTEGER NOT NULL CHECK(is_new IN (0, 1)),
  was_review INTEGER NOT NULL CHECK(was_review IN (0, 1)),
  review_streak_after INTEGER NOT NULL DEFAULT 0,
  mastered_after INTEGER NOT NULL CHECK(mastered_after IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(session_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_study_attempts_session ON study_attempts(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_study_attempts_user_bank_question ON study_attempts(user_id, bank_id, question_key);
