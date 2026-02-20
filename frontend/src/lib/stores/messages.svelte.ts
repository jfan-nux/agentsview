import * as api from "../api/client.js";
import type { Message } from "../api/types.js";

const FIRST_BATCH = 1000;
const BATCH_SIZE = 500;

class MessagesStore {
  messages: Message[] = $state([]);
  loading: boolean = $state(false);
  sessionId: string | null = $state(null);
  messageCount: number = $state(0);
  hasOlder: boolean = $state(false);
  loadingOlder: boolean = $state(false);
  private reloadPromise: Promise<void> | null = null;
  private reloadSessionId: string | null = null;
  private pendingReload: boolean = false;

  // Non-reactive buffer for background-prefetched messages.
  // Kept separate from the reactive `messages` array so that
  // prefetching never triggers virtualizer churn. Merged into
  // `messages` on demand (e.g. ensureOrdinalLoaded, loadOlder).
  private prefetchBuffer: Message[] = [];
  private prefetchDone: boolean = false;
  private backgroundLoading: boolean = false;
  private prefetchVersion: number = 0;

  async loadSession(id: string) {
    if (
      this.sessionId === id &&
      (this.messages.length > 0 || this.loading)
    ) {
      return;
    }
    this.sessionId = id;
    this.loading = true;
    this.messages = [];
    this.messageCount = 0;
    this.hasOlder = false;
    this.loadingOlder = false;
    this.reloadPromise = null;
    this.reloadSessionId = null;
    this.pendingReload = false;
    this.prefetchBuffer = [];
    this.prefetchDone = false;
    this.backgroundLoading = false;
    this.prefetchVersion++;

    try {
      await this.loadProgressively(id);
    } catch {
      // Non-fatal. Active session may have changed or the
      // source file may be mid-write during sync.
    } finally {
      if (this.sessionId === id) {
        this.loading = false;
      }
    }
  }

  reload(): Promise<void> {
    if (!this.sessionId) return Promise.resolve();

    // Use the session ID of the current reload to ensure we don't return
    // a promise for a previous session.
    if (this.reloadPromise && this.reloadSessionId === this.sessionId) {
      this.pendingReload = true;
      return this.reloadPromise;
    }

    const id = this.sessionId;
    this.reloadSessionId = id;

    const promise = this.reloadNow(id).finally(async () => {
      if (this.reloadPromise === promise) {
        this.reloadPromise = null;
        this.reloadSessionId = null;
      }
      if (this.pendingReload && this.sessionId === id) {
        this.pendingReload = false;
        await this.reload();
      }
    });
    this.reloadPromise = promise;
    return promise;
  }

  clear() {
    this.messages = [];
    this.sessionId = null;
    this.loading = false;
    this.messageCount = 0;
    this.hasOlder = false;
    this.loadingOlder = false;
    this.reloadPromise = null;
    this.reloadSessionId = null;
    this.pendingReload = false;
    this.prefetchBuffer = [];
    this.prefetchDone = false;
    this.backgroundLoading = false;
    this.prefetchVersion++;
  }

  private async loadProgressively(id: string) {
    const firstRes = await api.getMessages(id, {
      limit: FIRST_BATCH,
      direction: "desc",
    });

    if (this.sessionId !== id) return;
    // Keep in ascending ordinal order in store for simpler append
    // and stable ordinal math; UI handles newest-first presentation.
    this.messages = [...firstRes.messages].reverse();
    const newest = this.messages[this.messages.length - 1];
    this.messageCount = newest ? newest.ordinal + 1 : 0;
    const oldest = this.messages[0]?.ordinal;
    if (oldest !== undefined) {
      this.hasOlder = oldest > 0;
    } else {
      this.hasOlder = false;
    }

    if (this.hasOlder) {
      this.prefetchInBackground(id).catch(() => {});
    }
  }

  private cancelPrefetch() {
    this.prefetchVersion++;
    this.prefetchBuffer = [];
    this.prefetchDone = false;
    this.backgroundLoading = false;
  }

  /**
   * Fetches all older messages into a non-reactive buffer.
   * Does not touch the reactive `messages` array — no
   * virtualizer churn, no scroll disruption.
   */
  private async prefetchInBackground(id: string) {
    const version = this.prefetchVersion;
    this.backgroundLoading = true;
    this.prefetchDone = false;
    try {
      const oldest = this.messages[0]?.ordinal;
      if (oldest === undefined || oldest <= 0) return;

      this.prefetchBuffer = [];
      let from = 0;
      for (;;) {
        if (
          this.sessionId !== id ||
          this.prefetchVersion !== version
        ) return;
        const res = await api.getMessages(id, {
          from,
          limit: BATCH_SIZE,
          direction: "asc",
        });
        if (
          this.sessionId !== id ||
          this.prefetchVersion !== version
        ) return;
        if (res.messages.length === 0) break;

        for (const m of res.messages) {
          if (m.ordinal < oldest) {
            this.prefetchBuffer.push(m);
          }
        }

        if (res.messages.length < BATCH_SIZE) break;
        const last = res.messages[res.messages.length - 1]!;
        if (last.ordinal >= oldest - 1) break;
        from = last.ordinal + 1;
      }

      if (
        this.sessionId === id &&
        this.prefetchVersion === version
      ) {
        this.prefetchDone = true;
      }
    } finally {
      if (
        this.sessionId === id &&
        this.prefetchVersion === version
      ) {
        this.backgroundLoading = false;
      }
    }
  }

