package handler

import (
	"fmt"
	"io"
	"mime"
	"net/http"

	"postable/internal/storage"
)

const maxUploadBytes = 10 << 20 // 10 MB

// UploadHandler handles image uploads to Supabase Storage.
type UploadHandler struct {
	storage *storage.SupabaseStorageClient
}

// NewUploadHandler creates an UploadHandler.
func NewUploadHandler(s *storage.SupabaseStorageClient) *UploadHandler {
	return &UploadHandler{storage: s}
}

// UploadImage handles POST /api/images/upload.
// Accepts multipart/form-data with field "file"; returns {"url": "..."}.
func (h *UploadHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "arquivo muito grande ou formulário inválido"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "campo 'file' ausente"})
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}
	mt, _, _ := mime.ParseMediaType(contentType)
	switch mt {
	case "image/jpeg", "image/png", "image/webp", "image/gif":
		// accepted
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tipo de arquivo não suportado; use jpeg, png, webp ou gif"})
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "falha ao ler arquivo"})
		return
	}

	url, err := h.storage.UploadImage(r.Context(), userID, data, mt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("upload falhou: %s", err.Error())})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}
