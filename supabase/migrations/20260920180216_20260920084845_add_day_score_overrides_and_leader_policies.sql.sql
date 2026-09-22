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