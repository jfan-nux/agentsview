package parser

import (
	"strings"
	"testing"
	"time"

	"github.com/wesm/agentsview/internal/testjsonl"
)

// --- JSON Builders (delegate to shared testjsonl package) ---

func claudeUserJSON(content, timestamp string, cwd ...string) string {
	return testjsonl.ClaudeUserJSON(content, timestamp, cwd...)
}

func claudeAssistantJSON(content any, timestamp string) string {
	return testjsonl.ClaudeAssistantJSON(content, timestamp)
}

func claudeSnapshotJSON(timestamp string) string {
	return testjsonl.ClaudeSnapshotJSON(timestamp)
}

func codexSessionMetaJSON(id, cwd, originator, timestamp string) string {
	return testjsonl.CodexSessionMetaJSON(id, cwd, originator, timestamp)
}

func codexMsgJSON(role, text, timestamp string) string {
	return testjsonl.CodexMsgJSON(role, text, timestamp)
}

// --- Data Generators ---

func generateLargeString(size int) string {
	return strings.Repeat("x", size)
}

// --- Assertions ---

func assertSessionMeta(t *testing.T, s *ParsedSession, wantID, wantProject string, wantAgent AgentType) {
	t.Helper()
	if s == nil {
		t.Fatal("session is nil")
	}
	if s.ID != wantID {
		t.Errorf("session ID = %q, want %q", s.ID, wantID)
	}
	if s.Project != wantProject {
		t.Errorf("project = %q, want %q", s.Project, wantProject)
	}
	if s.Agent != wantAgent {
		t.Errorf("agent = %q, want %q", s.Agent, wantAgent)
	}
}

func assertMessage(t *testing.T, m ParsedMessage, wantRole RoleType, wantContentSnippet string) {
	t.Helper()
	if m.Role != wantRole {
		t.Errorf("role = %q, want %q", m.Role, wantRole)
	}
	if wantContentSnippet != "" && !strings.Contains(m.Content, wantContentSnippet) {
		t.Errorf("content missing snippet %q, got %q", wantContentSnippet, m.Content)
	}
}

func assertMessageCount(t *testing.T, count, want int) {
	t.Helper()
	if count != want {
		t.Fatalf("message count = %d, want %d", count, want)
	}
}

func assertTimestamp(t *testing.T, got time.Time, want time.Time) {
	t.Helper()
	if !got.Equal(want) {
		t.Errorf("timestamp = %v, want %v", got, want)
	}
}

func joinJSONL(lines ...string) string {
	return testjsonl.JoinJSONL(lines...)
}
