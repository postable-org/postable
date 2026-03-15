package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	ErrOAuthNotConfigured = errors.New("oauth is not configured for this network")
	ErrOAuthStateInvalid  = errors.New("oauth state is invalid or expired")
)

type SocialOAuthService struct {
	social      *SocialService
	httpClient  HTTPDoer
	apiBaseURL  string
	frontendURL string
	stateSecret []byte
}

type oauthStatePayload struct {
	UserID       string `json:"user_id"`
	Network      string `json:"network"`
	CodeVerifier string `json:"code_verifier,omitempty"`
	ExpiresAt    int64  `json:"expires_at"`
}

type oauthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
}

func NewSocialOAuthService(social *SocialService) *SocialOAuthService {
	apiBaseURL := strings.TrimRight(os.Getenv("API_BASE_URL"), "/")
	if apiBaseURL == "" {
		apiBaseURL = "http://localhost:8080"
	}
	frontendURL := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	stateSecret := os.Getenv("SOCIAL_OAUTH_STATE_SECRET")
	if stateSecret == "" {
		stateSecret = os.Getenv("SUPABASE_JWT_SECRET")
	}
	return &SocialOAuthService{
		social:      social,
		httpClient:  &http.Client{Timeout: 20 * time.Second},
		apiBaseURL:  apiBaseURL,
		frontendURL: frontendURL,
		stateSecret: []byte(stateSecret),
	}
}

