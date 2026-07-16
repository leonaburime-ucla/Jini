# Adapter Contract: `code_search` Facade

The portable discovery tool that all agents use. Hides backend routing behind one interface, returns a trust envelope so agents can weigh confidence, and falls through to `rg` transparently when a backend is stale, unsupported, or absent.

---

## Request

```ts
type CodeSearchRequest = {
  repoRoot: string
  worktreeId?: string
  queryId: string
  intent: QueryClass
  query: string
  anchors?: Array<SymbolRef | FileRef>
  scope?: {
    include?: string[]
    exclude?: string[]
    languages?: string[]
  }
  backendPolicy: {
    mode: "auto" | "pinned"
    backend?: string
    allowRgFallback: boolean
  }
  freshnessPolicy: "check" | "reconcile" | "fail_if_stale"
  budget?: {
    maxResults?: number
    maxTokens?: number
    includeSnippets?: boolean
  }
}

type QueryClass =
  | "symbol_lookup"
  | "callers"
  | "callees"
  | "dependency_path"
  | "architecture"
  | "literal_config"
  | "semantic"
  | "change_impact"
```

---

## Response

```ts
type CodeSearchResponse = {
  queryId: string
  results: CodeSearchResult[]
  trust: TrustEnvelope
  metrics: SearchMetrics
  diagnostics?: string[]
}

type CodeSearchResult = {
  file: string
  lineStart: number
  lineEnd: number
  content: string
  symbol?: string
  relevanceScore?: number
}

type SearchMetrics = {
  coldPrepareMs: number
  freshnessCheckMs: number
  retrievalMs: number
  totalMs: number
  tokensConsumed: number
  filesRead: number
  backendScanUnits?: number
}
```

---

## Trust Envelope

The critical abstraction. Allows agents (and the eval harness) to know whether to trust results or fall back.

```ts
type TrustEnvelope = {
  provenance: {
    backendId: string
    backendVersion?: string
    adapterVersion: string
    fallbackChain: string[]
    indexId?: string
    sources: SourceEvidence[]
    semanticModel?: SemanticModelProvenance
  }
  freshness: {
    headSha?: string
    indexHeadSha?: string
    dirtyState: "clean" | "dirty" | "unknown"
    status: "current" | "stale" | "partial" | "unknown"
    checkedAt: string
    stalePaths?: string[]
    reconciliation: "none" | "lazy_refreshed" | "rg_fallback" | "failed"
  }
  coverage: {
    status: "full" | "partial" | "unsupported" | "fallback"
    capabilities: QueryClass[]
    unsupportedReasons?: string[]
    indexedFiles?: number
    searchedFiles?: number
    excludedPaths?: string[]
    confidence: "high" | "medium" | "low"
  }
}

type SourceEvidence = {
  type: "index" | "rg_scan" | "lsp" | "ast_parse" | "long_context"
  path?: string
  commitSha?: string
}

type SemanticModelProvenance = {
  provider: string
  modelId: string
  immutableRevision: string
  dimensions: number
  chunkerVersion: string
  distanceMetric: string
  contentHashAlgo: string
  lastFullReindexAt?: string
}
```

---

## Backend Adapter Trait

Each backend implements this trait to plug into the facade.

```ts
interface CodeSearchBackendAdapter {
  id(): string
  version(): Promise<string | undefined>
  capabilities(repo: RepoContext): Promise<BackendCapabilities>
  prepare(repo: RepoContext, options: PrepareOptions): Promise<PrepareResult>
  checkFreshness(repo: RepoContext): Promise<FreshnessReport>
  search(request: CodeSearchRequest): Promise<CodeSearchResponse>
  reconcile?(repo: RepoContext, changes: WorktreeChanges): Promise<ReconcileResult>
  dispose?(): Promise<void>
}

type RepoContext = {
  root: string
  worktreeId: string
  headSha: string
  isDirty: boolean
}

type BackendCapabilities = {
  supportedClasses: QueryClass[]
  requiresIndex: boolean
  supportsIncremental: boolean
  supportsDirtyWorktree: boolean
}

type PrepareOptions = {
  indexIfMissing: boolean
  reconcileIfStale: boolean
  timeout?: number
}

type PrepareResult = {
  ready: boolean
  indexId?: string
  prepareDurationMs: number
  error?: string
}

type FreshnessReport = {
  status: "current" | "stale" | "missing" | "partial"
  headSha: string
  indexHeadSha?: string
  stalePaths?: string[]
  dirtyFiles?: string[]
}

type ReconcileResult = {
  success: boolean
  filesReconciled: number
  durationMs: number
  newIndexId?: string
}
```

---

## Contract Rules

1. **No config writes.** A backend never auto-writes host, agent, or repo config.
2. **Per-worktree indexes.** Indexes are explicit artifacts scoped to a worktree, not global hidden state.
3. **Lazy freshness.** Staleness is checked per query or prepare call. No daemon required. No git hooks.
4. **Transparent fallback.** When a backend is stale/unsupported, `rg` fallback is used and recorded in `fallbackChain` and `coverage.status`.
5. **Graceful unsupported.** An unsupported capability returns `coverage.status: "unsupported"` or `"fallback"` — never a crash.
6. **Semantic provenance.** Model-backed results must include full `semanticModel` provenance (Phase 2).
7. **Deterministic for evals.** The adapter must produce identical results for identical inputs when the underlying index hasn't changed.

---

## Backend Registration

Each backend ships a manifest:

```yaml
id: codebase-memory-mcp
version: "1.0.0"
capabilities:
  - symbol_lookup
  - callers
  - callees
  - dependency_path
  - architecture
  - change_impact
requiresIndex: true
supportsIncremental: true
supportsDirtyWorktree: false
indexCommand: "mcp-index --repo ."
freshnessCommand: "mcp-status --repo ."
```

---

## Routing Logic (Facade)

```
1. Check backendPolicy.mode
   - "pinned" → use specified backend directly
   - "auto" → proceed to routing

2. Check backend capabilities for requested intent
   - If no backend supports intent → rg fallback

3. Check freshness (lazy)
   - If stale AND freshnessPolicy == "fail_if_stale" → error
   - If stale AND freshnessPolicy == "reconcile" → attempt reconcile, timeout → rg fallback
   - If stale AND freshnessPolicy == "check" → rg fallback, record in envelope

4. Execute search on selected backend

5. If backend returns zero results AND allowRgFallback → rg scan, record in fallbackChain

6. Return response with full TrustEnvelope
```

---

## Backends Under Evaluation

| Backend | id | Capabilities (claimed) | Status |
|---------|----|-----------------------|--------|
| ripgrep | `rg-control` | literal_config, symbol_lookup (fuzzy) | Baseline/control |
| Codebase Memory MCP | `codebase-memory-mcp` | symbol, callers, callees, dep_path, architecture, change_impact | Incumbent |
| Graphify | `graphify` | architecture, dependency_path | Incumbent |
| serena | `serena-lsp` | symbol, callers, callees (LSP-precise) | Candidate |
| codegraph | `codegraph-fts5` | symbol, literal_config, callers, architecture | Candidate |
| understand-anything | `understand-anything` | architecture, semantic, dependency_path | Candidate |
| Long-context + caching | `long-context` | all (bounded by token window) | Strategy |
