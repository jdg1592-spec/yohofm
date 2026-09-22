/*
# Create clan_settings table and role_requests table

1. New Tables
  - `clan_settings` (singleton row for clan-wide config)
    - `id` (integer, primary key, always 1)
    - `clan_name` (text, default 'FeverTime[YOHO]')
    - `clan_tech_nodes` (jsonb) - clan-wide tech node values
    - `updated_at` (timestamptz)
    - `updated_by` (uuid, references profiles)

  - `role_requests` (role change / kick requests from captains)
    - `id` (uuid, primary key)
    - `requester_id` (uuid, references profiles)
    - `target_id` (uuid, references profiles)
    - `request_type` (text) - 'role_change' or 'kick'
    - `requested_role` (text, nullable) - for role_change requests
    - `reason` (text)
    - `status` (text) - 'pending', 'approved', 'rejected'
    - `reviewed_by` (uuid, nullable)
    - `reviewed_at` (timestamptz, nullable)
    - `created_at` (timestamptz)

2. Security
  - clan_settings: all authenticated can read; only leader/commander can update via function.
  - role_requests: requester can read own; leader/commander can read all + update status.
*/

-- Clan settings singleton
CREATE TABLE IF NOT EXISTS clan_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  clan_name text NOT NULL DEFAULT 'FeverTime[YOHO]',
  clan_tech_nodes jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE clan_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_clan_settings" ON clan_settings;
CREATE POLICY "select_clan_settings" ON clan_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_clan_settings" ON clan_settings;
CREATE POLICY "insert_clan_settings" ON clan_settings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander')
    )
  );

DROP POLICY IF EXISTS "update_clan_settings" ON clan_settings;
CREATE POLICY "update_clan_settings" ON clan_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander')
    )
  );

DROP POLICY IF EXISTS "delete_clan_settings" ON clan_settings;
CREATE POLICY "delete_clan_settings" ON clan_settings FOR DELETE
  TO authenticated USING (false);

-- Insert default row
INSERT INTO clan_settings (id, clan_name) VALUES (1, 'FeverTime[YOHO]') ON CONFLICT (id) DO NOTHING;

-- Role requests
CREATE TABLE IF NOT EXISTS role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('role_change', 'kick')),
  requested_role text CHECK (requested_role IS NULL OR requested_role IN ('leader', 'commander', 'captain', 'staff', 'member')),
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_requests_status ON role_requests(status);

ALTER TABLE role_requests ENABLE ROW LEVEL SECURITY;

-- Requester can see own requests; leader/commander see all
DROP POLICY IF EXISTS "select_role_requests" ON role_requests;
CREATE POLICY "select_role_requests" ON role_requests FOR SELECT
  TO authenticated USING (
    auth.uid() = requester_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander')
    )
  );

DROP POLICY IF EXISTS "insert_role_requests" ON role_requests;
CREATE POLICY "insert_role_requests" ON role_requests FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = requester_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander', 'captain')
    )
  );

DROP POLICY IF EXISTS "update_role_requests" ON role_requests;
CREATE POLICY "update_role_requests" ON role_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander')
    )
  );

DROP POLICY IF EXISTS "delete_role_requests" ON role_requests;
CREATE POLICY "delete_role_requests" ON role_requests FOR DELETE
  TO authenticated USING (false);
