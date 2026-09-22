/*
# Create clan_notes table for 민원 센터 (Complaints/Notes Center)

1. New Tables
  - `clan_notes`
    - `id` (uuid, primary key)
    - `author_id` (uuid, not null, defaults to auth.uid(), references profiles)
    - `content` (text, not null — free-form memo like "닉네임 / 망치 40,000개 사용")
    - `created_at` (timestamptz, not null, defaults now())
2. Security
  - RLS enabled on clan_notes.
  - SELECT: all authenticated clan members can read (minLevel 5 = everyone).
  - INSERT: staff+ only (role IN leader/commander/captain/staff), owner-scoped via auth.uid() default.
  - UPDATE: author can edit their own notes (staff+).
  - DELETE: author can delete their own notes (staff+).
3. Notes
  - created_at is stored as timestamptz (UTC). The frontend converts to KST for date grouping.
  - All clan members (including regular members) can view notes; only staff+ can create/edit/delete.
*/

CREATE TABLE IF NOT EXISTS clan_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clan_notes ENABLE ROW LEVEL SECURITY;

-- All authenticated clan members can read all notes
DROP POLICY IF EXISTS "select_clan_notes" ON clan_notes;
CREATE POLICY "select_clan_notes"
ON clan_notes FOR SELECT
TO authenticated
USING (true);

-- Only staff+ can insert notes (author_id defaults to auth.uid())
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

-- Only the original author can update their own notes
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

-- Only the original author can delete their own notes
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