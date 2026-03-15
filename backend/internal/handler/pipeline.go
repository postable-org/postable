package handler

import (
	"context"
	"net/http"
	"strings"

	"postable/internal/service"
)

type PipelinePostService interface {
	ListByUserID(ctx context.Context, userID string) ([]service.Post, error)
}

type PipelineSocialService interface {
	ListJobs(ctx context.Context, userID, status string) ([]service.SocialPostJob, error)
}

type PipelineHandler struct {
	postSvc   PipelinePostService
	socialSvc PipelineSocialService
}

type pipelineBoardResponse struct {
	Draft     []service.Post `json:"draft"`
	Pending   []service.Post `json:"pending"`
	Approved  []service.Post `json:"approved"`
	Published []service.Post `json:"published"`
	Rejected  []service.Post `json:"rejected"`
}

func NewPipelineHandler(postSvc PipelinePostService, socialSvc PipelineSocialService) *PipelineHandler {
	return &PipelineHandler{postSvc: postSvc, socialSvc: socialSvc}
}

// Board handles GET /api/pipeline/board and returns posts already classified
// by backend associations (post status + published social jobs).
func (h *PipelineHandler) Board(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	platform := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("platform")))
	if platform == "all" {
		platform = ""
	}

	posts, err := h.postSvc.ListByUserID(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	jobs, err := h.socialSvc.ListJobs(r.Context(), userID, service.SocialJobPublished)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	publishedIDs := make(map[string]struct{}, len(jobs))
	for _, job := range jobs {
		if job.PostID != nil && strings.TrimSpace(*job.PostID) != "" {
			publishedIDs[strings.TrimSpace(*job.PostID)] = struct{}{}
			continue
		}
		if v := strings.TrimSpace(job.Payload.PostID); v != "" {
			publishedIDs[v] = struct{}{}
		}
	}

	resp := pipelineBoardResponse{
		Draft:     []service.Post{},
		Pending:   []service.Post{},
		Approved:  []service.Post{},
		Published: []service.Post{},
		Rejected:  []service.Post{},
	}

	for _, post := range posts {
		if platform != "" && strings.ToLower(strings.TrimSpace(post.Platform)) != platform {
			continue
		}

		if _, isPublished := publishedIDs[post.ID]; isPublished {
			resp.Published = append(resp.Published, post)
			continue
		}

		switch post.Status {
		case "pending":
			resp.Pending = append(resp.Pending, post)
		case "approved":
			// Approved-but-not-published is treated as saved draft in the pipeline.
			resp.Draft = append(resp.Draft, post)
		case "rejected":
			resp.Rejected = append(resp.Rejected, post)
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
