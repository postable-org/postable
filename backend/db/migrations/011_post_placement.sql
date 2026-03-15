-- 011_post_placement.sql
-- Add placement, creative_spec, brand_facts_used, and sources columns to generated_posts

ALTER TABLE generated_posts
    ADD COLUMN IF NOT EXISTS placement         TEXT,
    ADD COLUMN IF NOT EXISTS creative_spec     JSONB,
    ADD COLUMN IF NOT EXISTS brand_facts_used  TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sources           TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN generated_posts.placement IS
    'Platform surface: feed, story, reel, carousel, thread, post';
COMMENT ON COLUMN generated_posts.creative_spec IS
    'JSON: {aspect_ratio, style_notes, alt_text}';
COMMENT ON COLUMN generated_posts.brand_facts_used IS
    'Brand facts cited in copy, for hallucination auditing';
COMMENT ON COLUMN generated_posts.sources IS
    'Source URLs or titles from agent web research';
