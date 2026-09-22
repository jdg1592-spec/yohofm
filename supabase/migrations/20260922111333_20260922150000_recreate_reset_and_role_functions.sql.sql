/*
# Recreate manual_reset_weekly_resources + force schema cache reload

The function exists but PostgREST doesn't see it in its schema cache.
Recreating the function and sending a NOTIFY forces a reload.
*/

CREATE OR REPLACE FUNCTION public.manual_reset_weekly_resources()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다.';
  END IF;
  IF caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION '리더 또는 리더(대행)만 리셋할 수 있습니다.';
  END IF;
  PERFORM public.reset_weekly_resources();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.manual_reset_weekly_resources() TO authenticated;

-- Also recreate set_member_role to ensure schema cache picks it up
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

  IF p_role NOT IN ('leader', 'acting-leader', 'commander', 'captain', 'military-officer', 'civil-affairs', 'staff', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_target = auth.uid() AND v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only the Leader can change their own role';
  END IF;

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

  IF v_caller_role IN ('leader', 'acting-leader') THEN
    NULL;
  ELSIF v_caller_role = 'commander' THEN
    IF v_target_rank <= v_caller_rank THEN
      RAISE EXCEPTION 'Commanders can only change roles of lower-ranked members';
    END IF;
    IF v_new_rank <= v_caller_rank THEN
      RAISE EXCEPTION 'Commanders can only assign roles below their own rank';
    END IF;
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

NOTIFY pgrst, 'reload schema';
