CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL DEFAULT 'ccna',
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')),
  completed_steps_json TEXT NOT NULL DEFAULT '[]',
  current_step_id TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  best_percent INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id, lesson_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL DEFAULT 'ccna',
  lesson_id TEXT NOT NULL,
  step_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  earned_xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_events_user_lesson
  ON lesson_events(user_id, course_id, lesson_id, created_at);

CREATE TABLE IF NOT EXISTS lesson_daily_activity (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL DEFAULT 'ccna',
  activity_date TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id, activity_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
