-- Migration: 002_rls_policies
-- Enables Row Level Security on both tables and creates per-operation policies.
-- All policies use auth.uid() to scope rows to the authenticated user only.
-- Four separate policies per table (not FOR ALL) for clarity and auditability.

-- ============================================================
-- Enable RLS (non-negotiable from day 1)
-- ============================================================

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- brands policies (4 — one per operation)
-- ============================================================

CREATE POLICY "brands_select_own"
  ON public.brands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "brands_insert_own"
  ON public.brands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brands_update_own"
  ON public.brands FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brands_delete_own"
  ON public.brands FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- generated_posts policies (4 — one per operation)
-- ============================================================

CREATE POLICY "posts_select_own"
  ON public.generated_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "posts_insert_own"
  ON public.generated_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_own"
  ON public.generated_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete_own"
  ON public.generated_posts FOR DELETE
  USING (auth.uid() = user_id);
