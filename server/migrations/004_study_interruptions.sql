ALTER TABLE study_question_progress ADD COLUMN interrupted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE study_question_progress ADD COLUMN timed_seen_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE study_sessions ADD COLUMN interrupted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN scored_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE study_attempts ADD COLUMN interrupted INTEGER NOT NULL DEFAULT 0 CHECK(interrupted IN (0, 1));

UPDATE study_sessions
SET scored_count = question_count
WHERE ended_at IS NOT NULL AND scored_count = 0;
