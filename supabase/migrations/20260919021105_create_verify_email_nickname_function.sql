/*
# Create verify_email_nickname function for password reset

1. New Functions
  - `verify_email_nickname(p_email text, p_nickname text)` returns boolean
  - Joins auth.users and profiles to verify both email and nickname match
  - SECURITY DEFINER so it can read auth.users without exposing data
  - Callable by anon and authenticated roles (needed from login screen)

2. Security
  - Function only returns true/false, never leaks user data
  - Uses exact match on both fields
*/

CREATE OR REPLACE FUNCTION verify_email_nickname(p_email text, p_nickname text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE u.email = p_email
      AND p.nickname = p_nickname
  );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_email_nickname(text, text) TO anon, authenticated;
