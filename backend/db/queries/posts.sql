-- name: CreatePost :one
INSERT INTO public.generated_posts (user_id, brand_id, status, content_json, trend_context)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListPostsByUserID :many
SELECT * FROM public.generated_posts
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdatePostStatus :one
UPDATE public.generated_posts
SET status = $2
WHERE id = $1 AND user_id = $3
RETURNING *;
