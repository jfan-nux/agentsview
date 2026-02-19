package sync_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/wesm/agentsview/internal/db"
	"github.com/wesm/agentsview/internal/sync"
	"github.com/wesm/agentsview/internal/testjsonl"
)

// NewSessionBuilder returns a shared JSONL session builder.
func NewSessionBuilder() *testjsonl.SessionBuilder {
	return testjsonl.NewSessionBuilder()
}

// --- Assertion Helpers ---

func assertSessionState(t *testing.T, database *db.DB, sessionID string, check func(*db.Session)) {
	t.Helper()
	sess, err := database.GetSession(context.Background(), sessionID)
	if err != nil {
		t.Fatalf("GetSession(%q): %v", sessionID, err)
	}
	if sess == nil {
		t.Fatalf("Session %q not found", sessionID)
	}
	if check != nil {
		check(sess)
	}
}

func runSyncAndAssert(t *testing.T, engine *sync.Engine, wantSynced, wantSkipped int) sync.SyncStats {
	t.Helper()
	stats := engine.SyncAll(nil)
	if stats.Synced != wantSynced {
		t.Fatalf("Synced: got %d, want %d", stats.Synced, wantSynced)
	}
	if stats.Skipped != wantSkipped {
		t.Fatalf("Skipped: got %d, want %d", stats.Skipped, wantSkipped)
	}
	return stats
}

func clearSessionHash(t *testing.T, database *db.DB, sessionID string) {
	t.Helper()
	err := database.Update(func(tx *sql.Tx) error {
		_, err := tx.Exec("UPDATE sessions SET file_hash = NULL WHERE id = ?", sessionID)
		return err
	})
	if err != nil {
		t.Fatalf("failed to clear hash for %s: %v", sessionID, err)
	}
}
