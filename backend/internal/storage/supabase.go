package storage

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// SupabaseStorageClient uploads images to Supabase Storage via the REST API.
type SupabaseStorageClient struct {
	baseURL        string
	serviceRoleKey string
	bucket         string
	httpClient     *http.Client
}

// NewSupabaseStorageClient creates a SupabaseStorageClient configured from environment variables.
// Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Bucket defaults to "post-images".
func NewSupabaseStorageClient() *SupabaseStorageClient {
	return &SupabaseStorageClient{
		baseURL:        os.Getenv("SUPABASE_URL"),
		serviceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		bucket:         "post-images",
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

// UploadImage uploads imageBytes to Supabase Storage under <userID>/<hex>.ext
// and returns the public URL.
func (c *SupabaseStorageClient) UploadImage(ctx context.Context, userID string, imageBytes []byte, mimeType string) (string, error) {
	if c.baseURL == "" || c.serviceRoleKey == "" {
		return "", fmt.Errorf("supabase storage not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
	}

	ext := "jpg"
	if mimeType == "image/png" {
		ext = "png"
	}

	filename := fmt.Sprintf("%s/%s.%s", userID, randomHex(), ext)
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.baseURL, c.bucket, filename)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bytes.NewReader(imageBytes))
	if err != nil {
		return "", fmt.Errorf("create upload request: %w", err)
	}
	req.Header.Set("Content-Type", mimeType)
	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload request failed: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) //nolint:errcheck

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("storage upload returned status %d", resp.StatusCode)
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", c.baseURL, c.bucket, filename)
	return publicURL, nil
}

func randomHex() string {
	var buf [16]byte
	rand.Read(buf[:]) //nolint:errcheck
	return hex.EncodeToString(buf[:])
}
