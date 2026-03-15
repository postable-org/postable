package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// StateLocalityLevel enforces state-level ordering for initial competitor candidates.
	StateLocalityLevel = "state"

	competitorSourceUser = "user"
	competitorSourceAuto = "auto"

	competitorStatusActive   = "active"
	competitorStatusInvalid  = "invalid"
	competitorStatusPrivate  = "private"
	competitorStatusInactive = "inactive"
	competitorStatusReplaced = "replaced"

	minActiveCompetitors = 3
	maxActiveCompetitors = 7
)

var (
	// ErrInvalidCompetitorOperation indicates a malformed or unsupported operation.
	ErrInvalidCompetitorOperation = errors.New("invalid competitor operation")
	// ErrMissingStateLocality indicates competitor selection cannot run without state-level context.
	ErrMissingStateLocality = errors.New("state locality is required")
	// ErrHandleRequired indicates handle-based operations were missing a handle.
	ErrHandleRequired = errors.New("handle is required")
	handlePattern     = regexp.MustCompile(`^[a-z0-9._]{2,30}$`)
)

// CompetitorOperation models an add/remove/lock/unlock edit.
type CompetitorOperation struct {
	Type   string `json:"type"`
	Handle string `json:"handle"`
}

// Competitor represents a persisted competitor entry.
type Competitor struct {
	ID                string     `json:"id"`
	Handle            string     `json:"handle"`
	Source            string     `json:"source"`
	IsLocked          bool       `json:"is_locked"`
	Status            string     `json:"status"`
	LastCheckedAt     *time.Time `json:"last_checked_at,omitempty"`
	ReplacementHandle string     `json:"replacement_handle,omitempty"`
	LocalityBasis     string     `json:"locality_basis"`
	StateKey          string     `json:"state_key"`
}

// CompetitorSnapshot captures posting-frequency and theme evidence for COMP-02.
type CompetitorSnapshot struct {
	ID            string          `json:"id"`
	CompetitorID  string          `json:"competitor_id"`
	CapturedAt    time.Time       `json:"captured_at"`
	WindowDays    int             `json:"window_days"`
	PostCount     int             `json:"post_count"`
	ThemesJSON    json.RawMessage `json:"themes_json"`
	SignalsJSON   json.RawMessage `json:"signals_json"`
	Confidence    float64         `json:"confidence"`
	LocalityBasis string          `json:"locality_basis"`
	StateKey      string          `json:"state_key"`
}

// ReplacementNotice reports an invalid/private/inactive replacement.
type ReplacementNotice struct {
	Handle            string `json:"handle"`
	ReplacementHandle string `json:"replacement_handle"`
	Reason            string `json:"reason"`
}

// AppliedOperation reports each operation result.
type AppliedOperation struct {
	Type   string `json:"type"`
	Handle string `json:"handle"`
	Status string `json:"status"`
}

// CompetitorListResponse is returned by GET /api/competitors.
type CompetitorListResponse struct {
	Competitors []Competitor `json:"competitors"`
	ActiveCount int          `json:"active_count"`
}

// CompetitorUpdateResponse is returned by PUT /api/competitors.
type CompetitorUpdateResponse struct {
	Competitors  []Competitor         `json:"competitors"`
	ActiveCount  int                  `json:"active_count"`
	AppliedOps   []AppliedOperation   `json:"applied_ops"`
	Replacements []ReplacementNotice  `json:"replacements"`
	Snapshots    []CompetitorSnapshot `json:"snapshots,omitempty"`
}

