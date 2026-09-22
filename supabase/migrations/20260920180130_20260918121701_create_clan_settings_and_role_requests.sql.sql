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

INSERT INTO clan_settings (id, clan_name) VALUES (1, 'FeverTime[YOHO]') ON CONFLICT (id) DO NOTHING;

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