func (s *SocialOAuthService) StartAuthorization(ctx context.Context, userID, network string) (string, error) {
	network = normalizeSocialNetwork(network)
	codeVerifier := ""
	if network == SocialNetworkX {
		var err error
		codeVerifier, err = generatePKCEVerifier()
		if err != nil {
			return "", err
		}
	}
	state, err := s.signStateWithVerifier(userID, network, codeVerifier)
	if err != nil {
		return "", err
	}

	switch network {
	case SocialNetworkLinkedIn:
		clientID := strings.TrimSpace(os.Getenv("LINKEDIN_CLIENT_ID"))
		if clientID == "" {
			return "", missingOAuthConfig("linkedin", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET")
		}
		scopes := []string{"openid", "profile", "email", "w_member_social"}
		if oauthBoolEnv("LINKEDIN_ENABLE_OFFLINE_ACCESS") {
			scopes = append(scopes, "offline_access")
		}
		query := url.Values{}
		query.Set("response_type", "code")
		query.Set("client_id", clientID)
		query.Set("redirect_uri", s.callbackURL(network))
		query.Set("state", state)
		query.Set("scope", strings.Join(scopes, " "))
		return "https://www.linkedin.com/oauth/v2/authorization?" + query.Encode(), nil
	case SocialNetworkFacebook, SocialNetworkInstagram:
		appID := os.Getenv("FACEBOOK_APP_ID")
		if appID == "" {
			return "", missingOAuthConfig("facebook", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET")
		}
		query := url.Values{}
		query.Set("client_id", appID)
		query.Set("redirect_uri", s.callbackURL(SocialNetworkFacebook))
		query.Set("state", state)
		query.Set("response_type", "code")
		query.Set("scope", strings.Join([]string{
			"pages_show_list",
			"pages_read_engagement",
			"pages_manage_posts",
			"instagram_basic",
			"instagram_content_publish",
			"business_management",
		}, ","))
		return "https://www.facebook.com/v25.0/dialog/oauth?" + query.Encode(), nil
	case SocialNetworkX:
		clientID := strings.TrimSpace(os.Getenv("X_CLIENT_ID"))
		if clientID == "" {
			return "", missingOAuthConfig("x", "X_CLIENT_ID")
		}
		query := url.Values{}
		query.Set("response_type", "code")
		query.Set("client_id", clientID)
		query.Set("redirect_uri", s.callbackURL(network))
		query.Set("scope", "tweet.read tweet.write users.read offline.access")
		query.Set("state", state)
		query.Set("code_challenge", pkceS256Challenge(codeVerifier))
		query.Set("code_challenge_method", "S256")
		return "https://x.com/i/oauth2/authorize?" + query.Encode(), nil
	default:
		return "", ErrInvalidNetwork
	}
}

func (s *SocialOAuthService) HandleCallback(ctx context.Context, network, code, state string) (string, error) {
	payload, err := s.verifyState(state)
	if err != nil {
		return s.errorRedirect(network, err.Error()), err
	}
	if payload.Network != normalizeSocialNetwork(network) && !(payload.Network == SocialNetworkInstagram && normalizeSocialNetwork(network) == SocialNetworkFacebook) {
		return s.errorRedirect(network, ErrOAuthStateInvalid.Error()), ErrOAuthStateInvalid
	}

	switch normalizeSocialNetwork(network) {
	case SocialNetworkLinkedIn:
		if err := s.completeLinkedInOAuth(ctx, payload.UserID, code); err != nil {
			return s.errorRedirect(network, err.Error()), err
		}
		return s.successRedirect(network, "LinkedIn conectado com sucesso"), nil
	case SocialNetworkFacebook:
		connected, err := s.completeMetaOAuth(ctx, payload.UserID, code)
		if err != nil {
			return s.errorRedirect(network, err.Error()), err
		}
		message := fmt.Sprintf("Meta conectado: %d conta(s)", connected)
		return s.successRedirect(SocialNetworkFacebook, message), nil
	case SocialNetworkX:
		if err := s.completeXOAuth(ctx, payload.UserID, code, payload.CodeVerifier); err != nil {
			return s.errorRedirect(network, err.Error()), err
		}
		return s.successRedirect(network, "X conectado com sucesso"), nil
	default:
		return s.errorRedirect(network, ErrInvalidNetwork.Error()), ErrInvalidNetwork
	}
}

func (s *SocialOAuthService) completeXOAuth(ctx context.Context, userID, code, codeVerifier string) error {
	clientID := strings.TrimSpace(os.Getenv("X_CLIENT_ID"))
	if clientID == "" {
		return missingOAuthConfig("x", "X_CLIENT_ID")
	}
	if strings.TrimSpace(codeVerifier) == "" {
		return ErrOAuthStateInvalid
	}

	extraHeaders := map[string]string{}
	if clientSecret := strings.TrimSpace(os.Getenv("X_CLIENT_SECRET")); clientSecret != "" {
		extraHeaders["Authorization"] = basicAuthValue(clientID, clientSecret)
	}

	form := url.Values{
		"grant_type":    []string{"authorization_code"},
		"code":          []string{code},
		"redirect_uri":  []string{s.callbackURL(SocialNetworkX)},
		"client_id":     []string{clientID},
		"code_verifier": []string{codeVerifier},
	}
	token, err := s.exchangeFormToken(ctx, "https://api.x.com/2/oauth2/token", form, extraHeaders)
	if err != nil {
		// Backward compatibility for environments that still use the legacy Twitter domain.
		token, err = s.exchangeFormToken(ctx, "https://api.twitter.com/2/oauth2/token", form, extraHeaders)
		if err != nil {
			return err
		}
	}

	profileURL := "https://api.x.com/2/users/me?user.fields=username,name,profile_image_url"
	raw, status, _, err := doJSONRequest(ctx, s.httpClient, http.MethodGet, profileURL, token.AccessToken, nil, nil)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		fallbackURL := "https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url"
		raw, status, _, err = doJSONRequest(ctx, s.httpClient, http.MethodGet, fallbackURL, token.AccessToken, nil, nil)
		if err != nil {
			return err
		}
		if status < 200 || status >= 300 {
			return fmt.Errorf("x user profile fetch failed: status=%d body=%s", status, string(raw))
		}
	}

	var profile struct {
		Data struct {
			ID              string `json:"id"`
			Name            string `json:"name"`
			Username        string `json:"username"`
			ProfileImageURL string `json:"profile_image_url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &profile); err != nil {
		return err
	}
	if strings.TrimSpace(profile.Data.ID) == "" {
		return errors.New("x profile response did not include user id")
	}

	accountName := strings.TrimSpace(profile.Data.Username)
	if accountName != "" {
		accountName = "@" + accountName
	} else if strings.TrimSpace(profile.Data.Name) != "" {
		accountName = profile.Data.Name
	} else {
		accountName = profile.Data.ID
	}

	expiresAt := expiresAtPtr(token.ExpiresIn)
	metaMap := map[string]string{
		"provider": "x",
		"scope":    token.Scope,
	}
	if avatarURL := strings.TrimSpace(profile.Data.ProfileImageURL); avatarURL != "" {
		metaMap["avatar_url"] = avatarURL
	}
	metadata, _ := json.Marshal(metaMap)
	_, err = s.social.UpsertConnection(ctx, userID, SocialConnectionInput{
		Network:        SocialNetworkX,
		AccountID:      profile.Data.ID,
		AccountName:    accountName,
		AccessToken:    token.AccessToken,
		RefreshToken:   token.RefreshToken,
		TokenExpiresAt: expiresAt,
		MetadataJSON:   metadata,
	})
	return err
}

func (s *SocialOAuthService) completeLinkedInOAuth(ctx context.Context, userID, code string) error {
	clientID := strings.TrimSpace(os.Getenv("LINKEDIN_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("LINKEDIN_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		return missingOAuthConfig("linkedin", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET")
	}
	token, err := s.exchangeFormToken(ctx, "https://www.linkedin.com/oauth/v2/accessToken", url.Values{
		"grant_type":    []string{"authorization_code"},
		"code":          []string{code},
		"redirect_uri":  []string{s.callbackURL(SocialNetworkLinkedIn)},
		"client_id":     []string{clientID},
		"client_secret": []string{clientSecret},
	}, nil)
	if err != nil {
		return err
	}

	raw, status, _, err := doJSONRequest(ctx, s.httpClient, http.MethodGet, "https://api.linkedin.com/v2/userinfo", token.AccessToken, nil, nil)
	if err != nil {
		return err
	}
	if status < 200 || status >= 300 {
		return fmt.Errorf("linkedin userinfo failed: status=%d body=%s", status, string(raw))
	}
	var profile struct {
		Sub     string `json:"sub"`
		Name    string `json:"name"`
		Email   string `json:"email"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(raw, &profile); err != nil {
		return err
	}
	expiresAt := expiresAtPtr(token.ExpiresIn)
	metaMap := map[string]string{"email": profile.Email}
	if avatarURL := strings.TrimSpace(profile.Picture); avatarURL != "" {
		metaMap["avatar_url"] = avatarURL
	}
	metadata, _ := json.Marshal(metaMap)
	_, err = s.social.UpsertConnection(ctx, userID, SocialConnectionInput{
		Network:        SocialNetworkLinkedIn,
		AccountID:      "urn:li:person:" + profile.Sub,
		AccountName:    profile.Name,
		AccessToken:    token.AccessToken,
		RefreshToken:   token.RefreshToken,
		TokenExpiresAt: expiresAt,
		MetadataJSON:   metadata,
	})
	return err
}

func (s *SocialOAuthService) completeRedditOAuth(ctx context.Context, userID, code string) error {
	clientID := os.Getenv("REDDIT_CLIENT_ID")
	clientSecret := os.Getenv("REDDIT_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return ErrOAuthNotConfigured
	}
	basic := basicAuthValue(clientID, clientSecret)
	token, err := s.exchangeFormToken(ctx, "https://www.reddit.com/api/v1/access_token", url.Values{
		"grant_type":   []string{"authorization_code"},
		"code":         []string{code},
		"redirect_uri": []string{s.callbackURL(SocialNetworkReddit)},
	}, map[string]string{
		"Authorization": basic,
		"User-Agent":    redditOAuthUserAgent(),
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://oauth.reddit.com/api/v1/me", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("User-Agent", redditOAuthUserAgent())
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("reddit me failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	var profile struct {
		Name string `json:"name"`
		ID   string `json:"id"`
	}
	if err := json.Unmarshal(raw, &profile); err != nil {
		return err
	}
	expiresAt := expiresAtPtr(token.ExpiresIn)
	metadata, _ := json.Marshal(map[string]string{"user_agent": redditOAuthUserAgent()})
	_, err = s.social.UpsertConnection(ctx, userID, SocialConnectionInput{
		Network:        SocialNetworkReddit,
		AccountID:      profile.ID,
		AccountName:    profile.Name,
		AccessToken:    token.AccessToken,
		RefreshToken:   token.RefreshToken,
		TokenExpiresAt: expiresAt,
		MetadataJSON:   metadata,
	})
	return err
}

func (s *SocialOAuthService) completeMetaOAuth(ctx context.Context, userID, code string) (int, error) {
	appID := os.Getenv("FACEBOOK_APP_ID")
	appSecret := os.Getenv("FACEBOOK_APP_SECRET")
	if appID == "" || appSecret == "" {
		return 0, ErrOAuthNotConfigured
	}
	query := url.Values{}
	query.Set("client_id", appID)
	query.Set("client_secret", appSecret)
	query.Set("redirect_uri", s.callbackURL(SocialNetworkFacebook))
	query.Set("code", code)
	raw, status, _, err := doJSONRequest(ctx, s.httpClient, http.MethodGet, "https://graph.facebook.com/v25.0/oauth/access_token?"+query.Encode(), "", nil, nil)
	if err != nil {
		return 0, err
	}
	if status < 200 || status >= 300 {
		return 0, fmt.Errorf("facebook token exchange failed: status=%d body=%s", status, string(raw))
	}
	var token oauthTokenResponse
	if err := json.Unmarshal(raw, &token); err != nil {
		return 0, err
	}

	pagesURL := "https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username},connected_instagram_account{id,username}"
	raw, status, _, err = doJSONRequest(ctx, s.httpClient, http.MethodGet, pagesURL, token.AccessToken, nil, nil)
	if err != nil {
		return 0, err
	}
	if status < 200 || status >= 300 {
		return 0, fmt.Errorf("facebook accounts fetch failed: status=%d body=%s", status, string(raw))
	}
	var pages struct {
		Data []struct {
			ID                       string `json:"id"`
			Name                     string `json:"name"`
			AccessToken              string `json:"access_token"`
			InstagramBusinessAccount *struct {
				ID       string `json:"id"`
				Username string `json:"username"`
			} `json:"instagram_business_account"`
			ConnectedInstagramAccount *struct {
				ID       string `json:"id"`
				Username string `json:"username"`
			} `json:"connected_instagram_account"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &pages); err != nil {
		return 0, err
	}
	connected := 0
	for _, page := range pages.Data {
		pageMeta, _ := json.Marshal(map[string]string{
			"source":     "facebook_page",
			"avatar_url": "https://graph.facebook.com/v25.0/" + page.ID + "/picture?type=normal",
		})
		_, err := s.social.UpsertConnection(ctx, userID, SocialConnectionInput{
			Network:      SocialNetworkFacebook,
			AccountID:    page.ID,
			AccountName:  page.Name,
			AccessToken:  page.AccessToken,
			MetadataJSON: pageMeta,
		})
		if err != nil {
			return connected, err
		}
		connected++
		ig := page.InstagramBusinessAccount
		if ig == nil {
			ig = page.ConnectedInstagramAccount
		}
		if ig != nil && ig.ID != "" {
			avatarURL := ""
			igProfileURL := "https://graph.facebook.com/v25.0/" + ig.ID + "?fields=profile_picture_url"
			igRaw, igStatus, _, igErr := doJSONRequest(ctx, s.httpClient, http.MethodGet, igProfileURL, page.AccessToken, nil, nil)
			if igErr == nil && igStatus >= 200 && igStatus < 300 {
				var igProfile struct {
					ProfilePictureURL string `json:"profile_picture_url"`
				}
				if err := json.Unmarshal(igRaw, &igProfile); err == nil {
					avatarURL = strings.TrimSpace(igProfile.ProfilePictureURL)
				}
			}

			igMeta, _ := json.Marshal(map[string]string{
				"page_id":    page.ID,
				"page_name":  page.Name,
				"avatar_url": avatarURL,
			})
			_, err := s.social.UpsertConnection(ctx, userID, SocialConnectionInput{
				Network:      SocialNetworkInstagram,
				AccountID:    ig.ID,
				AccountName:  ig.Username,
				AccessToken:  page.AccessToken,
				MetadataJSON: igMeta,
			})
			if err != nil {
				return connected, err
			}
			connected++
		}
	}
	if connected == 0 {
		return 0, errors.New("nenhuma página ou conta instagram elegível foi encontrada")
	}
	return connected, nil
}

func (s *SocialOAuthService) exchangeFormToken(ctx context.Context, endpoint string, form url.Values, extraHeaders map[string]string) (*oauthTokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var token oauthTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := json.Marshal(token)
		return nil, fmt.Errorf("token exchange failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	if token.AccessToken == "" {
		return nil, errors.New("token exchange returned empty access_token")
	}
	return &token, nil
}

func (s *SocialOAuthService) signState(userID, network string) (string, error) {
	return s.signStateWithVerifier(userID, network, "")
}

func (s *SocialOAuthService) signStateWithVerifier(userID, network, codeVerifier string) (string, error) {
	if len(s.stateSecret) == 0 {
		return "", missingOAuthConfig("oauth", "SOCIAL_OAUTH_STATE_SECRET")
	}
	payload := oauthStatePayload{
		UserID:       userID,
		Network:      normalizeSocialNetwork(network),
		CodeVerifier: codeVerifier,
		ExpiresAt:    time.Now().Add(10 * time.Minute).Unix(),
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, s.stateSecret)
	mac.Write(encoded)
	sig := mac.Sum(nil)
	return base64.RawURLEncoding.EncodeToString(encoded) + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func missingOAuthConfig(network string, envVars ...string) error {
	if len(envVars) == 0 {
		return ErrOAuthNotConfigured
	}
	return fmt.Errorf("%s oauth is not configured; set %s: %w", network, strings.Join(envVars, ", "), ErrOAuthNotConfigured)
}

func (s *SocialOAuthService) verifyState(state string) (*oauthStatePayload, error) {
	parts := strings.Split(state, ".")
	if len(parts) != 2 {
		return nil, ErrOAuthStateInvalid
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, ErrOAuthStateInvalid
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrOAuthStateInvalid
	}
	mac := hmac.New(sha256.New, s.stateSecret)
	mac.Write(payloadBytes)
	if !hmac.Equal(sigBytes, mac.Sum(nil)) {
		return nil, ErrOAuthStateInvalid
	}
	var payload oauthStatePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, ErrOAuthStateInvalid
	}
	if payload.ExpiresAt < time.Now().Unix() {
		return nil, ErrOAuthStateInvalid
	}
	return &payload, nil
}

func (s *SocialOAuthService) callbackURL(network string) string {
	network = normalizeSocialNetwork(network)
	if network == SocialNetworkInstagram {
		network = SocialNetworkFacebook
	}
	override := strings.TrimSpace(os.Getenv(strings.ToUpper(network) + "_REDIRECT_URI"))
	if override != "" {
		return override
	}
	return s.apiBaseURL + "/api/social/oauth/" + network + "/callback"
}

func (s *SocialOAuthService) successRedirect(network, message string) string {
	query := url.Values{}
	query.Set("network", network)
	query.Set("status", "success")
	query.Set("message", message)
	return s.frontendURL + "/social?" + query.Encode()
}

func (s *SocialOAuthService) errorRedirect(network, message string) string {
	query := url.Values{}
	query.Set("network", network)
	query.Set("status", "error")
	query.Set("message", message)
	return s.frontendURL + "/social?" + query.Encode()
}

func (s *SocialOAuthService) FrontendRedirect(network, status, message string) string {
	if strings.EqualFold(strings.TrimSpace(status), "success") {
		return s.successRedirect(network, message)
	}
	return s.errorRedirect(network, message)
}

// RefreshTokenIfNeeded implements TokenRefresher. For X, if the access token is
// expired (or expires within 5 minutes) and a refresh token is available, it
// exchanges the refresh token for a new access token and updates the DB + conn
// in-place. Other networks are silently skipped (LinkedIn tokens last 60 days;
// Meta issues long-lived tokens separately).
func (s *SocialOAuthService) RefreshTokenIfNeeded(ctx context.Context, conn *SocialConnection) error {
	if conn.RefreshToken == "" {
		return nil
	}
	// Skip if token is still valid for at least 5 more minutes.
	if conn.TokenExpiresAt != nil && conn.TokenExpiresAt.After(time.Now().Add(5*time.Minute)) {
		return nil
	}
	switch conn.Network {
	case SocialNetworkX:
		return s.refreshXToken(ctx, conn)
	case SocialNetworkLinkedIn:
		return s.refreshLinkedInToken(ctx, conn)
	}
	return nil
}

func (s *SocialOAuthService) refreshLinkedInToken(ctx context.Context, conn *SocialConnection) error {
	clientID := strings.TrimSpace(os.Getenv("LINKEDIN_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("LINKEDIN_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		return missingOAuthConfig("linkedin", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET")
	}

	token, err := s.exchangeFormToken(ctx, "https://www.linkedin.com/oauth/v2/accessToken", url.Values{
		"grant_type":    []string{"refresh_token"},
		"refresh_token": []string{conn.RefreshToken},
		"client_id":     []string{clientID},
		"client_secret": []string{clientSecret},
	}, nil)
	if err != nil {
		return fmt.Errorf("linkedin token refresh failed: %w", err)
	}

	newRefreshToken := conn.RefreshToken
	if token.RefreshToken != "" {
		newRefreshToken = token.RefreshToken
	}
	expiresAt := expiresAtPtr(token.ExpiresIn)

	_, err = s.social.UpsertConnection(ctx, conn.UserID, SocialConnectionInput{
		Network:        conn.Network,
		AccountID:      conn.AccountID,
		AccountName:    conn.AccountName,
		AccessToken:    token.AccessToken,
		RefreshToken:   newRefreshToken,
		TokenExpiresAt: expiresAt,
		MetadataJSON:   conn.MetadataJSON,
	})
	if err != nil {
		return fmt.Errorf("linkedin token refresh: failed to persist new token: %w", err)
	}

	conn.AccessToken = token.AccessToken
	conn.RefreshToken = newRefreshToken
	conn.TokenExpiresAt = expiresAt
	return nil
}

func (s *SocialOAuthService) refreshXToken(ctx context.Context, conn *SocialConnection) error {
	clientID := strings.TrimSpace(os.Getenv("X_CLIENT_ID"))
	if clientID == "" {
		return missingOAuthConfig("x", "X_CLIENT_ID")
	}

	extraHeaders := map[string]string{}
	if clientSecret := strings.TrimSpace(os.Getenv("X_CLIENT_SECRET")); clientSecret != "" {
		extraHeaders["Authorization"] = basicAuthValue(clientID, clientSecret)
	}

	form := url.Values{
		"grant_type":    []string{"refresh_token"},
		"refresh_token": []string{conn.RefreshToken},
		"client_id":     []string{clientID},
	}

	token, err := s.exchangeFormToken(ctx, "https://api.x.com/2/oauth2/token", form, extraHeaders)
	if err != nil {
		token, err = s.exchangeFormToken(ctx, "https://api.twitter.com/2/oauth2/token", form, extraHeaders)
		if err != nil {
			return fmt.Errorf("x token refresh failed: %w", err)
		}
	}

	newRefreshToken := conn.RefreshToken
	if token.RefreshToken != "" {
		newRefreshToken = token.RefreshToken
	}
	expiresAt := expiresAtPtr(token.ExpiresIn)

	_, err = s.social.UpsertConnection(ctx, conn.UserID, SocialConnectionInput{
		Network:        conn.Network,
		AccountID:      conn.AccountID,
		AccountName:    conn.AccountName,
		AccessToken:    token.AccessToken,
		RefreshToken:   newRefreshToken,
		TokenExpiresAt: expiresAt,
		MetadataJSON:   conn.MetadataJSON,
	})
	if err != nil {
		return fmt.Errorf("x token refresh: failed to persist new token: %w", err)
	}

	conn.AccessToken = token.AccessToken
	conn.RefreshToken = newRefreshToken
	conn.TokenExpiresAt = expiresAt
	return nil
}

func expiresAtPtr(expiresIn int64) *time.Time {
	if expiresIn <= 0 {
		return nil
	}
	t := time.Now().Add(time.Duration(expiresIn) * time.Second).UTC()
	return &t
}

func basicAuthValue(username, password string) string {
	plain := username + ":" + password
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(plain))
}

func redditOAuthUserAgent() string {
	value := strings.TrimSpace(os.Getenv("REDDIT_USER_AGENT"))
	if value != "" {
		return value
	}
	return "postable/1.0"
}

func oauthBoolEnv(key string) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return false
	}
	parsed, _ := strconv.ParseBool(v)
	return parsed
}

func generatePKCEVerifier() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func pkceS256Challenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
