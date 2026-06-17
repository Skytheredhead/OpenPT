CREATE TABLE IF NOT EXISTS lesson_workspaces (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  snapshot_bytes INTEGER NOT NULL DEFAULT 0,
  app_version TEXT,
  saved_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_workspaces_updated
  ON lesson_workspaces(user_id, course_id, updated_at DESC);