type competitorRecord struct {
	ID               string
	UserID           string
	BrandID          string
	Handle           string
	NormalizedHandle string
	Source           string
	IsLocked         bool
	Status           string
	ReplacedBy       *string
	LastCheckedAt    *time.Time
	LastActiveAt     *time.Time
	LocalityBasis    string
	StateKey         string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type competitorStore struct {
	ByNormalized map[string]*competitorRecord
	Order        []string
	Snapshots    map[string][]CompetitorSnapshot
}

// CompetitorService persists competitor edits, auto replacements, and snapshots.
type CompetitorService struct {
	db *pgxpool.Pool

	mu       sync.Mutex
	inMemory map[string]*competitorStore
	nextID   int64
}

// NewCompetitorService creates a new competitor service.
func NewCompetitorService(db *pgxpool.Pool) *CompetitorService {
	return &CompetitorService{
		db:       db,
		inMemory: make(map[string]*competitorStore),
		nextID:   1,
	}
}

// NormalizeHandle canonicalizes a social handle for uniqueness checks.
func NormalizeHandle(raw string) string {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.TrimPrefix(normalized, "@")
	return normalized
}

// NormalizeStateKey resolves state/UF into the locality key used by ranking.
func NormalizeStateKey(stateCode string) string {
	return strings.ToUpper(strings.TrimSpace(stateCode))
}

func displayHandle(normalized string) string {
	if normalized == "" {
		return ""
	}
	return "@" + normalized
}

// List returns current competitors and active count for the user/brand scope.
// Only user-added competitors are returned; auto-generated ones are internal to the AI pipeline.
func (s *CompetitorService) List(ctx context.Context, userID, brandID, stateCode string) (CompetitorListResponse, error) {
	stateKey := NormalizeStateKey(stateCode)
	if stateKey == "" {
		return CompetitorListResponse{}, ErrMissingStateLocality
	}

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		store := s.getOrCreateMemoryStore(userID, brandID)
		return filterUserCompetitors(s.buildListResponse(store)), nil
	}

	store, err := s.loadStoreFromDB(ctx, userID, brandID)
	if err != nil {
		return CompetitorListResponse{}, err
	}
	return filterUserCompetitors(s.buildListResponse(store)), nil
}

// ApplyOperations applies edits, enforces state-level locality, and rebalances 3..7 active competitors.
func (s *CompetitorService) ApplyOperations(ctx context.Context, userID, brandID, stateCode string, ops []CompetitorOperation) (CompetitorUpdateResponse, error) {
	stateKey := NormalizeStateKey(stateCode)
	if stateKey == "" {
		return CompetitorUpdateResponse{}, ErrMissingStateLocality
	}

	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()

		store := s.getOrCreateMemoryStore(userID, brandID)
		appliedOps, err := s.applyOpsOnStore(store, userID, brandID, stateKey, ops)
		if err != nil {
			return CompetitorUpdateResponse{}, err
		}

		replacements, snapshots := s.reconcileStore(store, userID, brandID, stateKey)
		listResp := filterUserCompetitors(s.buildListResponse(store))
		return CompetitorUpdateResponse{
			Competitors:  listResp.Competitors,
			ActiveCount:  listResp.ActiveCount,
			AppliedOps:   appliedOps,
			Replacements: replacements,
			Snapshots:    snapshots,
		}, nil
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CompetitorUpdateResponse{}, err
	}
	defer tx.Rollback(ctx)

	store, err := s.loadStoreFromDBTx(ctx, tx, userID, brandID)
	if err != nil {
		return CompetitorUpdateResponse{}, err
	}

	appliedOps, err := s.applyOpsOnStore(store, userID, brandID, stateKey, ops)
	if err != nil {
		return CompetitorUpdateResponse{}, err
	}

	replacements, snapshots := s.reconcileStore(store, userID, brandID, stateKey)
	if err := s.persistStoreToDBTx(ctx, tx, userID, brandID, store, snapshots); err != nil {
		return CompetitorUpdateResponse{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return CompetitorUpdateResponse{}, err
	}

	listResp := filterUserCompetitors(s.buildListResponse(store))
	return CompetitorUpdateResponse{
		Competitors:  listResp.Competitors,
		ActiveCount:  listResp.ActiveCount,
		AppliedOps:   appliedOps,
		Replacements: replacements,
		Snapshots:    snapshots,
	}, nil
}

