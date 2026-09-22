/*
# Create weekly_resources table for member resource entries

1. New Tables
  - `weekly_resources`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references profiles)
    - `week_start` (date) - Monday of the week this entry belongs to
    - `skill_tickets` (integer)
    - `egg_shells` (integer)
    - `pet_eggs` (integer)
    - `mount_resources` (integer)
    - `mounts` (integer)
    - `clan_elixirs` (integer)
    - `morning_push_days` (integer array) - which days 1-6 the member does morning push
    - `submitted_at` (timestamptz) - when the entry was submitted
    - `created_at` / `updated_at` (timestamptz)

2. Security
  - Enable RLS.
  - Members can read/write only their own resources.
  - Staff+ can read all resources.
  - Unique constraint on (user_id, week_start) - one entry per member per week.

3. Notes
  - Frontend enforces weekly window (Mon 09:00 - Tue 08:59 KST).
  - If a member misses the window, their profile red_warning is set by a function.
*/

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

-- Members see own; staff+ see all
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
