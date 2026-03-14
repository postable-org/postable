-- name: ListBrandCompetitors :many
SELECT
  c.id,
  c.user_id,
  c.brand_id,
  c.handle,
  c.normalized_handle,
  c.source,
  c.is_locked,
  c.status,
  c.replaced_by,
  c.locality_basis,
  c.state_key,
  c.last_checked_at,
  c.last_active_at,
  c.created_at,
  c.updated_at,
  r.handle AS replacement_handle
FROM public.brand_competitors c
LEFT JOIN public.brand_competitors r ON r.id = c.replaced_by
WHERE c.user_id = $1
  AND c.brand_id = $2
ORDER BY c.created_at ASC;

-- name: UpsertBrandCompetitor :one
INSERT INTO public.brand_competitors (
  user_id,
  brand_id,
  handle,
  normalized_handle,
  source,
  is_locked,
  status,
  replaced_by,
  locality_basis,
  state_key,
  last_checked_at,
  last_active_at
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11,
  $12
)
ON CONFLICT (brand_id, normalized_handle) WHERE status <> 'replaced'
DO UPDATE SET
  handle = EXCLUDED.handle,
  source = EXCLUDED.source,
  is_locked = EXCLUDED.is_locked,
  status = EXCLUDED.status,
  replaced_by = EXCLUDED.replaced_by,
  locality_basis = EXCLUDED.locality_basis,
  state_key = EXCLUDED.state_key,
  last_checked_at = EXCLUDED.last_checked_at,
  last_active_at = EXCLUDED.last_active_at,
  updated_at = now()
RETURNING *;

-- name: RemoveBrandCompetitor :one
UPDATE public.brand_competitors
SET
  status = 'replaced',
  replaced_by = NULL,
  last_checked_at = now(),
  updated_at = now()
WHERE user_id = $1
  AND brand_id = $2
  AND normalized_handle = $3
RETURNING *;

-- name: UpdateCompetitorLock :one
UPDATE public.brand_competitors
SET
  is_locked = $4,
  updated_at = now()
WHERE user_id = $1
  AND brand_id = $2
  AND normalized_handle = $3
RETURNING *;

-- name: UpdateCompetitorStatus :one
UPDATE public.brand_competitors
SET
  status = $4,
  replaced_by = $5,
  last_checked_at = $6,
  last_active_at = $7,
  updated_at = now()
WHERE id = $1
  AND user_id = $2
  AND brand_id = $3
RETURNING *;

-- name: InsertCompetitorSnapshot :one
INSERT INTO public.competitor_snapshots (
  user_id,
  brand_id,
  competitor_id,
  captured_at,
  window_days,
  post_count,
  themes_json,
  signals_json,
  confidence
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9
)
RETURNING *;

-- name: ListLatestSnapshotsByBrand :many
SELECT DISTINCT ON (s.competitor_id)
  s.id,
  s.user_id,
  s.brand_id,
  s.competitor_id,
  s.captured_at,
  s.window_days,
  s.post_count,
  s.themes_json,
  s.signals_json,
  s.confidence
FROM public.competitor_snapshots s
WHERE s.user_id = $1
  AND s.brand_id = $2
ORDER BY s.competitor_id, s.captured_at DESC;

-- name: ListActiveCompetitorSignals :many
SELECT
  c.id,
  c.normalized_handle,
  c.source,
  c.is_locked,
  c.status,
  COALESCE(latest.post_count, 0) AS post_count,
  COALESCE(latest.confidence, 0) AS confidence
FROM public.brand_competitors c
LEFT JOIN LATERAL (
  SELECT post_count, confidence
  FROM public.competitor_snapshots s
  WHERE s.competitor_id = c.id
  ORDER BY captured_at DESC
  LIMIT 1
) latest ON true
WHERE c.user_id = $1
  AND c.brand_id = $2
  AND c.status = 'active'
ORDER BY confidence ASC, post_count ASC, c.created_at ASC;