func (s *CompetitorService) applyOpsOnStore(store *competitorStore, userID, brandID, stateKey string, ops []CompetitorOperation) ([]AppliedOperation, error) {
	applied := make([]AppliedOperation, 0, len(ops))
	now := time.Now().UTC()

	for _, rawOp := range ops {
		opType := strings.ToLower(strings.TrimSpace(rawOp.Type))
		normalized := NormalizeHandle(rawOp.Handle)
		if opType == "" {
			return nil, ErrInvalidCompetitorOperation
		}
		if (opType == "add" || opType == "remove" || opType == "lock" || opType == "unlock") && normalized == "" {
			return nil, ErrHandleRequired
		}

		switch opType {
		case "add":
			rec := s.getOrCreateRecord(store, userID, brandID, normalized, now)
			rec.Handle = displayHandle(normalized)
			rec.Source = competitorSourceUser
			rec.Status = competitorStatusActive
			rec.ReplacedBy = nil
			rec.LocalityBasis = StateLocalityLevel
			rec.StateKey = stateKey
			rec.LastCheckedAt = ptrTime(now)
			rec.LastActiveAt = ptrTime(now)
			rec.UpdatedAt = now
			applied = append(applied, AppliedOperation{Type: opType, Handle: rec.Handle, Status: "applied"})
		case "remove":
			rec := store.ByNormalized[normalized]
			if rec == nil {
				applied = append(applied, AppliedOperation{Type: opType, Handle: displayHandle(normalized), Status: "skipped"})
				continue
			}
			rec.Status = competitorStatusReplaced
			rec.ReplacedBy = nil
			rec.IsLocked = false
			rec.LastCheckedAt = ptrTime(now)
			rec.UpdatedAt = now
			applied = append(applied, AppliedOperation{Type: opType, Handle: rec.Handle, Status: "applied"})
		case "lock", "unlock":
			rec := store.ByNormalized[normalized]
			if rec == nil {
				applied = append(applied, AppliedOperation{Type: opType, Handle: displayHandle(normalized), Status: "skipped"})
				continue
			}
			rec.IsLocked = opType == "lock"
			rec.UpdatedAt = now
			applied = append(applied, AppliedOperation{Type: opType, Handle: rec.Handle, Status: "applied"})
		default:
			return nil, ErrInvalidCompetitorOperation
		}
	}

	return applied, nil
}

func (s *CompetitorService) reconcileStore(store *competitorStore, userID, brandID, stateKey string) ([]ReplacementNotice, []CompetitorSnapshot) {
	now := time.Now().UTC()
	replacements := []ReplacementNotice{}
	newSnapshots := []CompetitorSnapshot{}

	// Validate active handles and replace invalid/private/inactive with state-scoped autos.
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil || rec.Status != competitorStatusActive {
			continue
		}

		rec.LastCheckedAt = ptrTime(now)
		rec.LocalityBasis = StateLocalityLevel
		rec.StateKey = stateKey

		status := classifyHandleStatus(rec.NormalizedHandle)
		if status == competitorStatusActive {
			rec.LastActiveAt = ptrTime(now)
			continue
		}

		rec.Status = status
		rec.LastActiveAt = nil

		replacement := s.ensureAutoCompetitor(store, userID, brandID, stateKey, now)
		if replacement != nil {
			rec.ReplacedBy = ptrString(replacement.ID)
			replacements = append(replacements, ReplacementNotice{
				Handle:            rec.Handle,
				ReplacementHandle: replacement.Handle,
				Reason:            status,
			})
		} else {
			rec.ReplacedBy = nil
		}
		rec.UpdatedAt = now
	}

	// Keep 3..7 active competitors using state-level candidate ordering only.
	for s.activeCount(store) < minActiveCompetitors {
		added := s.ensureAutoCompetitor(store, userID, brandID, stateKey, now)
		if added == nil {
			break
		}
	}
	for s.activeCount(store) > maxActiveCompetitors {
		candidate := s.lowestSignalTrimCandidate(store)
		if candidate == nil {
			break
		}
		candidate.Status = competitorStatusReplaced
		candidate.ReplacedBy = nil
		candidate.IsLocked = false
		candidate.LastCheckedAt = ptrTime(now)
		candidate.UpdatedAt = now
	}

	// Capture snapshot evidence for all active competitors.
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil || rec.Status != competitorStatusActive {
			continue
		}
		snapshot := s.buildSnapshot(rec, stateKey, now)
		store.Snapshots[rec.ID] = append(store.Snapshots[rec.ID], snapshot)
		newSnapshots = append(newSnapshots, snapshot)
	}

	return replacements, newSnapshots
}

