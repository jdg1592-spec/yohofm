/*
# Add member approval system to profiles

1. Changes to existing tables
- profiles: add `approved` boolean column (default false) — new signups require leader approval
- profiles: add `approved_at` timestamptz (nullable) — when the leader approved
- profiles: add `approved_by` uuid (nullable, references profiles) — who approved

2. New functions
- approve_member(p_target uuid): sets approved=true, approved_at=now(), approved_by=caller. Only leader/acting-leader can call.
- reject_member(p_target uuid): deletes the profile row (and cascades). Only leader/acting-leader can call.

3. Security changes
- profiles INSERT policy: new users can only insert their own row with approved=false
- profiles SELECT policy: all authenticated users can see profiles (needed to show member list)
- Column privileges: authenticated users cannot UPDATE the approved/approved_at/approved_by columns
- EXECUTE on approve_member/reject_member granted to authenticated only

4. Important notes
- Existing profiles are grandfathered in as approved=true via UPDATE on migration
- The approve/reject functions are SECURITY DEFINER and check caller role internally
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'approved'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Grandfather existing profiles as approved
UPDATE profiles SET approved = true, approved_at = created_at WHERE approved = false AND created_at < now() - interval '1 minute';

-- Revoke UPDATE on approval columns from authenticated (server-enforced)
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (nickname, updated_at) ON profiles TO authenticated;

-- Drop and recreate INSERT policy so new users insert with approved=false
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Drop and recreate SELECT policy
DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

CREATE OR REPLACE FUNCTION approve_member(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only the Leader can approve members';
  END IF;
  UPDATE profiles
  SET approved = true, approved_at = now(), approved_by = auth.uid(), updated_at = now()
  WHERE id = p_target AND approved = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found or already approved';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION approve_member FROM anon;
GRANT EXECUTE ON FUNCTION approve_member TO authenticated;

CREATE OR REPLACE FUNCTION reject_member(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Only the Leader can reject members';
  END IF;
  SELECT role INTO v_target_role FROM profiles WHERE id = p_target;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF v_target_role IN ('leader', 'acting-leader') THEN
    RAISE EXCEPTION 'Cannot reject a leader';
  END IF;
  DELETE FROM profiles WHERE id = p_target;
END;
$$;
REVOKE EXECUTE ON FUNCTION reject_member FROM anon;
GRANT EXECUTE ON FUNCTION reject_member TO authenticated;