  /**
   * Merges the prefetch buffer into the reactive messages
   * array. Called on-demand when the user needs older
   * messages (search jump, scroll to top). Single reactive
   * update keeps virtualizer impact minimal.
   */
  private flushPrefetchBuffer() {
    if (this.prefetchBuffer.length === 0) return;
    const buf = this.prefetchBuffer;
    this.prefetchBuffer = [];
    this.messages = [...buf, ...this.messages];
    this.hasOlder = false;
  }

  private async loadFrom(id: string, from: number) {
    for (;;) {
      if (this.sessionId !== id) return;

      const res = await api.getMessages(id, {
        from,
        limit: BATCH_SIZE,
        direction: "asc",
      });

      if (this.sessionId !== id) return;
      if (res.messages.length === 0) break;

      this.messages.push(...res.messages);

      if (res.messages.length < BATCH_SIZE) break;
      from =
        res.messages[res.messages.length - 1]!.ordinal + 1;
    }
  }

  async loadOlder() {
    // If the prefetch buffer has data, flush it instead of
    // making a network request.
    if (this.prefetchDone && this.prefetchBuffer.length > 0) {
      this.flushPrefetchBuffer();
      return;
    }

    // Prioritize interactive requests (scroll/jump) over
    // background prefetch.
    if (this.backgroundLoading) {
      this.cancelPrefetch();
    }

    if (
      !this.sessionId ||
      this.loadingOlder ||
      !this.hasOlder ||
      this.messages.length === 0
    ) return;
    const id = this.sessionId;
    const oldest = this.messages[0]!.ordinal;
    if (oldest <= 0) {
      this.hasOlder = false;
      return;
    }

    this.loadingOlder = true;
    try {
      const res = await api.getMessages(id, {
        from: oldest - 1,
        limit: BATCH_SIZE,
        direction: "desc",
      });
      if (this.sessionId !== id) return;
      if (res.messages.length === 0) {
        this.hasOlder = false;
        return;
      }
      const chunk = [...res.messages].reverse();
      this.messages.unshift(...chunk);
      this.hasOlder = chunk[0]!.ordinal > 0;
    } finally {
      if (this.sessionId === id) {
        this.loadingOlder = false;
      }
    }
  }

  async ensureOrdinalLoaded(targetOrdinal: number) {
    if (!this.sessionId || this.messages.length === 0) return;

    // Check if already in range.
    const oldest = this.messages[0]!.ordinal;
    if (oldest <= targetOrdinal) return;

    // If prefetch already has data, consume in one update.
    if (this.prefetchDone && this.prefetchBuffer.length > 0) {
      this.flushPrefetchBuffer();
      return;
    }

    // Cancel background prefetch and load only what we need.
    if (this.backgroundLoading) {
      this.cancelPrefetch();
    }

    // Fallback: no prefetch running, load sequentially.
    for (;;) {
      if (
        !this.sessionId ||
        !this.hasOlder ||
        this.messages.length === 0
      ) return;
      const cur = this.messages[0]!.ordinal;
      if (cur <= targetOrdinal) return;
      await this.loadOlder();
      if (this.messages.length === 0) return;
      if (this.messages[0]!.ordinal >= cur) return;
    }
  }

  private async reloadNow(id: string) {
    try {
      const sess = await api.getSession(id);
      if (this.sessionId !== id) return;

      const newCount = sess.message_count ?? 0;
      const oldCount = this.messageCount;
      if (newCount === oldCount) return;

      // Fast path: append only new messages.
      if (newCount > oldCount && this.messages.length > 0) {
        const lastOrdinal =
          this.messages[this.messages.length - 1]!.ordinal;
        await this.loadFrom(id, lastOrdinal + 1);
        if (this.sessionId !== id) return;

        // If incremental fetch fell out of sync, repair once.
        const newest = this.messages[this.messages.length - 1];
        if (newest && newest.ordinal !== newCount - 1) {
          await this.fullReload(id);
          return;
        }

        this.messageCount = newCount;
        return;
      }

      // Message count shrank (session rewrite) or we have no local
      // data yet: do a full reload.
      await this.fullReload(id);
    } catch {
      // Non-fatal. SSE watch should keep working and retry on the
      // next update tick.
    }
  }

  private async fullReload(id: string) {
    this.loading = true;
    try {
      await this.loadProgressively(id);
    } finally {
      if (this.sessionId === id) {
        this.loading = false;
      }
    }
  }
}

export const messages = new MessagesStore();