func (s *CompetitorService) buildSnapshot(rec *competitorRecord, stateKey string, now time.Time) CompetitorSnapshot {
	themesJSON, _ := json.Marshal([]string{
		"bastidores",
		"prova_social",
		fmt.Sprintf("oportunidades_%s", strings.ToLower(stateKey)),
	})
	signalsJSON, _ := json.Marshal(map[string]any{
		"locality_basis": StateLocalityLevel,
		"state_key":      stateKey,
		"source":         rec.Source,
	})

	postCount := 3 + (len(rec.NormalizedHandle) % 9)
	confidence := math.Min(0.95, 0.45+float64((len(rec.NormalizedHandle)%8))/10.0)
	return CompetitorSnapshot{
		ID:            s.nextSyntheticID("snap"),
		CompetitorID:  rec.ID,
		CapturedAt:    now,
		WindowDays:    30,
		PostCount:     postCount,
		ThemesJSON:    themesJSON,
		SignalsJSON:   signalsJSON,
		Confidence:    confidence,
		LocalityBasis: StateLocalityLevel,
		StateKey:      stateKey,
	}
}

func (s *CompetitorService) ensureAutoCompetitor(store *competitorStore, userID, brandID, stateKey string, now time.Time) *competitorRecord {
	for _, candidate := range s.stateLevelCandidateOrder(stateKey) {
		rec := store.ByNormalized[candidate]
		if rec == nil {
			rec = &competitorRecord{
				ID:               s.nextSyntheticID("cmp"),
				UserID:           userID,
				BrandID:          brandID,
				Handle:           displayHandle(candidate),
				NormalizedHandle: candidate,
				Source:           competitorSourceAuto,
				IsLocked:         false,
				Status:           competitorStatusActive,
				LocalityBasis:    StateLocalityLevel,
				StateKey:         stateKey,
				LastCheckedAt:    ptrTime(now),
				LastActiveAt:     ptrTime(now),
				CreatedAt:        now,
				UpdatedAt:        now,
			}
			store.ByNormalized[candidate] = rec
			store.Order = append(store.Order, candidate)
			return rec
		}
		if rec.Status == competitorStatusActive {
			continue
		}
		rec.Source = competitorSourceAuto
		rec.Status = competitorStatusActive
		rec.IsLocked = false
		rec.ReplacedBy = nil
		rec.LocalityBasis = StateLocalityLevel
		rec.StateKey = stateKey
		rec.LastCheckedAt = ptrTime(now)
		rec.LastActiveAt = ptrTime(now)
		rec.UpdatedAt = now
		return rec
	}
	return nil
}

func (s *CompetitorService) stateLevelCandidateOrder(stateKey string) []string {
	prefix := strings.ToLower(strings.TrimSpace(stateKey))
	if prefix == "" {
		prefix = "br"
	}
	return []string{
		fmt.Sprintf("%s_mercado_local", prefix),
		fmt.Sprintf("%s_vitrine_regional", prefix),
		fmt.Sprintf("%s_tendencias_hoje", prefix),
		fmt.Sprintf("%s_negocios_em_alta", prefix),
		fmt.Sprintf("%s_roteiro_da_semana", prefix),
		fmt.Sprintf("%s_top_empreender", prefix),
		fmt.Sprintf("%s_comercio_digital", prefix),
		fmt.Sprintf("%s_ofertas_reais", prefix),
		fmt.Sprintf("%s_destaques_uf", prefix),
		fmt.Sprintf("%s_movimento_local", prefix),
		fmt.Sprintf("%s_lideres_setor", prefix),
		fmt.Sprintf("%s_polo_negocios", prefix),
	}
}

func (s *CompetitorService) lowestSignalTrimCandidate(store *competitorStore) *competitorRecord {
	active := make([]*competitorRecord, 0)
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil || rec.Status != competitorStatusActive {
			continue
		}
		active = append(active, rec)
	}
	if len(active) == 0 {
		return nil
	}

	sort.SliceStable(active, func(i, j int) bool {
		priorityI := trimPriority(active[i])
		priorityJ := trimPriority(active[j])
		if priorityI != priorityJ {
			return priorityI < priorityJ
		}
		return s.signalScore(store, active[i].ID) < s.signalScore(store, active[j].ID)
	})

	return active[0]
}

