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