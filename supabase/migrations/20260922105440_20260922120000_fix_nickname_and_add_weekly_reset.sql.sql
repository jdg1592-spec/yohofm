/*
# Fix update_nickname schema cache + add weekly reset function and cron schedule

## Changes

### 1. Fix update_nickname schema cache issue
- Recreate the update_nickname function to force PostgREST schema cache refresh
- Grant EXECUTE to authenticated and anon

### 2. Add reset_weekly_resources function
- SECURITY DEFINER function that resets all weekly_resources data to 0
- Clears morning_push_days and day_score_overrides
- Does NOT touch tech_trees (clan tech excluded from reset)

### 3. Add manual_reset_weekly_resources function
- For frontend RPC calls, checks caller is leader/acting-leader
- Calls reset_weekly_resources internally

### 4. Set up pg_cron for weekly auto-reset
- Every Sunday at 09:00 KST (00:00 UTC Sunday)
- Uses pg_cron extension
*/

-- 1. Recreate update_nickname to refresh schema cache
CREATE OR REPLACE FUNCTION public.update_nickname(p_target uuid, p_nickname text)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.update_nickname(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_nickname(uuid, text) TO anon;

-- 2. Create reset_weekly_resources function (used by cron and manual)
CREATE OR REPLACE FUNCTION public.reset_weekly_resources()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE weekly_resources SET
    skill_tickets = 0,
    egg_shells = 0,
    pet_eggs = 0,
    mount_resources = 0,
    mounts = 0,
    clan_elixirs = 0,
    morning_push_days = '{}'::integer[],
    day_score_overrides = '{}'::jsonb,
    updated_at = now();
END;
$function$;

-- 3. Create manual_reset_weekly_resources for frontend RPC (with permission check)
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

-- 4. Set up pg_cron for weekly auto-reset every Sunday 09:00 KST (00:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly_resource_reset') THEN
    PERFORM cron.unschedule('weekly_resource_reset');
  END IF;
END
$do$;

SELECT cron.schedule(
  'weekly_resource_reset',
  '0 0 * * 0',
  'SELECT public.reset_weekly_resources()'
);

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
