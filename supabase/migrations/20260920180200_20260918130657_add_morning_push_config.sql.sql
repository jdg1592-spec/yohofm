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