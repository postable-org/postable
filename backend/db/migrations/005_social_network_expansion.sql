-- Migration: 005_social_network_expansion
-- Expands supported social networks for connections and publishing jobs.

ALTER TABLE public.social_connections
  DROP CONSTRAINT IF EXISTS social_connections_network_check;

ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_network_check
  CHECK (network IN ('linkedin', 'facebook', 'instagram', 'reddit', 'x'));

ALTER TABLE public.social_post_jobs
  DROP CONSTRAINT IF EXISTS social_post_jobs_network_check;

ALTER TABLE public.social_post_jobs
  ADD CONSTRAINT social_post_jobs_network_check
  CHECK (network IN ('linkedin', 'facebook', 'instagram', 'reddit', 'x'));
