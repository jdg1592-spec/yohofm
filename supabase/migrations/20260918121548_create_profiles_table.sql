/*
# Create profiles table for clan members

1. New Tables
  - `profiles`
    - `id` (uuid, primary key, references auth.users)
    - `nickname` (text, unique, not null) - in-game display name
    - `role` (text, not null, default 'member') - one of: leader, commander, captain, staff, member
    - `red_warning` (boolean, default false) - weekly dashboard missed flag
    - `red_warning_locked_at` (timestamptz) - when the warning was set
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

2. Security
  - Enable RLS on `profiles`.
  - Authenticated users can read all profiles (clan members need to see each other).
  - Users can insert their own profile on signup.
  - Users can update only their own display info (nickname). Role and red_warning are privileged.
  - Column-level grants restrict role/red_warning from direct user writes.

3. Notes
  - Role column is NOT user-writable; changes go through SECURITY DEFINER functions.
  - red_warning column is NOT user-writable; managed by system/leader only.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'commander', 'captain', 'staff', 'member')),
  red_warning boolean NOT NULL DEFAULT false,
  red_warning_locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated members can see all profiles (clan roster)
DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

-- Users can insert their own profile on signup
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Users can update their own profile row (column grants restrict what columns)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- No delete policy - profiles should not be deleted by users
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (false);

-- Restrict column-level writes: users can only update nickname and updated_at
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (nickname, updated_at) ON profiles TO authenticated;

-- Restrict INSERT columns: users can set id, nickname only; role defaults to 'member'
REVOKE INSERT ON profiles FROM authenticated;
GRANT INSERT (id, nickname) ON profiles TO authenticated;
