/*
# Reload PostgREST schema cache

The manual_reset_weekly_resources and set_member_role functions exist
and have correct grants, but PostgREST has a stale schema cache.
This migration forces a reload.
*/

NOTIFY pgrst, 'reload schema';
