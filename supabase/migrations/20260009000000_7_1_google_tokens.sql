-- Migration 7.1: google_tokens table
-- Part of Danes Music Studio booking app — Google Calendar sync (Phase 07)
-- Stores AES-256-GCM encrypted Google OAuth refresh token for calendar sync.
-- Single-row table (one owner). Upsert on connect, delete on disconnect.
--
-- PREREQUISITES (manual steps before running this migration):
-- 1. Generate encryption key: openssl rand -hex 32
--    Set as GOOGLE_TOKEN_ENCRYPTION_KEY in Vercel env vars and local .env.local
-- 2. Generate webhook token: openssl rand -hex 16
--    Set as GCAL_WEBHOOK_TOKEN in Vercel env vars and local .env.local
-- 3. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in Vercel + .env.local

CREATE TABLE IF NOT EXISTS google_tokens (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_refresh_token text       NOT NULL,
  google_email           text        NOT NULL,
  calendar_id            text        NOT NULL DEFAULT 'primary',
  sync_token             text,
  watch_channel_id       text,
  watch_resource_id      text,
  watch_expires_at       timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users (admin) have full access
-- Uses idempotent DO $$ guard (same pattern as 20260008000000_5_1_admin_rls.sql)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'google_tokens' AND policyname = 'admin_all_google_tokens'
  ) THEN
    CREATE POLICY admin_all_google_tokens ON google_tokens
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Verify table created:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'google_tokens';
--
-- Verify RLS policy:
-- SELECT * FROM pg_policies WHERE tablename = 'google_tokens';
