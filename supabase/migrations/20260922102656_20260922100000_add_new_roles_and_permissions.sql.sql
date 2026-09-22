/*
# Add military-officer and civil-affairs roles + update permissions

## Changes
1. Role constraint on profiles: add 'military-officer' and 'civil-affairs' to allowed values
2. set_member_role: rewritten to support new role hierarchy and permission rules
   - Leader/acting-leader: can assign any role to anyone (including self)
   - Commander: can only assign captain, military-officer, civil-affairs, staff, member to lower-ranked members
   - Captain: same as commander minus kick (no role change authority above staff)
   - Others: cannot change roles
3. kick_member: now allows commander+ (leader, acting-leader, commander)
4. update_nickname: unchanged (leader/acting-leader only)
5. clan_notes INSERT/UPDATE/DELETE policies: add military-officer, civil-affairs to allowed roles
6. approve_member/reject_member: restrict to leader/acting-leader only (no change needed, already restricted)

## New roles
- 'military-officer' (군장 담당) - rank 4, can edit clan resources + export
- 'civil-affairs' (민원 담당) - rank 4, can write notes

## Role hierarchy (rank number, lower = higher authority)
- leader: 1
- acting-leader: 1.5
- commander: 2
- captain: 3
- military-officer: 4
- civil-affairs: 4
- staff: 5
- member: 6
*/

-- 1. Update role constraint on profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['leader', 'acting-leader', 'commander', 'captain', 'military-officer', 'civil-affairs', 'staff', 'member']));

-- 2. Rewrite set_member_role with new hierarchy
CREATE OR REPLACE FUNCTION public.set_member_role(p_target uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
  v_caller_rank int;
  v_target_rank int;
  v_new_rank int;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate target role is valid
  IF p_role NOT IN ('leader', 'acting-leader', 'commander', 'captain', 'military-officer', 'civil-affairs', 'staff', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Only leader and acting-leader can change their OWN role
  IF p_target = auth.uid() AND v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only the Leader can change their own role';
  END IF;

  -- Define rank mapping (lower = higher authority)
  v_caller_rank := CASE v_caller_role
    WHEN 'leader' THEN 1
    WHEN 'acting-leader' THEN 2
    WHEN 'commander' THEN 3
    WHEN 'captain' THEN 4
    WHEN 'military-officer' THEN 5
    WHEN 'civil-affairs' THEN 5
    WHEN 'staff' THEN 6
    ELSE 7
  END;

  v_target_rank := CASE
    WHEN (SELECT role FROM profiles WHERE id = p_target) IN ('leader') THEN 1
    WHEN (SELECT role FROM profiles WHERE id = p_target) IN ('acting-leader') THEN 2
    WHEN (SELECT role FROM profiles WHERE id = p_target) IN ('commander') THEN 3
    WHEN (SELECT role FROM profiles WHERE id = p_target) IN ('captain') THEN 4
    WHEN (SELECT role FROM profiles WHERE id = p_target) IN ('military-officer', 'civil-affairs') THEN 5
    WHEN (SELECT role FROM profiles WHERE id = p_target) IN ('staff') THEN 6
    ELSE 7
  END;

  v_new_rank := CASE p_role
    WHEN 'leader' THEN 1
    WHEN 'acting-leader' THEN 2
    WHEN 'commander' THEN 3
    WHEN 'captain' THEN 4
    WHEN 'military-officer' THEN 5
    WHEN 'civil-affairs' THEN 5
    WHEN 'staff' THEN 6
    ELSE 7
  END;

  -- Leader/acting-leader: can assign any role to anyone
  IF v_caller_role IN ('leader', 'acting-leader') THEN
    NULL; -- full access
  -- Commander: can only assign to lower-ranked members, and only roles below commander
  ELSIF v_caller_role = 'commander' THEN
    IF v_target_rank <= v_caller_rank THEN
      RAISE EXCEPTION 'Commanders can only change roles of lower-ranked members';
    END IF;
    IF v_new_rank <= v_caller_rank THEN
      RAISE EXCEPTION 'Commanders can only assign roles below their own rank';
    END IF;
  -- Captain: can only assign to lower-ranked, roles below captain
  ELSIF v_caller_role = 'captain' THEN
    IF v_target_rank <= v_caller_rank THEN
      RAISE EXCEPTION 'Captains can only change roles of lower-ranked members';
    END IF;
    IF v_new_rank <= v_caller_rank THEN
      RAISE EXCEPTION 'Captains can only assign roles below their own rank';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET role = p_role, updated_at = now() WHERE id = p_target;
END;
$function$;

-- 3. Update kick_member: commander can also kick
CREATE OR REPLACE FUNCTION public.kick_member(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  SELECT role INTO v_target_role FROM profiles WHERE id = p_target;

  IF v_caller_role NOT IN ('leader', 'acting-leader', 'commander') THEN
    RAISE EXCEPTION 'Only leaders or commanders can kick members';
  END IF;

  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'Cannot kick yourself';
  END IF;

  -- Commander cannot kick equal or higher ranked members
  IF v_caller_role = 'commander' AND v_target_role IN ('leader', 'acting-leader', 'commander') THEN
    RAISE EXCEPTION 'Cannot kick members of equal or higher rank';
  END IF;

  DELETE FROM profiles WHERE id = p_target;
END;
$function$;

-- 4. Update clan_notes policies to include new roles
DROP POLICY IF EXISTS "insert_clan_notes" ON clan_notes;
CREATE POLICY "insert_clan_notes" ON clan_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY[
        'leader', 'acting-leader', 'commander', 'captain',
        'military-officer', 'civil-affairs', 'staff'
      ])
    )
  );

DROP POLICY IF EXISTS "update_clan_notes" ON clan_notes;
CREATE POLICY "update_clan_notes" ON clan_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY[
        'leader', 'acting-leader', 'commander', 'captain',
        'military-officer', 'civil-affairs', 'staff'
      ])
    )
  );

DROP POLICY IF EXISTS "delete_clan_notes" ON clan_notes;
CREATE POLICY "delete_clan_notes" ON clan_notes FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY[
        'leader', 'acting-leader', 'commander', 'captain',
        'military-officer', 'civil-affairs', 'staff'
      ])
    )
  );

-- 5. Update approve_member and reject_member to be leader/acting-leader only
-- (They already are restricted, but let's verify and reinforce)
CREATE OR REPLACE FUNCTION public.approve_member(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only leaders can approve members';
  END IF;
  UPDATE profiles SET approved = true, approved_at = now(), approved_by = auth.uid()
  WHERE id = p_target AND approved = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_member(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only leaders can reject members';
  END IF;
  DELETE FROM profiles WHERE id = p_target AND approved = false;
END;
$function$;
