-- Migration: 003_competitor_analysis
-- Adds competitor persistence and evidence snapshots used for gap analysis.

CREATE TABLE public.brand_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  normalized_handle TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('user', 'auto')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'private', 'inactive', 'replaced')),
  replaced_by UUID REFERENCES public.brand_competitors(id) ON DELETE SET NULL,
  locality_basis TEXT NOT NULL DEFAULT 'state',
  state_key TEXT,
  last_checked_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.brand_competitors(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_days INT NOT NULL DEFAULT 30 CHECK (window_days > 0),
  post_count INT NOT NULL DEFAULT 0 CHECK (post_count >= 0),
  themes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_brand_competitors_active_handle
  ON public.brand_competitors (brand_id, normalized_handle)
  WHERE status <> 'replaced';

CREATE INDEX idx_brand_competitors_user_brand
  ON public.brand_competitors (user_id, brand_id);

CREATE INDEX idx_competitor_snapshots_user_brand
  ON public.competitor_snapshots (user_id, brand_id);

CREATE INDEX idx_competitor_snapshots_competitor_captured_at
  ON public.competitor_snapshots (competitor_id, captured_at DESC);

CREATE TRIGGER update_brand_competitors_updated_at
  BEFORE UPDATE ON public.brand_competitors
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.brand_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_competitors_select_own"
  ON public.brand_competitors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "brand_competitors_insert_own"
  ON public.brand_competitors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brand_competitors_update_own"
  ON public.brand_competitors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brand_competitors_delete_own"
  ON public.brand_competitors FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "competitor_snapshots_select_own"
  ON public.competitor_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "competitor_snapshots_insert_own"
  ON public.competitor_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "competitor_snapshots_update_own"
  ON public.competitor_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "competitor_snapshots_delete_own"
  ON public.competitor_snapshots FOR DELETE
  USING (auth.uid() = user_id);
