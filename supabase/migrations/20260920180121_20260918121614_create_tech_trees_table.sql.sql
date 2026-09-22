CREATE TABLE IF NOT EXISTS tech_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  skill_cost_reduction numeric NOT NULL DEFAULT 0 CHECK (skill_cost_reduction >= -25 AND skill_cost_reduction <= 0),
  mount_cost_reduction numeric NOT NULL DEFAULT 0 CHECK (mount_cost_reduction >= -25 AND mount_cost_reduction <= 0),
  extra_mount_chance numeric NOT NULL DEFAULT 0 CHECK (extra_mount_chance >= 0 AND extra_mount_chance <= 50),
  extra_egg_chance numeric NOT NULL DEFAULT 0 CHECK (extra_egg_chance >= 0 AND extra_egg_chance <= 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE tech_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tech_trees" ON tech_trees;
CREATE POLICY "select_tech_trees" ON tech_trees FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('leader', 'commander', 'captain', 'staff')
    )
  );

DROP POLICY IF EXISTS "insert_own_tech_tree" ON tech_trees;
CREATE POLICY "insert_own_tech_tree" ON tech_trees FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tech_tree" ON tech_trees;
CREATE POLICY "update_own_tech_tree" ON tech_trees FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tech_tree" ON tech_trees;
CREATE POLICY "delete_own_tech_tree" ON tech_trees FOR DELETE
  TO authenticated USING (auth.uid() = user_id);