/*
# Add day_score_overrides column and leader edit policies

1. Modified Tables
  - `weekly_resources`
    - Added `day_score_overrides` (jsonb, default '{}') — stores per-day score overrides set by the leader, keyed by day number as string (e.g. {"1": 500, "2": 520})

2. Security
  - New UPDATE policy: leader can update any member's weekly_resources row
  - New INSERT policy: leader can insert weekly_resources for any member (needed when member has no row yet)

3. Notes
  - The leader role (role = 'leader') is the only role granted cross-user write access.
  - Existing owner-scoped INSERT/UPDATE policies remain unchanged.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_resources' AND column_name = 'day_score_overrides'
  ) THEN
    ALTER TABLE weekly_resources ADD COLUMN day_score_overrides jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;

DROP POLICY IF EXISTS "leader_update_weekly_resources" ON weekly_resources;
CREATE POLICY "leader_update_weekly_resources" ON weekly_resources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'leader')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'leader')
  );

DROP POLICY IF EXISTS "leader_insert_weekly_resources" ON weekly_resources;
CREATE POLICY "leader_insert_weekly_resources" ON weekly_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'leader')
  );
