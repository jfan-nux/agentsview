// Package testjsonl provides shared JSONL fixture builders for
// Claude and Codex session test data. Used by both parser and
// sync test packages.
package testjsonl

import (
	"encoding/json"
	"strings"
)

// ClaudeUserJSON returns a Claude user message as a JSON string.
func ClaudeUserJSON(
	content, timestamp string, cwd ...string,
) string {
	m := map[string]any{
		"type":      "user",
		"timestamp": timestamp,
		"message": map[string]any{
			"content": content,
		},
	}
	if len(cwd) > 0 {
		m["cwd"] = cwd[0]
	}
	return mustMarshal(m)
}

// ClaudeAssistantJSON returns a Claude assistant message as a
// JSON string.
func ClaudeAssistantJSON(content any, timestamp string) string {
	m := map[string]any{
		"type":      "assistant",
		"timestamp": timestamp,
		"message": map[string]any{
			"content": content,
		},
	}
	return mustMarshal(m)
}

// ClaudeSnapshotJSON returns a Claude snapshot message as a
// JSON string.
func ClaudeSnapshotJSON(timestamp string) string {
	m := map[string]any{
		"type": "user",
		"snapshot": map[string]any{
			"timestamp": timestamp,
		},
		"message": map[string]any{
			"content": "hello",
		},
	}
	return mustMarshal(m)
}

// CodexSessionMetaJSON returns a Codex session_meta message as
// a JSON string.
func CodexSessionMetaJSON(
	id, cwd, originator, timestamp string,
) string {
	m := map[string]any{
		"type":      "session_meta",
		"timestamp": timestamp,
		"payload": map[string]any{
			"id":         id,
			"cwd":        cwd,
			"originator": originator,
		},
	}
	return mustMarshal(m)
}

// CodexMsgJSON returns a Codex response_item message as a JSON
// string.
func CodexMsgJSON(role, text, timestamp string) string {
	contentType := "output_text"
	if role == "user" {
		contentType = "input_text"
	}
	m := map[string]any{
		"type":      "response_item",
		"timestamp": timestamp,
		"payload": map[string]any{
			"role": role,
			"content": []map[string]string{
				{
					"type": contentType,
					"text": text,
				},
			},
		},
	}
	return mustMarshal(m)
}

// JoinJSONL joins JSON lines with newlines and appends a
// trailing newline.
func JoinJSONL(lines ...string) string {
	return strings.Join(lines, "\n") + "\n"
}

// SessionBuilder constructs JSONL session content using a
// fluent API.
type SessionBuilder struct {
	lines []string
}

// NewSessionBuilder returns a new empty SessionBuilder.
func NewSessionBuilder() *SessionBuilder {
	return &SessionBuilder{}
}

// AddClaudeUser appends a Claude user message line.
func (b *SessionBuilder) AddClaudeUser(
	timestamp, content string, cwd ...string,
) *SessionBuilder {
	b.lines = append(b.lines, ClaudeUserJSON(content, timestamp, cwd...))
	return b
}

// AddClaudeAssistant appends a Claude assistant message line.
func (b *SessionBuilder) AddClaudeAssistant(
	timestamp, text string,
) *SessionBuilder {
	b.lines = append(b.lines, ClaudeAssistantJSON(
		[]map[string]string{{"type": "text", "text": text}},
		timestamp,
	))
	return b
}

// AddCodexMeta appends a Codex session_meta line.
func (b *SessionBuilder) AddCodexMeta(
	timestamp, id, cwd, originator string,
) *SessionBuilder {
	b.lines = append(
		b.lines,
		CodexSessionMetaJSON(id, cwd, originator, timestamp),
	)
	return b
}

// AddCodexMessage appends a Codex response_item line.
func (b *SessionBuilder) AddCodexMessage(
	timestamp, role, text string,
) *SessionBuilder {
	b.lines = append(b.lines, CodexMsgJSON(role, text, timestamp))
	return b
}

// AddRaw appends an arbitrary raw line.
func (b *SessionBuilder) AddRaw(line string) *SessionBuilder {
	b.lines = append(b.lines, line)
	return b
}

// String returns the JSONL content with a trailing newline.
func (b *SessionBuilder) String() string {
	return strings.Join(b.lines, "\n") + "\n"
}

// StringNoTrailingNewline returns the JSONL content without a
// trailing newline.
func (b *SessionBuilder) StringNoTrailingNewline() string {
	return strings.Join(b.lines, "\n")
}

func mustMarshal(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}
