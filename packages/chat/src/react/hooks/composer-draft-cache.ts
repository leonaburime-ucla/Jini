/**
 * @module composer-draft-cache
 *
 * Per-conversation composer draft cache, keyed by conversation id. Exists so switching away from a
 * conversation and back round-trips whatever the operator was typing — even when the host remounts
 * `ChatPane` on switch (a React `key` keyed to the selected conversation, so a user-initiated switch
 * re-seeds the transcript from `initialMessages` — a documented pattern for this component: the pane
 * owns its own transcript and takes no `conversationId`-change effect of its own) — with zero host
 * wiring required. `useComposer.ts` reads/writes this on every
 * `conversationId` it is given; a host that also wants the draft to survive a page *reload* layers
 * its own `persistence` (`ComposerDraftPersistence`) on top, unkeyed, exactly as documented there.
 *
 * This is intentionally NOT the same seam as `ComposerDraftPersistence`: that one is a single opaque
 * host-owned slot (e.g. localStorage) that `useComposer` must never touch directly (see that
 * module's doc). This cache lives in module scope instead, purely in memory, so it survives a
 * `ChatPane` remount within the same page session — it does not, and is not meant to, survive a
 * reload.
 *
 * @tradeoffs A module-level singleton (rather than a per-instance store a host constructs and
 * passes down) was chosen so the fix works for every host with no new prop plumbing — known hosts of
 * this package do not wire a `persistence` port today, so a purely opt-in fix would not have fixed
 * the reported bug. The risk a singleton usually carries — two unrelated call sites sharing
 * state that should be isolated (see `create-daemon-attachment-uploader.ts`'s per-uploader
 * `batchUsage` map, which exists for exactly that reason) — does not apply the same way here: the
 * partition key (`conversationId`) is already globally unique per backend, so two `ChatPane`
 * instances showing two different conversations can never collide on it. Tests must call
 * {@link __resetComposerDraftCacheForTests} between cases to avoid cross-test leakage; that is the
 * real cost of this choice.
 *
 * Bounded to `MAX_CACHED_CONVERSATION_DRAFTS` distinct conversations so a long session visiting many
 * conversations cannot grow this map without limit — the oldest-inserted entry is evicted once the
 * cap is exceeded. A cleared/empty draft is deleted outright rather than kept as `''`, so the common
 * case (drafted, then sent) does not linger in the cache at all.
 */

/** Cap on distinct conversations tracked at once; see the module doc's `@tradeoffs`. */
export const MAX_CACHED_CONVERSATION_DRAFTS = 50;

const drafts = new Map<string, string>();

/**
 * Reads the cached draft for `conversationId`.
 *
 * @returns The cached draft, or `null` when there is none — including when `conversationId` itself
 * is absent (an untitled/new conversation has nothing to key on yet).
 * @complexity Time/space: O(1).
 */
export function readCachedDraft(conversationId: string | null | undefined): string | null {
  if (!conversationId) return null;
  return drafts.get(conversationId) ?? null;
}

/**
 * Stores `draft` for `conversationId`, evicting the oldest tracked conversation first if this would
 * introduce a new entry past {@link MAX_CACHED_CONVERSATION_DRAFTS}.
 *
 * @param conversationId No-ops when absent (`null`/`undefined`) — there is nothing to key on yet.
 * @param draft A blank (or whitespace-only) draft deletes the entry instead of storing `''`; see the
 * module doc's cleanup note.
 * @complexity Time/space: O(1) amortized.
 */
export function writeCachedDraft(conversationId: string | null | undefined, draft: string): void {
  if (!conversationId) return;
  if (draft.trim() === '') {
    drafts.delete(conversationId);
    return;
  }
  if (!drafts.has(conversationId) && drafts.size >= MAX_CACHED_CONVERSATION_DRAFTS) {
    const oldest = drafts.keys().next().value;
    if (oldest !== undefined) drafts.delete(oldest);
  }
  drafts.set(conversationId, draft);
}

/**
 * Explicitly evicts `conversationId`'s cached draft, for a host that wants to free it immediately
 * (e.g. on conversation delete) rather than waiting for the cap-triggered eviction above. Not
 * currently called by any host — a host's own conversation-delete flow is a candidate follow-up
 * caller, out of scope here (that flow lives outside this package).
 * @complexity Time/space: O(1).
 */
export function clearCachedDraft(conversationId: string | null | undefined): void {
  if (!conversationId) return;
  drafts.delete(conversationId);
}

/** Test-only: empties the module-level cache so test cases cannot leak drafts into each other. */
export function __resetComposerDraftCacheForTests(): void {
  drafts.clear();
}
