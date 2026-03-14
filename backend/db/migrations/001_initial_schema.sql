-- Migration: 001_initial_schema
-- Creates the core tables for brands and generated_posts.
-- RLS is enabled in migration 002.

-- ============================================================
-- brands table
-- One brand profile per user (enforced via RLS, not constraint).
-- competitor_handles is stored but hidden in Phase 1 UI;
-- surfaced in Phase 2 when competitor analysis ships.
-- state stores two-character Brazilian state codes (e.g. 'SP', 'RJ', 'MG').
-- ============================================================

CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL CHECK (char_length(state) = 2),
  tone_of_voice TEXT NOT NULL DEFAULT 'casual',
  tone_custom TEXT,           -- populated when tone_of_voice = 'other'
  cta_channel TEXT NOT NULL CHECK (cta_channel IN ('whatsapp', 'landing_page', 'dm')),
  competitor_handles TEXT[],  -- stored but hidden in Phase 1 UI, surfaced in Phase 2
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brands_user_id ON public.brands(user_id);

-- ============================================================
-- generated_posts table
-- Stores AI-generated social post candidates.
-- content_json holds structured output: text, cta, hashtags, format, justification.
-- trend_context holds pytrends data used during generation (for auditability).
-- ============================================================

CREATE TABLE public.generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  content_json JSONB NOT NULL,  -- stores text, cta, hashtags, format, justification
  trend_context JSONB,          -- pytrends data used for generation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_posts_user_id ON public.generated_posts(user_id);
CREATE INDEX idx_generated_posts_brand_id ON public.generated_posts(brand_id);
CREATE INDEX idx_generated_posts_status ON public.generated_posts(status);

-- ============================================================
-- updated_at trigger
-- Auto-maintains updated_at on every UPDATE operation.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_generated_posts_updated_at
  BEFORE UPDATE ON public.generated_posts
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
