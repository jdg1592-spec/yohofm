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
  IF v_caller_role = 'leader' THEN
    IF p_role NOT IN ('leader', 'commander', 'captain', 'staff', 'member') THEN
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
  IF v_caller_role != 'leader' THEN
    RAISE EXCEPTION 'Only the Leader can clear red warnings';
  END IF;
  UPDATE profiles SET red_warning = false, red_warning_locked_at = NULL, updated_at = now() WHERE id = p_target;
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
  IF v_caller_role NOT IN ('leader', 'commander') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET red_warning = true, red_warning_locked_at = now(), updated_at = now() WHERE id = p_target;
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
  IF v_caller_role NOT IN ('leader', 'commander') THEN
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
  IF v_caller_role != 'leader' THEN
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