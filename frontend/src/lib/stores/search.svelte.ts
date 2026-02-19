import * as api from "../api/client.js";
import type { SearchResult } from "../api/types.js";

class SearchStore {
  query: string = $state("");
  project: string = $state("");
  results: SearchResult[] = $state([]);
  isSearching: boolean = $state(false);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private version: number = 0;

  search(q: string, project?: string) {
    this.query = q;
    if (project !== undefined) this.project = project;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Invalidate any in-flight request immediately
    const v = ++this.version;

    if (!q.trim()) {
      this.results = [];
      this.isSearching = false;
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.executeSearch(q, this.project, v);
    }, 300);
  }

  clear() {
    this.query = "";
    this.results = [];
    this.isSearching = false;
    ++this.version;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private async executeSearch(
    q: string, project: string, v: number,
  ) {
    if (this.version !== v) return;
    this.isSearching = true;
    try {
      const res = await api.search(q, {
        project: project || undefined,
        limit: 30,
      });
      if (this.version !== v) return;
      this.results = res.results;
    } catch {
      if (this.version !== v) return;
      this.results = [];
    } finally {
      if (this.version === v) {
        this.isSearching = false;
      }
    }
  }
}

export const searchStore = new SearchStore();