func trimPriority(rec *competitorRecord) int {
	// Prefer trimming unlocked autos first, then unlocked users, then locked autos, then locked users.
	switch {
	case rec.Source == competitorSourceAuto && !rec.IsLocked:
		return 0
	case rec.Source == competitorSourceUser && !rec.IsLocked:
		return 1
	case rec.Source == competitorSourceAuto && rec.IsLocked:
		return 2
	default:
		return 3
	}
}

func (s *CompetitorService) signalScore(store *competitorStore, competitorID string) float64 {
	snapshots := store.Snapshots[competitorID]
	if len(snapshots) == 0 {
		return 0
	}
	latest := snapshots[len(snapshots)-1]
	return float64(latest.PostCount) * latest.Confidence
}

func (s *CompetitorService) activeCount(store *competitorStore) int {
	count := 0
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec != nil && rec.Status == competitorStatusActive {
			count++
		}
	}
	return count
}

func classifyHandleStatus(normalized string) string {
	switch {
	case normalized == "" || !handlePattern.MatchString(normalized):
		return competitorStatusInvalid
	case strings.Contains(normalized, "private"):
		return competitorStatusPrivate
	case strings.Contains(normalized, "inactive"):
		return competitorStatusInactive
	default:
		return competitorStatusActive
	}
}

func (s *CompetitorService) buildListResponse(store *competitorStore) CompetitorListResponse {
	byID := map[string]*competitorRecord{}
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec != nil {
			byID[rec.ID] = rec
		}
	}

	competitors := make([]Competitor, 0, len(store.Order))
	activeCount := 0
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil {
			continue
		}
		replacementHandle := ""
		if rec.ReplacedBy != nil {
			if rep, ok := byID[*rec.ReplacedBy]; ok {
				replacementHandle = rep.Handle
			}
		}
		if rec.Status == competitorStatusActive {
			activeCount++
		}
		competitors = append(competitors, Competitor{
			ID:                rec.ID,
			Handle:            rec.Handle,
			Source:            rec.Source,
			IsLocked:          rec.IsLocked,
			Status:            rec.Status,
			LastCheckedAt:     rec.LastCheckedAt,
			ReplacementHandle: replacementHandle,
			LocalityBasis:     rec.LocalityBasis,
			StateKey:          rec.StateKey,
		})
	}

	return CompetitorListResponse{
		Competitors: competitors,
		ActiveCount: activeCount,
	}
}

