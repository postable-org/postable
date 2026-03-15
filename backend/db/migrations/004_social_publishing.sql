-- Migration: 004_social_publishing
-- Adds social network connection storage and publication jobs (immediate/scheduled).

CREATE TABLE public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  network TEXT NOT NULL CHECK (network IN ('linkedin', 'facebook', 'x')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, network, account_id)
);

CREATE INDEX idx_social_connections_user_id ON public.social_connections(user_id);
CREATE INDEX idx_social_connections_user_network ON public.social_connections(user_id, network);

CREATE TABLE public.social_post_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.generated_posts(id) ON DELETE SET NULL,
  connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  network TEXT NOT NULL CHECK (network IN ('linkedin', 'facebook', 'x')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'published', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  provider_post_id TEXT,
  payload_json JSONB NOT NULL,
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_post_jobs_user_id ON public.social_post_jobs(user_id);
CREATE INDEX idx_social_post_jobs_status_scheduled ON public.social_post_jobs(status, scheduled_for);
CREATE INDEX idx_social_post_jobs_connection ON public.social_post_jobs(connection_id);

CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_social_post_jobs_updated_at
  BEFORE UPDATE ON public.social_post_jobs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_connections_select_own"
  ON public.social_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "social_connections_insert_own"
  ON public.social_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_connections_update_own"
  ON public.social_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_connections_delete_own"
  ON public.social_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "social_jobs_select_own"
  ON public.social_post_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "social_jobs_insert_own"
  ON public.social_post_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_jobs_update_own"
  ON public.social_post_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_jobs_delete_own"
  ON public.social_post_jobs FOR DELETE
  USING (auth.uid() = user_id);
