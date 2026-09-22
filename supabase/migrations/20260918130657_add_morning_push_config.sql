/*
# Add morning_push_config column to clan_settings

1. Modified Tables
  - `clan_settings`
    - Added `morning_push_config` (jsonb, default '{}') - stores per-day (2-5) active resource selections for morning push scoring.
      Example: {"2": ["mount_resources","mounts"], "3": ["skill_tickets","egg_shells"], ...}

2. Notes
  - Non-destructive: adds a new column with a default value.
  - Existing clan_tech_nodes column is preserved.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'clan_settings'
    AND column_name = 'morning_push_config'
  ) THEN
    ALTER TABLE clan_settings ADD COLUMN morning_push_config jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;

UPDATE clan_settings SET morning_push_config = '{}' WHERE id = 1 AND morning_push_config IS NULL;
