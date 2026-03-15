-- Add platform to generated_posts
ALTER TABLE public.generated_posts
  ADD COLUMN platform TEXT NOT NULL DEFAULT 'instagram'
  CHECK (platform IN ('instagram', 'linkedin', 'facebook', 'x', 'reddit'));

CREATE INDEX idx_generated_posts_platform ON public.generated_posts (user_id, platform, created_at);

-- Subscriptions table (one active subscription per user)
CREATE TABLE public.subscriptions (
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

CREATE INDEX idx_subscriptions_user ON public.subscriptions (user_id);
CREATE INDEX idx_subscriptions_customer ON public.subscriptions (stripe_customer_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS: users can only read their own subscription
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE policies — all writes come from backend (bypasses RLS via pgxpool direct connection)
