package update

import (
	"archive/tar"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
)

func TestIsDevBuildVersion(t *testing.T) {
	tests := []struct {
		version string
		want    bool
	}{
		{"dev", true},
		{"unknown", true},
		{"", true},
		{"0.1.0", false},
		{"v0.1.0", false},
		{"0.1.0-2-gabcdef", true},
		{"v0.1.0-2-gabcdef-dirty", true},
		{"0.1.0-rc1", false},
	}
	for _, tt := range tests {
		t.Run(tt.version, func(t *testing.T) {
			got := IsDevBuildVersion(tt.version)
			if got != tt.want {
				t.Errorf(
					"IsDevBuildVersion(%q) = %v, want %v",
					tt.version, got, tt.want,
				)
			}
		})
	}
}

func TestIsNewer(t *testing.T) {
	tests := []struct {
		v1, v2 string
		want   bool
	}{
		{"0.2.0", "0.1.0", true},
		{"0.1.0", "0.2.0", false},
		{"0.1.0", "0.1.0", false},
		{"1.0.0", "0.9.9", true},
		{"0.1.0-rc2", "0.1.0-rc1", true},
		{"0.1.0", "0.1.0-rc1", true},
	}
	for _, tt := range tests {
		name := tt.v1 + "_vs_" + tt.v2
		t.Run(name, func(t *testing.T) {
			got := isNewer(tt.v1, tt.v2)
			if got != tt.want {
				t.Errorf(
					"isNewer(%q, %q) = %v, want %v",
					tt.v1, tt.v2, got, tt.want,
				)
			}
		})
	}
}

func TestExtractChecksum(t *testing.T) {
	body := `abc123  some_other_file.tar.gz
deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef  agentsview_0.1.0_linux_amd64.tar.gz
fff000  yet_another.zip`

	got := extractChecksum(
		body, "agentsview_0.1.0_linux_amd64.tar.gz",
	)
	want := "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}

	got = extractChecksum(body, "nonexistent.tar.gz")
	if got != "" {
		t.Errorf("expected empty for missing asset, got %q", got)
	}
}

func TestSanitizePath(t *testing.T) {
	destDir := t.TempDir()

	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{"normal", "agentsview", false},
		{"subdir", "dir/agentsview", false},
		{"absolute", "/etc/passwd", true},
		{"traversal", "../../../etc/passwd", true},
		{"hidden_traversal", "foo/../../etc/passwd", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := sanitizePath(destDir, tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf(
					"sanitizePath(%q) error = %v, wantErr %v",
					tt.path, err, tt.wantErr,
				)
			}
		})
	}
}

func TestExtractTarGz(t *testing.T) {
	srcDir := t.TempDir()
	destDir := t.TempDir()

	// Create a test tar.gz with a dummy binary
	archivePath := filepath.Join(srcDir, "test.tar.gz")
	createTestTarGz(t, archivePath, "agentsview", "binary-content")

	if err := extractTarGz(archivePath, destDir); err != nil {
		t.Fatalf("extractTarGz: %v", err)
	}

	content, err := os.ReadFile(
		filepath.Join(destDir, "agentsview"),
	)
	if err != nil {
		t.Fatalf("read extracted file: %v", err)
	}
	if string(content) != "binary-content" {
		t.Errorf("got %q, want %q", content, "binary-content")
	}
}

func TestInstallBinaryTo(t *testing.T) {
	srcDir := t.TempDir()
	dstDir := t.TempDir()

	srcPath := filepath.Join(srcDir, "agentsview")
	dstPath := filepath.Join(dstDir, "agentsview")
	if err := os.WriteFile(
		srcPath, []byte("new-binary"), 0o755,
	); err != nil {
		t.Fatal(err)
	}

	// Install to empty destination
	if err := installBinaryTo(srcPath, dstPath); err != nil {
		t.Fatalf("installBinaryTo: %v", err)
	}

	got, err := os.ReadFile(dstPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "new-binary" {
		t.Errorf("got %q, want %q", got, "new-binary")
	}

	// Install over existing (replacement)
	if err := os.WriteFile(
		srcPath, []byte("newer-binary"), 0o755,
	); err != nil {
		t.Fatal(err)
	}
	if err := installBinaryTo(srcPath, dstPath); err != nil {
		t.Fatalf("installBinaryTo (replace): %v", err)
	}

	got, err = os.ReadFile(dstPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "newer-binary" {
		t.Errorf("got %q, want %q", got, "newer-binary")
	}

	// Backup should be cleaned up
	if _, err := os.Stat(dstPath + ".old"); !os.IsNotExist(err) {
		t.Error("backup .old file should be removed")
	}
}

func TestFormatSize(t *testing.T) {
	tests := []struct {
		bytes int64
		want  string
	}{
		{0, "0 B"},
		{500, "500 B"},
		{1024, "1.0 KB"},
		{1536, "1.5 KB"},
		{1048576, "1.0 MB"},
		{10485760, "10.0 MB"},
	}
	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := FormatSize(tt.bytes)
			if got != tt.want {
				t.Errorf(
					"FormatSize(%d) = %q, want %q",
					tt.bytes, got, tt.want,
				)
			}
		})
	}
}

func TestCacheRoundtrip(t *testing.T) {
	dir := t.TempDir()

	saveCache("v1.2.3", dir)

	cached, err := loadCache(dir)
	if err != nil {
		t.Fatalf("loadCache: %v", err)
	}
	if cached.Version != "v1.2.3" {
		t.Errorf("got version %q, want %q", cached.Version, "v1.2.3")
	}
}

func TestNormalizeSemver(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"0.1.0", "v0.1.0"},
		{"v0.1.0", "v0.1.0"},
		{"0.1.0-rc1", "v0.1.0-rc.1"},
		{"0.1.0-2-gabcdef", "v0.1.0"},
		{"0.1.0-2-gabcdef-dirty", "v0.1.0"},
		{"1.0.0-beta10", "v1.0.0-beta.10"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := normalizeSemver(tt.input)
			if got != tt.want {
				t.Errorf(
					"normalizeSemver(%q) = %q, want %q",
					tt.input, got, tt.want,
				)
			}
		})
	}
}

func createTestTarGz(
	t *testing.T,
	archivePath, fileName, content string,
) {
	t.Helper()
	f, err := os.Create(archivePath)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	gw := gzip.NewWriter(f)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	data := []byte(content)
	header := &tar.Header{
		Name: fileName,
		Mode: 0o755,
		Size: int64(len(data)),
	}
	if err := tw.WriteHeader(header); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write(data); err != nil {
		t.Fatal(err)
	}
}
