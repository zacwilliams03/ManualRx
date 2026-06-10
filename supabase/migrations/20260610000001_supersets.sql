-- ── Ensure prescription_exercises has created_at (idempotent) ────────────────
-- Supabase adds this automatically for dashboard-created tables, but we guard
-- here so the backfill ORDER BY created_at never fails.
ALTER TABLE prescription_exercises
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ── New table: prescription_exercise_groups ──────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_exercise_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT '',
  set_count       int  NOT NULL,
  order_index     int  NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ── Alter prescription_exercises ─────────────────────────────────────────────
ALTER TABLE prescription_exercises
  ADD COLUMN IF NOT EXISTS group_id          uuid REFERENCES prescription_exercise_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position_in_group int,
  ADD COLUMN IF NOT EXISTS order_index       int;

-- ── Backfill order_index for existing rows (only NULL rows) ──────────────────
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY prescription_id ORDER BY created_at ASC, id ASC) AS rn
  FROM prescription_exercises
)
UPDATE prescription_exercises pe
SET order_index = r.rn
FROM ranked r
WHERE pe.id = r.id
  AND pe.order_index IS NULL;

-- ── RLS: prescription_exercise_groups ────────────────────────────────────────
ALTER TABLE prescription_exercise_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_therapist_all" ON prescription_exercise_groups
  FOR ALL TO authenticated
  USING (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE therapist_id = auth.uid()
    )
  )
  WITH CHECK (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE therapist_id = auth.uid()
    )
  );

-- Shape matches prescription_exercises_client_read exactly.
CREATE POLICY "groups_client_read" ON prescription_exercise_groups
  FOR SELECT TO authenticated
  USING (
    prescription_id IN (
      SELECT p.id FROM prescriptions p
      JOIN clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    )
  );
