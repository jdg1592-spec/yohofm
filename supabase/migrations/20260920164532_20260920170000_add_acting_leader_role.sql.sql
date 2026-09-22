/*
# Add 'acting-leader' (리더 대행) role with full leader privileges

1. Schema changes
  - profiles.role: CHECK constraint updated to include 'acting-leader'.
  - role_requests.requested_role: CHECK constraint updated to include 'acting-leader'.

2. SECURITY DEFINER function updates
  - set_member_role: leader AND acting-leader can assign any role; commander unchanged.
    Valid target roles now include 'acting-leader'.
  - clear_red_warning: leader OR acting-leader can clear.
  - set_red_warning: leader OR acting-leader OR commander can set.
  - review_role_request: leader OR acting-leader OR commander can review.
  - kick_member: leader OR acting-leader can kick (not self).

3. RLS policy updates
  - clan_settings: leader OR acting-leader can update.
  - role_requests: leader OR acting-leader OR commander can insert/review.
  - weekly_resources: leader OR acting-leader can cross-user write.
  - tech_trees: leader OR acting-leader can cross-user write.
  - clan_notes: 'acting-leader' added to staff+ write checks.

4. Notes
  - 'acting-leader' has ROLE_HIERARCHY level 1, identical to 'leader'.
  - All frontend isLeader checks already include acting-leader after this change.
*/

-- ── 1. profiles.role CHECK ──
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('leader', 'acting-leader', 'commander', 'captain', 'staff', 'member'));

-- ── 2. role_requests.requested_role CHECK ──
ALTER TABLE role_requests DROP CONSTRAINT IF EXISTS role_requests_requested_role_check;
ALTER TABLE role_requests ADD CONSTRAINT role_requests_requested_role_check
  CHECK (requested_role IS NULL OR requested_role IN ('leader', 'acting-leader', 'commander', 'captain', 'staff', 'member'));

-- ── 3. SECURITY DEFINER functions ──

CREATE OR REPLACE FUNCTION set_member_role(p_target uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_caller_role IN ('leader', 'acting-leader') THEN
    IF p_role NOT IN ('leader', 'acting-leader', 'commander', 'captain', 'staff', 'member') THEN
      RAISE EXCEPTION 'Invalid role';
    END IF;
  ELSIF v_caller_role = 'commander' THEN
    IF p_role NOT IN ('captain', 'staff', 'member') THEN
      RAISE EXCEPTION 'Commanders can only assign captain, staff, or member roles';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET role = p_role, updated_at = now() WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_member_role FROM anon;
GRANT EXECUTE ON FUNCTION set_member_role TO authenticated;

CREATE OR REPLACE FUNCTION clear_red_warning(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only the Leader can clear red warnings';
  END IF;

  UPDATE profiles
  SET red_warning = false, red_warning_locked_at = NULL, updated_at = now()
  WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION clear_red_warning FROM anon;
GRANT EXECUTE ON FUNCTION clear_red_warning TO authenticated;

CREATE OR REPLACE FUNCTION set_red_warning(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('leader', 'acting-leader', 'commander') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
  SET red_warning = true, red_warning_locked_at = now(), updated_at = now()
  WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_red_warning FROM anon;
GRANT EXECUTE ON FUNCTION set_red_warning TO authenticated;

CREATE OR REPLACE FUNCTION review_role_request(p_request_id uuid, p_approved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_request role_requests%ROWTYPE;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('leader', 'acting-leader', 'commander') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_request FROM role_requests WHERE id = p_request_id AND status = 'pending';

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  IF p_approved THEN
    IF v_request.request_type = 'role_change' AND v_request.requested_role IS NOT NULL THEN
      PERFORM set_member_role(v_request.target_id, v_request.requested_role);
    END IF;
    UPDATE role_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_request_id;
  ELSE
    UPDATE role_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_request_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION review_role_request FROM anon;
GRANT EXECUTE ON FUNCTION review_role_request TO authenticated;

CREATE OR REPLACE FUNCTION kick_member(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();

  IF v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only the Leader can kick members';
  END IF;

  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'Cannot kick yourself';
  END IF;

  DELETE FROM profiles WHERE id = p_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION kick_member FROM anon;
GRANT EXECUTE ON FUNCTION kick_member TO authenticated;

-- ── 4. RLS policy updates (drop + recreate) ──

-- clan_settings: leader OR acting-leader can update
DROP POLICY IF EXISTS "update_clan_settings" ON clan_settings;
CREATE POLICY "update_clan_settings"
ON clan_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader', 'commander'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader', 'commander'))
);

-- role_requests: leader OR acting-leader OR commander
DROP POLICY IF EXISTS "insert_role_requests" ON role_requests;
CREATE POLICY "insert_role_requests"
ON role_requests FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader', 'commander', 'captain'))
);

DROP POLICY IF EXISTS "update_role_requests" ON role_requests;
CREATE POLICY "update_role_requests"
ON role_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader', 'commander'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader', 'commander'))
);

-- weekly_resources: leader OR acting-leader cross-user write
DROP POLICY IF EXISTS "leader_update_weekly_resources" ON weekly_resources;
CREATE POLICY "leader_update_weekly_resources"
ON weekly_resources FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader'))
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader'))
);

DROP POLICY IF EXISTS "leader_insert_weekly_resources" ON weekly_resources;
CREATE POLICY "leader_insert_weekly_resources"
ON weekly_resources FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader'))
);

-- tech_trees: leader OR acting-leader cross-user write
DROP POLICY IF EXISTS "leader_update_tech_trees" ON tech_trees;
CREATE POLICY "leader_update_tech_trees"
ON tech_trees FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader'))
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader'))
);

DROP POLICY IF EXISTS "leader_insert_tech_trees" ON tech_trees;
CREATE POLICY "leader_insert_tech_trees"
ON tech_trees FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('leader', 'acting-leader'))
);

-- clan_notes: add 'acting-leader' to staff+ write checks
DROP POLICY IF EXISTS "insert_clan_notes" ON clan_notes;
CREATE POLICY "insert_clan_notes"
ON clan_notes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('leader', 'acting-leader', 'commander', 'captain', 'staff')
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
    AND profiles.role IN ('leader', 'acting-leader', 'commander', 'captain', 'staff')
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
    AND profiles.role IN ('leader', 'acting-leader', 'commander', 'captain', 'staff')
  )
);