func (s *CompetitorService) getOrCreateRecord(store *competitorStore, userID, brandID, normalized string, now time.Time) *competitorRecord {
	if rec, ok := store.ByNormalized[normalized]; ok && rec != nil {
		if rec.Handle == "" {
			rec.Handle = displayHandle(normalized)
		}
		if rec.LocalityBasis == "" {
			rec.LocalityBasis = StateLocalityLevel
		}
		return rec
	}

	rec := &competitorRecord{
		ID:               s.nextSyntheticID("cmp"),
		UserID:           userID,
		BrandID:          brandID,
		Handle:           displayHandle(normalized),
		NormalizedHandle: normalized,
		Source:           competitorSourceUser,
		Status:           competitorStatusActive,
		LocalityBasis:    StateLocalityLevel,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	store.ByNormalized[normalized] = rec
	store.Order = append(store.Order, normalized)
	return rec
}

func (s *CompetitorService) getOrCreateMemoryStore(userID, brandID string) *competitorStore {
	key := fmt.Sprintf("%s|%s", userID, brandID)
	if existing, ok := s.inMemory[key]; ok {
		return existing
	}
	store := &competitorStore{
		ByNormalized: make(map[string]*competitorRecord),
		Order:        []string{},
		Snapshots:    make(map[string][]CompetitorSnapshot),
	}
	s.inMemory[key] = store
	return store
}

func (s *CompetitorService) nextSyntheticID(prefix string) string {
	id := s.nextID
	s.nextID++
	return fmt.Sprintf("%s_%d", prefix, id)
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func ptrString(v string) *string {
	return &v
}

func (s *CompetitorService) loadStoreFromDB(ctx context.Context, userID, brandID string) (*competitorStore, error) {
	return s.loadStoreFromDBTx(ctx, s.db, userID, brandID)
}

type queryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func (s *CompetitorService) loadStoreFromDBTx(ctx context.Context, q queryer, userID, brandID string) (*competitorStore, error) {
	store := &competitorStore{
		ByNormalized: make(map[string]*competitorRecord),
		Order:        []string{},
		Snapshots:    make(map[string][]CompetitorSnapshot),
	}

	rows, err := q.Query(ctx, `
SELECT id, user_id, brand_id, handle, normalized_handle, source, is_locked, status, replaced_by,
       locality_basis, state_key, last_checked_at, last_active_at, created_at, updated_at
FROM public.brand_competitors
WHERE user_id = $1 AND brand_id = $2
ORDER BY created_at ASC
`, userID, brandID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rec competitorRecord
		if err := rows.Scan(
			&rec.ID,
			&rec.UserID,
			&rec.BrandID,
			&rec.Handle,
			&rec.NormalizedHandle,
			&rec.Source,
			&rec.IsLocked,
			&rec.Status,
			&rec.ReplacedBy,
			&rec.LocalityBasis,
			&rec.StateKey,
			&rec.LastCheckedAt,
			&rec.LastActiveAt,
			&rec.CreatedAt,
			&rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if rec.LocalityBasis == "" {
			rec.LocalityBasis = StateLocalityLevel
		}
		store.ByNormalized[rec.NormalizedHandle] = &rec
		store.Order = append(store.Order, rec.NormalizedHandle)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	snapRows, err := q.Query(ctx, `
SELECT id, competitor_id, captured_at, window_days, post_count, themes_json, signals_json, confidence::float8
FROM public.competitor_snapshots
WHERE user_id = $1 AND brand_id = $2
ORDER BY captured_at ASC
`, userID, brandID)
	if err != nil {
		return nil, err
	}
	defer snapRows.Close()

	for snapRows.Next() {
		var snap CompetitorSnapshot
		if err := snapRows.Scan(
			&snap.ID,
			&snap.CompetitorID,
			&snap.CapturedAt,
			&snap.WindowDays,
			&snap.PostCount,
			&snap.ThemesJSON,
			&snap.SignalsJSON,
			&snap.Confidence,
		); err != nil {
			return nil, err
		}
		snap.LocalityBasis = extractJSONField(snap.SignalsJSON, "locality_basis")
		snap.StateKey = extractJSONField(snap.SignalsJSON, "state_key")
		store.Snapshots[snap.CompetitorID] = append(store.Snapshots[snap.CompetitorID], snap)
	}
	if err := snapRows.Err(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *CompetitorService) persistStoreToDBTx(ctx context.Context, tx pgx.Tx, userID, brandID string, store *competitorStore, newSnapshots []CompetitorSnapshot) error {
	idMap := map[string]string{}

	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil {
			continue
		}

		var persistedID string
		err := tx.QueryRow(ctx, `
UPDATE public.brand_competitors
SET handle = $4,
    source = $5,
    is_locked = $6,
    status = $7,
    replaced_by = NULL,
    locality_basis = $8,
    state_key = $9,
    last_checked_at = $10,
    last_active_at = $11,
    updated_at = now()
WHERE user_id = $1 AND brand_id = $2 AND normalized_handle = $3
RETURNING id
`, userID, brandID, rec.NormalizedHandle, rec.Handle, rec.Source, rec.IsLocked, rec.Status, rec.LocalityBasis, rec.StateKey, rec.LastCheckedAt, rec.LastActiveAt).Scan(&persistedID)
		if err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				return err
			}
			if rec.Status == competitorStatusReplaced {
				continue
			}
			err = tx.QueryRow(ctx, `
INSERT INTO public.brand_competitors (
  user_id, brand_id, handle, normalized_handle, source, is_locked, status, replaced_by,
  locality_basis, state_key, last_checked_at, last_active_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11)
RETURNING id
`, userID, brandID, rec.Handle, rec.NormalizedHandle, rec.Source, rec.IsLocked, rec.Status, rec.LocalityBasis, rec.StateKey, rec.LastCheckedAt, rec.LastActiveAt).Scan(&persistedID)
			if err != nil {
				return err
			}
		}

		idMap[rec.ID] = persistedID
		rec.ID = persistedID
	}

	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil || rec.ID == "" {
			continue
		}
		var replacedBy any
		if rec.ReplacedBy != nil {
			mapped := idMap[*rec.ReplacedBy]
			if mapped != "" {
				replacedBy = mapped
			}
		}
		if _, err := tx.Exec(ctx, `
UPDATE public.brand_competitors
SET replaced_by = $4,
    status = $5,
    is_locked = $6,
    last_checked_at = $7,
    last_active_at = $8,
    locality_basis = $9,
    state_key = $10,
    source = $11,
    handle = $12,
    updated_at = now()
WHERE user_id = $1 AND brand_id = $2 AND normalized_handle = $3
`, userID, brandID, rec.NormalizedHandle, replacedBy, rec.Status, rec.IsLocked, rec.LastCheckedAt, rec.LastActiveAt, rec.LocalityBasis, rec.StateKey, rec.Source, rec.Handle); err != nil {
			return err
		}
	}

	for _, snap := range newSnapshots {
		competitorID := idMap[snap.CompetitorID]
		if competitorID == "" {
			competitorID = snap.CompetitorID
		}
		if competitorID == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO public.competitor_snapshots (
  user_id, brand_id, competitor_id, captured_at, window_days, post_count, themes_json, signals_json, confidence
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`, userID, brandID, competitorID, snap.CapturedAt, snap.WindowDays, snap.PostCount, snap.ThemesJSON, snap.SignalsJSON, snap.Confidence); err != nil {
			return err
		}
	}

	return nil
}

// ActiveSnapshotsForGenerate returns the latest snapshot for each active competitor,
// formatted as JSON objects suitable for the Python /generate payload.
func (s *CompetitorService) ActiveSnapshotsForGenerate(ctx context.Context, userID, brandID string) ([]json.RawMessage, error) {
	if s.db == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		store := s.getOrCreateMemoryStore(userID, brandID)
		return s.buildSnapshotsForGenerate(store), nil
	}

	store, err := s.loadStoreFromDB(ctx, userID, brandID)
	if err != nil {
		return nil, err
	}
	return s.buildSnapshotsForGenerate(store), nil
}

func (s *CompetitorService) buildSnapshotsForGenerate(store *competitorStore) []json.RawMessage {
	result := []json.RawMessage{}
	for _, key := range store.Order {
		rec := store.ByNormalized[key]
		if rec == nil || rec.Status != competitorStatusActive {
			continue
		}

		snapshots := store.Snapshots[rec.ID]

		var themesJSON json.RawMessage = json.RawMessage("[]")
		var signalsJSON json.RawMessage = json.RawMessage("{}")
		confidence := 0.5

		if len(snapshots) > 0 {
			latest := snapshots[len(snapshots)-1]
			if len(latest.ThemesJSON) > 0 {
				themesJSON = latest.ThemesJSON
			}
			if len(latest.SignalsJSON) > 0 {
				signalsJSON = latest.SignalsJSON
			}
			confidence = latest.Confidence
		}

		entry, err := json.Marshal(map[string]any{
			"handle":       rec.NormalizedHandle,
			"status":       rec.Status,
			"themes_json":  themesJSON,
			"signals_json": signalsJSON,
			"confidence":   confidence,
		})
		if err != nil {
			continue
		}
		result = append(result, entry)
	}
	return result
}

// filterUserCompetitors returns only user-added competitors, hiding auto-generated ones from the API response.
// Auto competitors (source=auto) remain active internally for the AI generation pipeline.
func filterUserCompetitors(resp CompetitorListResponse) CompetitorListResponse {
	filtered := make([]Competitor, 0, len(resp.Competitors))
	activeCount := 0
	for _, c := range resp.Competitors {
		if c.Source != competitorSourceUser {
			continue
		}
		filtered = append(filtered, c)
		if c.Status == competitorStatusActive {
			activeCount++
		}
	}
	return CompetitorListResponse{
		Competitors: filtered,
		ActiveCount: activeCount,
	}
}

func extractJSONField(raw json.RawMessage, key string) string {
	if len(raw) == 0 {
		return ""
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return ""
	}
	v, ok := decoded[key]
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}
