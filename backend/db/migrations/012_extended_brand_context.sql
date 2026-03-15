-- 012_extended_brand_context.sql
-- Extends brands table with rich brand identity, visual identity, and audience fields

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS brand_colors                TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_fonts                 TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS design_style                TEXT,
  ADD COLUMN IF NOT EXISTS target_age_min              INTEGER,
  ADD COLUMN IF NOT EXISTS target_age_max              INTEGER,
  ADD COLUMN IF NOT EXISTS target_gender               TEXT    DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS company_history             TEXT,
  ADD COLUMN IF NOT EXISTS brand_tagline               TEXT,
  ADD COLUMN IF NOT EXISTS brand_values                TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_key_people            TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_must_use              TEXT,
  ADD COLUMN IF NOT EXISTS brand_must_avoid            TEXT,
  ADD COLUMN IF NOT EXISTS target_audience_description TEXT;

COMMENT ON COLUMN public.brands.brand_colors                IS 'HEX color palette for visual identity, e.g. {#FF6B35,#2D2D2D}';
COMMENT ON COLUMN public.brands.brand_fonts                 IS 'Font family names used in brand visual identity';
COMMENT ON COLUMN public.brands.design_style                IS 'Visual design aesthetic, e.g. minimalista, ousado, clássico';
COMMENT ON COLUMN public.brands.target_age_min              IS 'Minimum age of target audience (0 = not set)';
COMMENT ON COLUMN public.brands.target_age_max              IS 'Maximum age of target audience (0 = not set)';
COMMENT ON COLUMN public.brands.target_gender               IS 'Primary target gender: all, feminino, masculino, nao-binario';
COMMENT ON COLUMN public.brands.company_history             IS 'Long-form company origin story and history';
COMMENT ON COLUMN public.brands.brand_tagline               IS 'Company slogan or tagline';
COMMENT ON COLUMN public.brands.brand_values                IS 'Core company values';
COMMENT ON COLUMN public.brands.brand_key_people            IS 'Key founders, leaders, or team members to reference';
COMMENT ON COLUMN public.brands.brand_must_use              IS 'Words, phrases, or elements the AI must always include';
COMMENT ON COLUMN public.brands.brand_must_avoid            IS 'Words, phrases, or topics the AI must never use';
COMMENT ON COLUMN public.brands.target_audience_description IS 'Detailed description of target audience personas';
