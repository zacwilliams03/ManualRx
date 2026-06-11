-- ── Add rest_seconds column to exercise and group tables ──────────────────────

ALTER TABLE prescription_exercises
  ADD COLUMN IF NOT EXISTS rest_seconds INT;

ALTER TABLE prescription_exercise_groups
  ADD COLUMN IF NOT EXISTS rest_seconds INT;

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS rest_seconds INT;

ALTER TABLE template_exercise_groups
  ADD COLUMN IF NOT EXISTS rest_seconds INT;
