package service

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type recordedRequest struct {
	Method string
	URL    string
	Header http.Header
	Body   string
}

type fakeHTTPDoer struct {
	responses []*http.Response
	requests  []recordedRequest
}

func (f *fakeHTTPDoer) Do(req *http.Request) (*http.Response, error) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	_ = req.Body.Close()
	f.requests = append(f.requests, recordedRequest{
		Method: req.Method,
		URL:    req.URL.String(),
		Header: req.Header.Clone(),
		Body:   string(body),
	})
	if len(f.responses) == 0 {
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{}`))}, nil
	}
	resp := f.responses[0]
	f.responses = f.responses[1:]
	if resp.Header == nil {
		resp.Header = make(http.Header)
	}
	if resp.Body == nil {
		resp.Body = io.NopCloser(bytes.NewBuffer(nil))
	}
	return resp, nil
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestIsValidSocialNetwork_ExpandedSet(t *testing.T) {
	valid := []string{SocialNetworkLinkedIn, SocialNetworkFacebook, SocialNetworkInstagram, SocialNetworkReddit, SocialNetworkX}
	for _, network := range valid {
		if !IsValidSocialNetwork(network) {
			t.Fatalf("expected %q to be valid", network)
		}
	}
	if IsValidSocialNetwork("threads") {
		t.Fatalf("expected unsupported network to be invalid")
	}
}

func TestInstagramPublisher_PublishSingleMedia(t *testing.T) {
	client := &fakeHTTPDoer{responses: []*http.Response{
		jsonResponse(http.StatusOK, `{"id":"container-1"}`),
		jsonResponse(http.StatusOK, `{"id":"ig-media-1"}`),
	}}
	publisher := NewInstagramPublisher(client)

	result, err := publisher.Publish(context.Background(), SocialConnection{AccountID: "ig-account-1", AccessToken: "token"}, SocialPublishPayload{
		Text:      "Legenda",
		MediaURLs: []string{"https://cdn.example.com/post-image.jpg"},
	})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if result.ProviderPostID != "ig-media-1" {
		t.Fatalf("expected provider id ig-media-1, got %q", result.ProviderPostID)
	}
	if len(client.requests) != 2 {
		t.Fatalf("expected 2 requests, got %d", len(client.requests))
	}
	if !strings.Contains(client.requests[0].URL, "/ig-account-1/media") {
		t.Fatalf("unexpected media create url: %s", client.requests[0].URL)
	}
	if !strings.Contains(client.requests[0].Body, `"image_url":"https://cdn.example.com/post-image.jpg"`) {
		t.Fatalf("expected image_url in request body, got %s", client.requests[0].Body)
	}
	if !strings.Contains(client.requests[1].URL, "/ig-account-1/media_publish") {
		t.Fatalf("unexpected media publish url: %s", client.requests[1].URL)
	}
	if !strings.Contains(client.requests[1].Body, `"creation_id":"container-1"`) {
		t.Fatalf("expected creation_id in publish body, got %s", client.requests[1].Body)
	}
}

func TestInstagramPublisher_RequiresMediaURL(t *testing.T) {
	publisher := NewInstagramPublisher(&fakeHTTPDoer{})
	_, err := publisher.Publish(context.Background(), SocialConnection{AccountID: "ig-account-1", AccessToken: "token"}, SocialPublishPayload{})
	if err == nil {
		t.Fatalf("expected error for missing media url")
	}
	if !strings.Contains(err.Error(), "media_url") {
		t.Fatalf("expected media_url validation error, got %v", err)
	}
}

func TestRedditPublisher_PublishSelfPost(t *testing.T) {
	client := &fakeHTTPDoer{responses: []*http.Response{
		jsonResponse(http.StatusOK, `{"json":{"errors":[],"data":{"name":"t3_abc123"}}}`),
	}}
	publisher := NewRedditPublisher(client)

	result, err := publisher.Publish(context.Background(), SocialConnection{AccessToken: "reddit-token"}, SocialPublishPayload{
		Title:     "Meu titulo",
		Subreddit: "golang",
		Text:      "Corpo do post",
	})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if result.ProviderPostID != "t3_abc123" {
		t.Fatalf("expected provider id t3_abc123, got %q", result.ProviderPostID)
	}
	if len(client.requests) != 1 {
		t.Fatalf("expected 1 request, got %d", len(client.requests))
	}
	req := client.requests[0]
	if req.URL != "https://oauth.reddit.com/api/submit" {
		t.Fatalf("unexpected reddit url: %s", req.URL)
	}
	if req.Header.Get("Authorization") != "Bearer reddit-token" {
		t.Fatalf("expected bearer token header")
	}
	if req.Header.Get("User-Agent") != "postable/1.0" {
		t.Fatalf("expected default user agent, got %q", req.Header.Get("User-Agent"))
	}
	for _, expected := range []string{"sr=golang", "title=Meu+titulo", "kind=self", "text=Corpo+do+post"} {
		if !strings.Contains(req.Body, expected) {
			t.Fatalf("expected %q in form body, got %s", expected, req.Body)
		}
	}
}
