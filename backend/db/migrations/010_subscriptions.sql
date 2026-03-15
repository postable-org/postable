-- Migration: 010_subscriptions
-- Adds platform to generated_posts and creates subscriptions table.
-- This migration is idempotent to support environments that may have applied parts of the old 006_subscriptions migration.

ALTER TABLE public.generated_posts
  ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE public.generated_posts
  ALTER COLUMN platform SET DEFAULT 'instagram';

UPDATE public.generated_posts
SET platform = 'instagram'
WHERE platform IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generated_posts_platform_check'
      AND conrelid = 'public.generated_posts'::regclass
  ) THEN
    ALTER TABLE public.generated_posts
      ADD CONSTRAINT generated_posts_platform_check
      CHECK (platform IN ('instagram', 'linkedin', 'facebook', 'x', 'reddit'));
  END IF;
END $$;

ALTER TABLE public.generated_posts
  ALTER COLUMN platform SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_generated_posts_platform ON public.generated_posts (user_id, platform, created_at);

-- Subscriptions table (one active subscription per user)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan                   TEXT NOT NULL CHECK (plan IN ('basic', 'advanced', 'agency')),
  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
  current_period_start   TIMESTAMPTZ NOT NULL,
  current_period_end     TIMESTAMPTZ NOT NULL,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions (stripe_customer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_subscriptions_updated_at'
      AND tgrelid = 'public.subscriptions'::regclass
  ) THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- RLS: users can only read their own subscription
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'subscriptions_select_own'
  ) THEN
    CREATE POLICY "subscriptions_select_own" ON public.subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- No INSERT/UPDATE policies — all writes come from backend (bypasses RLS via pgxpool direct connection)
