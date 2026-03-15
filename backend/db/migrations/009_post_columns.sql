-- 009_post_columns.sql
-- Explode content_json JSONB into typed columns for easier querying and type safety.
-- Existing data is migrated from content_json before the column is dropped.

ALTER TABLE public.generated_posts
  ADD COLUMN post_text             TEXT,
  ADD COLUMN cta                   TEXT,
  ADD COLUMN hashtags              TEXT[],
  ADD COLUMN suggested_format      TEXT,
  ADD COLUMN strategic_justification TEXT,
  ADD COLUMN tokens_used           INTEGER,
  ADD COLUMN image_url             TEXT,
  ADD COLUMN image_prompt          TEXT;

UPDATE public.generated_posts SET
  post_text              = content_json->>'post_text',
  cta                    = content_json->>'cta',
  hashtags               = ARRAY(SELECT jsonb_array_elements_text(COALESCE(content_json->'hashtags', '[]'::jsonb))),
  suggested_format       = content_json->>'suggested_format',
  strategic_justification = content_json->>'strategic_justification',
  tokens_used            = NULLIF(content_json->>'tokens_used', '')::INTEGER,
  image_url              = NULLIF(content_json->>'image_url', ''),
  image_prompt           = NULLIF(content_json->>'image_prompt', '');

ALTER TABLE public.generated_posts DROP COLUMN content_json;
