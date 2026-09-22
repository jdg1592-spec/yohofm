CREATE TABLE IF NOT EXISTS weekly_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  skill_tickets integer NOT NULL DEFAULT 0 CHECK (skill_tickets >= 0),
  egg_shells integer NOT NULL DEFAULT 0 CHECK (egg_shells >= 0),
  pet_eggs integer NOT NULL DEFAULT 0 CHECK (pet_eggs >= 0),
  mount_resources integer NOT NULL DEFAULT 0 CHECK (mount_resources >= 0),
  mounts integer NOT NULL DEFAULT 0 CHECK (mounts >= 0),
  clan_elixirs integer NOT NULL DEFAULT 0 CHECK (clan_elixirs >= 0),
  morning_push_days integer[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_resources_week ON weekly_resources(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_resources_user ON weekly_resources(user_id);

ALTER TABLE weekly_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_weekly_resources" ON weekly_resources;
CREATE POLICY "select_weekly_resources" ON weekly_resources FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander', 'captain', 'staff')
    )
  );

DROP POLICY IF EXISTS "insert_own_weekly_resources" ON weekly_resources;
CREATE POLICY "insert_own_weekly_resources" ON weekly_resources FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_weekly_resources" ON weekly_resources;
CREATE POLICY "update_own_weekly_resources" ON weekly_resources FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_weekly_resources" ON weekly_resources;
CREATE POLICY "delete_own_weekly_resources" ON weekly_resources FOR DELETE
  TO authenticated USING (auth.uid() = user_id);