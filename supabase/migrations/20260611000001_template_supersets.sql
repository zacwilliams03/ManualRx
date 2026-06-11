-- ── Ensure template_exercises has created_at ────────────────────────────────
ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ── New table: template_exercise_groups ──────────────────────────────────────
CREATE TABLE template_exercise_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT '',
  set_count   int  NOT NULL,
  order_index int  NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── Alter template_exercises ─────────────────────────────────────────────────
ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS group_id          uuid REFERENCES template_exercise_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position_in_group int,
  ADD COLUMN IF NOT EXISTS order_index       int;

-- ── Backfill order_index for existing rows ───────────────────────────────────
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY created_at ASC, id ASC) AS rn
  FROM template_exercises
)
UPDATE template_exercises te
SET order_index = r.rn
FROM ranked r
WHERE te.id = r.id
  AND te.order_index IS NULL;

-- ── RLS: template_exercise_groups ────────────────────────────────────────────
ALTER TABLE template_exercise_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_groups_therapist_all" ON template_exercise_groups
  FOR ALL TO authenticated
  USING (
    template_id IN (
      SELECT id FROM templates WHERE therapist_id = auth.uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM templates WHERE therapist_id = auth.uid()
    )
  );
