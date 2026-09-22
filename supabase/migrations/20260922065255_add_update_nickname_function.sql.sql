/*
# Add update_nickname function

## Purpose
Allows clan leaders and acting-leaders to update any member's nickname.
This is a privileged operation that bypasses RLS because leaders need to
manage other users' profiles, which normal RLS policies prevent.

## Changes
1. New function: `update_nickname(p_target uuid, p_nickname text)`
   - SECURITY DEFINER: runs with the function owner's privileges, bypassing RLS
   - Only callable by authenticated users whose profile role is 'leader' or 'acting-leader'
   - Updates the `nickname` column of the target user's profile
   - Returns the updated profile row
2. Grants EXECUTE on the function to the `authenticated` role

## Security
- The function checks the caller's role before performing the update
- Non-leader users get a permission error
- The nickname is trimmed and must be non-empty
*/

CREATE OR REPLACE FUNCTION update_nickname(p_target uuid, p_nickname text)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  result profiles;
BEGIN
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다.';
  END IF;
  IF caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION '리더 또는 리더(대행)만 닉네임을 수정할 수 있습니다.';
  END IF;
  IF p_target IS NULL THEN
    RAISE EXCEPTION '대상 사용자를 지정해야 합니다.';
  END IF;
  IF p_nickname IS NULL OR btrim(p_nickname) = '' THEN
    RAISE EXCEPTION '닉네임은 비어 있을 수 없습니다.';
  END IF;

  UPDATE profiles SET nickname = btrim(p_nickname), updated_at = now()
  WHERE id = p_target
  RETURNING * INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_nickname(uuid, text) TO authenticated;
