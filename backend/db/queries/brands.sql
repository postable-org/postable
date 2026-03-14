-- name: CreateBrand :one
INSERT INTO public.brands (user_id, niche, city, state, tone_of_voice, tone_custom, cta_channel, competitor_handles)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetBrandByUserID :one
SELECT * FROM public.brands
WHERE user_id = $1
LIMIT 1;

-- name: UpdateBrand :one
UPDATE public.brands
SET niche = $2, city = $3, state = $4, tone_of_voice = $5, tone_custom = $6, cta_channel = $7, competitor_handles = $8
WHERE user_id = $1
RETURNING *;

-- name: DeleteBrand :exec
DELETE FROM public.brands WHERE user_id = $1;
