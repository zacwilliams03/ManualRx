-- ================================================================
-- PrescriptR Row Level Security Policies
-- Apply via Supabase SQL Editor or CLI: supabase db push
--
-- Key model notes:
--   session_logs.client_id    = auth.uid()  (not clients.id)
--   exercise_logs.client_id   = clients.id  (FK to clients table)
--   check_in_instances.client_id = clients.id
--   messages.client_id        = clients.id
-- ================================================================

-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Therapist names/profiles readable by clients who belong to them
CREATE POLICY "users_client_reads_therapist" ON users
  FOR SELECT USING (
    id IN (SELECT therapist_id FROM clients WHERE user_id = auth.uid())
  );

-- Join page: allow anon to read therapist names for invite validation
CREATE POLICY "users_anon_reads_therapist" ON users
  FOR SELECT TO anon USING (role = 'therapist');

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ----------------------------------------------------------------
-- therapist_profiles
-- ----------------------------------------------------------------
ALTER TABLE therapist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_profiles_own_all" ON therapist_profiles
  FOR ALL USING (user_id = auth.uid());

-- Clients read their therapist's branding (clinic name, logo)
CREATE POLICY "therapist_profiles_client_reads" ON therapist_profiles
  FOR SELECT USING (
    user_id IN (SELECT therapist_id FROM clients WHERE user_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_therapist_all" ON clients
  FOR ALL USING (therapist_id = auth.uid());

-- Client reads their own record (needed for clientId lookups)
CREATE POLICY "clients_own_read" ON clients
  FOR SELECT USING (user_id = auth.uid());

-- ----------------------------------------------------------------
-- client_invites
-- ----------------------------------------------------------------
ALTER TABLE client_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_invites_therapist_all" ON client_invites
  FOR ALL USING (therapist_id = auth.uid());

-- Join page: unauthenticated invite validation
CREATE POLICY "client_invites_anon_read" ON client_invites
  FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------
-- prescriptions (sessions)
-- ----------------------------------------------------------------
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_therapist_all" ON prescriptions
  FOR ALL USING (therapist_id = auth.uid());

CREATE POLICY "prescriptions_client_read" ON prescriptions
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- prescription_exercises
-- ----------------------------------------------------------------
ALTER TABLE prescription_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescription_exercises_therapist_all" ON prescription_exercises
  FOR ALL USING (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE therapist_id = auth.uid()
    )
  );

CREATE POLICY "prescription_exercises_client_read" ON prescription_exercises
  FOR SELECT USING (
    prescription_id IN (
      SELECT p.id FROM prescriptions p
      JOIN clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- prescription_exercise_sets
-- ----------------------------------------------------------------
ALTER TABLE prescription_exercise_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescription_exercise_sets_therapist_all" ON prescription_exercise_sets
  FOR ALL USING (
    prescription_exercise_id IN (
      SELECT pe.id FROM prescription_exercises pe
      JOIN prescriptions p ON p.id = pe.prescription_id
      WHERE p.therapist_id = auth.uid()
    )
  );

CREATE POLICY "prescription_exercise_sets_client_read" ON prescription_exercise_sets
  FOR SELECT USING (
    prescription_exercise_id IN (
      SELECT pe.id FROM prescription_exercises pe
      JOIN prescriptions p ON p.id = pe.prescription_id
      JOIN clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- exercises
-- ----------------------------------------------------------------
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Shared library readable by all authenticated users
CREATE POLICY "exercises_shared_read" ON exercises
  FOR SELECT USING (is_custom = false);

-- Own custom exercises: full access
CREATE POLICY "exercises_own_read" ON exercises
  FOR SELECT USING (is_custom = true AND created_by = auth.uid());

CREATE POLICY "exercises_own_insert" ON exercises
  FOR INSERT WITH CHECK (is_custom = true AND created_by = auth.uid());

CREATE POLICY "exercises_own_update" ON exercises
  FOR UPDATE USING (is_custom = true AND created_by = auth.uid());

CREATE POLICY "exercises_own_delete" ON exercises
  FOR DELETE USING (is_custom = true AND created_by = auth.uid());

-- ----------------------------------------------------------------
-- templates
-- ----------------------------------------------------------------
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_own_all" ON templates
  FOR ALL USING (therapist_id = auth.uid());

-- ----------------------------------------------------------------
-- template_exercises
-- ----------------------------------------------------------------
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_exercises_own_all" ON template_exercises
  FOR ALL USING (
    template_id IN (SELECT id FROM templates WHERE therapist_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- programs
-- ----------------------------------------------------------------
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programs_therapist_all" ON programs
  FOR ALL USING (therapist_id = auth.uid());

CREATE POLICY "programs_client_read" ON programs
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- program_templates
-- ----------------------------------------------------------------
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_templates_own_all" ON program_templates
  FOR ALL USING (therapist_id = auth.uid());

-- ----------------------------------------------------------------
-- program_template_sessions
-- ----------------------------------------------------------------
ALTER TABLE program_template_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_template_sessions_own_all" ON program_template_sessions
  FOR ALL USING (
    program_template_id IN (
      SELECT id FROM program_templates WHERE therapist_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- session_logs  (note: client_id = auth.uid() in this table)
-- ----------------------------------------------------------------
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_logs_client_own" ON session_logs
  FOR ALL USING (client_id = auth.uid());

CREATE POLICY "session_logs_therapist_read" ON session_logs
  FOR SELECT USING (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE therapist_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- exercise_logs  (client_id = clients.id FK)
-- ----------------------------------------------------------------
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_logs_client_own" ON exercise_logs
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

CREATE POLICY "exercise_logs_therapist_read" ON exercise_logs
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE therapist_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- check_in_forms
-- ----------------------------------------------------------------
ALTER TABLE check_in_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_in_forms_therapist_all" ON check_in_forms
  FOR ALL USING (therapist_id = auth.uid());

-- Clients can read forms they have instances for
CREATE POLICY "check_in_forms_client_read" ON check_in_forms
  FOR SELECT USING (
    id IN (
      SELECT form_id FROM check_in_instances
      WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------
-- check_in_questions
-- ----------------------------------------------------------------
ALTER TABLE check_in_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_in_questions_therapist_all" ON check_in_questions
  FOR ALL USING (
    form_id IN (SELECT id FROM check_in_forms WHERE therapist_id = auth.uid())
  );

CREATE POLICY "check_in_questions_client_read" ON check_in_questions
  FOR SELECT USING (
    form_id IN (
      SELECT form_id FROM check_in_instances
      WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------
-- check_in_instances  (client_id = clients.id FK)
-- ----------------------------------------------------------------
ALTER TABLE check_in_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_in_instances_therapist_all" ON check_in_instances
  FOR ALL USING (
    form_id IN (SELECT id FROM check_in_forms WHERE therapist_id = auth.uid())
  );

CREATE POLICY "check_in_instances_client_own" ON check_in_instances
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- check_in_responses
-- ----------------------------------------------------------------
ALTER TABLE check_in_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_in_responses_client_own" ON check_in_responses
  FOR ALL USING (
    instance_id IN (
      SELECT ci.id FROM check_in_instances ci
      WHERE ci.client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "check_in_responses_therapist_read" ON check_in_responses
  FOR SELECT USING (
    instance_id IN (
      SELECT ci.id FROM check_in_instances ci
      JOIN check_in_forms cf ON cf.id = ci.form_id
      WHERE cf.therapist_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- messages  (client_id = clients.id FK)
-- ----------------------------------------------------------------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_therapist_own" ON messages
  FOR ALL USING (therapist_id = auth.uid());

CREATE POLICY "messages_client_own" ON messages
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );
