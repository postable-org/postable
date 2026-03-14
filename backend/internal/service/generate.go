package service

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// GenerateService handles streaming generation requests to the Python agent.
type GenerateService struct {
	pythonAgentURL string
	httpClient     *http.Client
}

// NewGenerateService creates a new GenerateService.
func NewGenerateService() *GenerateService {
	url := os.Getenv("PYTHON_AGENT_URL")
	if url == "" {
		url = "http://localhost:8000"
		slog.Warn("PYTHON_AGENT_URL not set, using default", "url", url)
	} else {
		slog.Info("generate service initialized", "pythonAgentURL", url)
	}
	return &GenerateService{
		pythonAgentURL: url,
		httpClient:     &http.Client{Timeout: 70 * time.Second},
	}
}

// Stream calls the Python agent with a pre-marshaled brand JSON payload
// and writes SSE events to the provided writer.
// It respects ctx cancellation (client disconnect) and sends heartbeats every 15 seconds.
func (s *GenerateService) Stream(ctx context.Context, brandJSON string, w http.ResponseWriter) {
	s.StreamAndReturn(ctx, brandJSON, w)
}

// StreamAndReturn streams SSE events to w and returns the final response JSON
// (the last data line from the Python agent, which is the GenerateResponse JSON).
// Returns nil responseJSON on error or client disconnect.
func (s *GenerateService) StreamAndReturn(ctx context.Context, brandJSON string, w http.ResponseWriter) (responseJSON []byte, err error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return nil, fmt.Errorf("streaming not supported")
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Emit explicit stage visibility before content generation completes.
	fmt.Fprintf(w, "event: progress\ndata: {\"stage\":\"competitor-analysis\",\"status\":\"started\"}\n\n")
	flusher.Flush()

	messageChan := make(chan string, 32)
	errChan := make(chan error, 1)

	go func() {
		defer close(messageChan)

		agentCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		defer cancel()

		body, err := s.callPythonAgent(agentCtx, brandJSON)
		if err != nil {
			errChan <- err
			return
		}
		defer body.Close()

		buf := make([]byte, 4096)
		var partial string
		for {
			n, readErr := body.Read(buf)
			if n > 0 {
				chunk := partial + string(buf[:n])
				lines := strings.Split(chunk, "\n")
				for i, line := range lines {
					if i < len(lines)-1 {
						if line != "" {
							messageChan <- line
						}
					} else {
						partial = line
					}
				}
			}
			if readErr != nil {
				if partial != "" {
					messageChan <- partial
				}
				break
			}
		}
	}()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	var fullDataPayload strings.Builder

	for {
		select {
		case <-ctx.Done():
			// Client disconnected — exit goroutine cleanly.
			return nil, ctx.Err()
		case agentErr := <-errChan:
			slog.Error("generate stream: python agent error", "error", agentErr)
			fmt.Fprintf(w, "event: error\ndata: %s\n\n", agentErr.Error())
			flusher.Flush()
			return nil, agentErr
		case line, open := <-messageChan:
			if !open {
				fmt.Fprintf(w, "event: progress\ndata: {\"stage\":\"content-generation\",\"status\":\"complete\"}\n\n")
				fmt.Fprintf(w, "event: done\ndata: null\n\n")
				flusher.Flush()
				payload := strings.TrimSpace(fullDataPayload.String())
				if payload != "" {
					return []byte(payload), nil
				}
				return nil, nil
			}
			if fullDataPayload.Len() > 0 {
				fullDataPayload.WriteByte('\n')
			}
			fullDataPayload.WriteString(line)
			fmt.Fprintf(w, "data: %s\n\n", line)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

// callPythonAgent sends a POST request to the Python agent's /generate endpoint.
func (s *GenerateService) callPythonAgent(ctx context.Context, brandJSON string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.pythonAgentURL+"/generate", strings.NewReader(brandJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("python agent request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("python agent returned status %d", resp.StatusCode)
	}

	return resp.Body, nil
}
