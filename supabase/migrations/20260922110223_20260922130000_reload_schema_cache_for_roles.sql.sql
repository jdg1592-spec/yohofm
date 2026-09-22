/*
# Force PostgREST schema cache reload for set_member_role

The set_member_role function and profiles role constraint are correct,
but PostgREST may have a stale schema cache that doesn't recognize
'military-officer' and 'civil-affairs' as valid roles.

This migration recreates the function and forces a schema cache reload.
*/

-- Recreate set_member_role to force schema cache refresh
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

GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
