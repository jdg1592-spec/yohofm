CREATE TABLE IF NOT EXISTS clan_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clan_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_clan_notes" ON clan_notes;
CREATE POLICY "select_clan_notes"
ON clan_notes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "insert_clan_notes" ON clan_notes;
CREATE POLICY "insert_clan_notes"
ON clan_notes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('leader', 'commander', 'captain', 'staff')
  )
);

DROP POLICY IF EXISTS "update_clan_notes" ON clan_notes;
CREATE POLICY "update_clan_notes"
ON clan_notes FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('leader', 'commander', 'captain', 'staff')
  )
);

DROP POLICY IF EXISTS "delete_clan_notes" ON clan_notes;
CREATE POLICY "delete_clan_notes"
ON clan_notes FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('leader', 'commander', 'captain', 'staff')
  )
);