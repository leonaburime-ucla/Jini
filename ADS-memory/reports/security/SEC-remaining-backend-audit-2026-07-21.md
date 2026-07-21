# Security audit — remaining backend packages (2026-07-21)

**Reviewer:** Security (Pipeline)  
**Audit base:** target packages at `c781c4abf`; repository HEAD moved to `4619baa2b` only for an unrelated `packages/platform` test change, so the evidence below is unchanged.  
**Scope:** the complete current implementation and tests in `packages/sqlite`, `packages/cli`, `packages/mcp`, `packages/registry`, `packages/memory`, `packages/media`, and `packages/capability-providers`; this is not a diff-only review.  
**Method:** read-only source, test, manifest, and source-map review; dependency advisory check; architecture/constitution comparison; adversarial trust-boundary analysis. No fixes were implemented.

## Executive assessment

The seven-package set is **not ready for a security-hardened release or for connection to untrusted users, agents, registries, or provider responses**. I found **6 High and 5 Medium** issues. No Critical issue was identified because the repository still has no runnable daemon/service spine and several affected packages have no current consumer. That lack of reachability reduces present exploitability; it does not make the exported primitives safe to publish or wire later.

The main release blockers are:

- OAuth discovery and token flows in `@jini/mcp` can fetch attacker-selected network locations without SSRF, redirect, timeout, or response-size controls.
- MCP credentials are written to files and command-line arguments without a consistently fail-closed secret-storage boundary.
- Media staging can read arbitrary host files and can be redirected outside its staging root; its tests explicitly pin restriction bypasses.
- The memory note store allows root escape and symlink-following writes/deletes and treats unreadable configuration as enabled.
- The registry labels every configured GitHub source `official` while permitting unsigned, mutable, incompletely validated entries and path construction from unvalidated mutation input.
- `@jini/capability-providers` publicly exports deliberately insecure auth, payments, storage, database, and realtime stubs that are unsafe as production reference implementations.

High findings require human sign-off if accepted or deferred. The correct default is to fix them or exclude the affected package from any release surface.

## Scope honesty and architecture status

| Package | Architecture status | Security release position |
|---|---|---|
| `@jini/sqlite` | In locked section 3, but its current product-shaped synchronous DB barrel is substantially broader than the locked EventLog adapter | Do not expose through routes until ownership, transaction, bounds, and retention issues are resolved; architecture owner must decide the barrel's fate |
| `@jini/cli` | In locked section 3 | Medium hardening remains before it is safe with untrusted daemon output or large inputs |
| `@jini/mcp` | **Not in the locked section 3 package set** | Block publication/inclusion pending architecture sign-off and SEC-RB-001/002/011 |
| `@jini/registry` | **Not in the locked package set** | Block publication/inclusion pending architecture sign-off and SEC-RB-005 |
| `@jini/memory` | **Not in the locked package set** | Block publication/inclusion pending architecture sign-off and SEC-RB-004/007 |
| `@jini/media` | **Not in the locked package set** | Block publication/inclusion pending architecture sign-off and SEC-RB-003/010 |
| `@jini/capability-providers` | **Not in the locked package set; speculative greenfield with no current consumer** | Do not publish or present as production-ready; SEC-RB-006 must be resolved |

The current `@jini/mcp` package does **not** contain an MCP stdio server, framing parser, tool dispatcher, authorization layer, cancellation, or concurrency/version-negotiation implementation. Its own source map identifies those pieces as dropped/deferred. Therefore there is no stdio framing boundary to certify or test in this audit. The implemented surface is config generation, OAuth/token handling, installation planning, and idle/client utilities.

The governance constitution and feature security/test contracts are still draft placeholders. Consequently, this report can compare code to the locked extraction decisions and common security invariants, but it cannot honestly certify conformance to an approved feature-specific security specification.

## Review denominator and discovery limitation

The direct package inventory contained **142 files**, including **116 files under `src/**`**: 68 production source files and 48 tests.

| Package | All package files | Production `src` | Test `src` |
|---|---:|---:|---:|
| sqlite | 29 | 21 | 5 |
| cli | 22 | 9 | 9 |
| mcp | 20 | 10 | 7 |
| registry | 14 | 5 | 5 |
| memory | 16 | 6 | 6 |
| media | 23 | 10 | 9 |
| capability-providers | 18 | 7 | 7 |
| **Total** | **142** | **68** | **48** |

Codebase Memory MCP was attempted first as required. The configured project initially appeared but graph operations returned “not indexed,” then the project disappeared from the graph list. The last known graph inventory covered only 128 of the 142 package files. Direct repository inspection was therefore used for the authoritative current-tree audit, and this report does not claim graph completeness.

## Trust-boundary map

| Boundary | Less-trusted input | Privileged destination | Main controls present | Main gap |
|---|---|---|---|---|
| MCP OAuth | MCP resource URL and discovery metadata | Host network, OAuth credentials, token cache | JSON parsing and OAuth state/PKCE helpers | No SSRF/redirect/DNS policy, timeout, byte cap, or strict endpoint binding |
| MCP configuration/install | Env values, headers, OAuth tokens, project cwd | Local files and child-process invocation | Atomic-style temporary writes in some paths | Secrets in ordinary files/argv; incomplete permissions; lexical-only cwd containment |
| Media staging | Agent/user attachment paths and staging options | Arbitrary readable files and staging cleanup | Optional upload-root lexical/realpath comparison | Restriction silently disables; staging root/name and symlinks are uncontrolled |
| Memory store | Note subdirectory, content, names, IDs, filesystem state | Host filesystem and active memory index | Generated entry IDs and some frontmatter escaping | Root escape, symlink following, non-atomic writes, fail-open config, prompt/index injection |
| Registry | Remote manifest and publish/yank request | Trusted pack selection and GitHub PR paths | Runtime schema for some read paths | Trust is self-assigned; integrity/signatures optional; mutation inputs not validated |
| SQLite persistence | Caller IDs, events, JSON, content | Durable conversation/session state | Parameterized SQL; transaction in EventLog append | No ownership dimension; cross-conversation update hazard; unbounded state and races |
| CLI daemon client | URL, response body/errors, prompt file/stdin | Network, terminal, process memory | Some typed success/error parsing | Arbitrary schemes/hosts, no timeout/size cap, raw error disclosure, unbounded input reads |
| Capability providers | Credentials, records, object keys, payments, channels | Auth/payment/data planes | Interface separation | Public implementations are intentionally non-cryptographic, unauthenticated, unbounded stubs |

## Findings

### SEC-RB-001 — High — MCP OAuth discovery and token exchange permit SSRF and unbounded outbound requests

**Evidence**

- `packages/mcp/src/core/oauth.ts:145-165` derives a protected-resource discovery URL from an arbitrary resource URL and fetches it.
- `packages/mcp/src/core/oauth.ts:174-215` accepts discovered authorization-server/issuer endpoints and uses plain `fetch` without a destination policy, redirect validation, timeout, or response-size limit.
- `packages/mcp/src/core/oauth.ts:269-303` posts to a metadata-provided dynamic client-registration endpoint.
- `packages/mcp/src/core/oauth.ts:406-485` posts authorization codes, refresh tokens, and potentially HTTP Basic client credentials to the selected token endpoint.
- `packages/mcp/src/core/oauth.ts:604-665` composes those untrusted discovery results into the authorization flow.
- Tests cover ordinary HTTPS/error cases but omit loopback, RFC1918/ULA/link-local/cloud-metadata targets, redirects, DNS rebinding, slow responses, and oversized responses.

**Impact and exploit path**

If a user or agent can add an MCP server URL, a malicious resource server or discovery document can make the host probe internal services and cloud metadata. Redirects and DNS changes can defeat a simple initial string check. Later requests can send client credentials, authorization codes, or refresh tokens to a malicious or redirected endpoint. Slow or oversized responses can hold sockets and memory.

**Required remediation**

Require approved `https:` endpoints except an explicit development-only loopback mode. Resolve and reject non-public destinations at connection time, including every redirect hop and IPv4-mapped IPv6 form. Bind discovered endpoints to an approved issuer/origin policy. Add `AbortSignal` deadlines, redirect-count limits, response-byte limits, strict metadata schemas, and stable redacted errors. Test private addresses, redirects, DNS rebinding, invalid schemes, oversized JSON, and timeouts.

**Human sign-off required:** Yes, if accepted/deferred.

### SEC-RB-002 — High — MCP bearer, refresh, and client credentials lack a fail-closed storage and propagation boundary

**Evidence**

- `packages/mcp/src/core/config.ts:37-48` includes environment and header values in persisted configuration; `packages/mcp/src/core/config.ts:261-268` writes the config through an ordinary temporary file/rename sequence without owner-only creation semantics.
- `packages/mcp/src/core/oauth.ts:58-64` stores OAuth client secrets, and `packages/mcp/src/core/oauth.ts:226-262` writes the client cache without an owner-only mode or cross-process locking.
- `packages/mcp/src/core/tokens.ts:188-211` writes token contents before applying `chmod(0600)`; it explicitly continues if chmod is unsupported or denied. `packages/mcp/src/core/__tests__/tokens.test.ts:159-181` pins persistence despite chmod failure.
- `packages/mcp/src/agent-install/install.ts:131-136` and `packages/mcp/src/agent-install/install.ts:171-207` serialize environment entries as `KEY=value` command-line arguments for agent installation.
- `packages/mcp/src/core/oauth.ts:474-493` includes up to 500 bytes of remote response text in OAuth errors without proving it is secret-free.

**Impact and exploit path**

Other local principals, backups, synchronized config directories, process-list observers, shell history, or logging executors can recover bearer tokens, refresh tokens, OAuth client secrets, and provider environment secrets. Applying permissions after writing creates an exposure window; continuing after chmod failure makes the intended protection advisory rather than enforced.

**Required remediation**

Create secret files atomically with owner-only permissions from the first byte and fail closed when that cannot be guaranteed. Prefer an OS credential store and keep non-secret connection metadata separate. Use cross-process locks/durable replacement for caches. Never place secrets in argv; pass them through a protected descriptor, stdin protocol, or explicitly scrubbed environment. Redact remote bodies and credential-like fields from errors/logs. Add mode, chmod-failure, concurrent-writer, process-argv, and redaction tests.

**Human sign-off required:** Yes, if accepted/deferred.

### SEC-RB-003 — High — Media staging can exfiltrate arbitrary host files and escape its cleanup/copy root

**Evidence**

- `packages/media/src/staging.ts:70-80` joins caller-controlled `stagingDirName` to the configured root and creates/uses it without rejecting absolute/traversal components or resolving a symlinked staging directory.
- `packages/media/src/staging.ts:45-66` enumerates and deletes old files beneath that path; a redirected staging directory or unsafe name can move cleanup outside the intended root.
- `packages/media/src/staging.ts:77-107` accepts any existing host file if `uploadRoot` is omitted. If the configured upload root does not exist, realpath failure becomes `null` and the restriction is silently disabled.
- `packages/media/src/__tests__/staging.test.ts:35-45` explicitly expects a path outside cwd to be copied, and `packages/media/src/__tests__/staging.test.ts:80-86` expects a nonexistent upload root to disable the restriction.
- No test covers a `../` or absolute staging directory name, a preexisting symlink staging directory, symlink replacement between check and copy, negative cleanup age, attachment count/size, or file type.

**Impact and exploit path**

An agent-controlled attachment path can stage any daemon-readable file—SSH keys, tokens, databases, or product data—for upload to a media provider. A malicious or concurrently replaced staging symlink can cause writes or cleanup outside the intended directory. Unbounded files can exhaust disk, memory, or provider costs.

**Required remediation**

Make a canonical upload root mandatory for non-test use and reject the operation if it cannot be resolved. Keep the staging basename host-owned or strictly validate one path component. Canonicalize roots/candidates, verify containment after resolution, reject symlinks with `lstat`/no-follow primitives, and use safe exclusive file creation. Revalidate at open/copy time to reduce TOCTOU exposure. Enforce file count, size, type, total-byte, and age bounds. Reverse the two tests that currently pin bypass behavior and add traversal/symlink/race cases.

**Human sign-off required:** Yes, if accepted/deferred.

### SEC-RB-004 — High — Memory note-store paths can escape the store and overwrite/delete through symlinks

**Evidence**

- `packages/memory/src/note-store.ts:136-151` accepts a caller-provided subdirectory and joins it to the root without limiting it to one safe path component or proving canonical containment.
- `packages/memory/src/note-store.ts:173-184`, `packages/memory/src/note-store.ts:196-218`, `packages/memory/src/note-store.ts:230-270`, and `packages/memory/src/note-store.ts:324-360` use lexical paths for reads, writes, and unlink operations and follow preexisting symlinks.
- `packages/memory/src/note-store.ts:186-193` catches every configuration read/parse error and returns `{ enabled: true }`, so permission errors and corruption fail open.
- Entry/index writes are non-atomic read-modify-write operations. Names are inserted into Markdown links without eliminating structural Markdown/newline influence, while file/content/count sizes are unbounded.
- Functional tests do not cover subdirectory traversal, symlink/hardlink targets, concurrent writers, crash interruption, unreadable/corrupt disabled configuration, Markdown link injection, or storage bounds.

**Impact and exploit path**

If the future host exposes note-store selection or writes to an agent/user, traversal or a planted symlink can read, overwrite, or delete files outside memory storage. Concurrent writes can lose active-index entries or leave torn files. Fail-open configuration can reactivate memory after a defensive configuration becomes unreadable. Crafted names can alter the active Markdown index that may later be incorporated into an LLM context.

**Required remediation**

Use a host-owned root and safe one-component subdirectory identifiers. Canonicalize and enforce containment, reject symlinks/no-follow all opened targets, and use exclusive temporary files plus durable atomic rename. Lock cross-process index mutations. Distinguish not-found from corrupt/permission errors and fail closed for security-relevant configuration. Escape or structurally generate Markdown and cap notes, bytes, active entries, and scan work. Add adversarial filesystem and concurrency tests.

**Human sign-off required:** Yes, if accepted/deferred.

### SEC-RB-005 — High — Registry trust is self-assigned while artifact integrity and mutation validation are optional

**Evidence**

- `packages/registry/src/github-backend.ts:56-62` constructs every configured GitHub registry snapshot with `trust: 'official'`; there is no cryptographic or allowlist proof tying owner/repository/ref to that trust class.
- `packages/registry/src/github-backend.ts:82-137` builds branch names, paths, titles, and bodies from unvalidated publish/yank `name`, `version`, and `reason` values.
- `packages/registry/src/__tests__/github-backend.test.ts:121` expects a publish body with integrity `(pending)`, so publication can proceed without a final digest.
- `packages/registry/src/static-backend.ts:86-111` permits resolution with optional integrity and manifest-digest data. `packages/registry/src/database-backend.ts:37-68` and `packages/registry/src/database-backend.ts:102-122` persist mutation input without applying the same runtime schema at the write boundary and parse whole stored manifests synchronously.
- Tests do not challenge `../`, separators/control characters, malformed stored JSON, spoofed official sources, unsigned/mutable artifacts, digest mismatch, huge manifests, or concurrent publication.
- Locked decision C8 requires signed third-party packs, explicit capabilities, scoped credentials, and sandboxing; none is enforced by this registry layer.

**Impact and exploit path**

A malicious or misconfigured GitHub repository can be labeled official and supply a mutable or unsigned pack. Downstream code may treat that trust bit as an authorization shortcut. Unvalidated mutation fields can manipulate PR paths/branches or inject review text depending on the injected GitHub client. Whole-manifest loading/parsing allows corruption or resource exhaustion.

**Required remediation**

Derive trust only from a host-owned registry allowlist and verified signing identity. Require immutable artifact references and verified cryptographic integrity before an entry becomes resolvable. Apply strict runtime schemas to all read and mutation boundaries, including constrained vendor/name/version path components and text/control limits. Keep untrusted and official registries distinct; do not let constructor configuration assert trust. Bound manifest bytes/entries and handle corrupt rows safely. Add signature/digest, spoofed-origin, traversal/injection, malformed-data, and scale tests.

**Human sign-off required:** Yes, if accepted/deferred.

### SEC-RB-006 — High — Capability-provider package publicly exports intentionally insecure implementations

**Evidence**

- `packages/capability-providers/src/auth.ts:8-12` documents a non-cryptographic in-memory implementation. `packages/capability-providers/src/auth.ts:57-90` stores plaintext passwords and issues predictable `user-N` and `session-N` identifiers without password policy, rate limiting, or secure randomness. The implementation does enforce configured session expiry at `packages/capability-providers/src/auth.ts:98-104`; this finding does not claim otherwise.
- `packages/capability-providers/src/payments.ts:47-60` deterministically succeeds and only rejects `amount <= 0`; `NaN`, infinity, non-integer currency units, replay, idempotency, and authenticated ownership are not modeled.
- `packages/capability-providers/src/storage.ts:23-64`, `packages/capability-providers/src/db.ts:25-87`, and `packages/capability-providers/src/realtime.ts:19-58` have no principal/tenant/ACL dimension, quota, size bound, or channel authorization; records and callbacks are retained in unbounded memory.
- `packages/capability-providers/src/index.ts:8-13` exports these implementations on the normal public barrel rather than a test-only/explicitly unsafe namespace.
- Tests verify predictable reference behavior only; they do not establish cryptographic sessions, password handling, rate limiting, tenant isolation, authorization, payment replay/idempotency, quotas, or callback fault isolation.

**Impact and exploit path**

Because the interfaces resemble real provider adapters and the implementations are public, a consumer can accidentally ship plaintext credentials, guessable sessions, unauthenticated cross-tenant data access, replayable payments, and unbounded data/channel use. There is no current consumer, so this is a publication/integration hazard rather than a reachable daemon exploit today.

**Required remediation**

Do not publish the package as a production provider layer in its current form. Move implementations to an explicitly test-only/unsafe module and make production host assembly reject them. Redesign contracts around authenticated principal/tenant context, scoped capabilities, cryptographic session/token generation and rotation, production credential storage, payment idempotency and integer minor units, ACLs, quotas/bounds, auditability, and callback isolation. Obtain architecture sign-off and satisfy the two-consumer rule before locking this speculative package.

**Human sign-off required:** Yes, if accepted/deferred.

### SEC-RB-007 — Medium — Memory self-verification accepts unknown statuses and weak evidence collisions

**Evidence**

- `packages/memory/src/verify.ts:28-35` allows a scorecard row status of `'pass' | 'fail' | string`.
- `packages/memory/src/verify.ts:132-151` counts only exact `'fail'` values as failures; arbitrary values such as `unknown`, `skipped`, or attacker-selected strings avoid failure. The top-level scorecard status is copied but not enforced.
- `packages/memory/src/verify.ts:92-106` treats substring overlap or two common significant words as coverage, so a vague row can satisfy several distinct required rules.
- Tests use ordinary `pass`/`fail` fixtures and positive fuzzy matches but omit unknown statuses, top-level failure with passing rows, duplicate evidence reuse, and adversarial word collisions.

**Impact and exploit path**

If this helper is used as a quality/security gate for model-generated scorecards, malformed or evasive model output can be reported as verified without proving the required rules. This is especially dangerous because the package describes the helper as an enforcer.

**Required remediation**

Use a closed runtime enum and reject any unknown status. Require top-level and row-level agreement, unique rule-to-evidence mapping where appropriate, and explicit stable rule IDs instead of fuzzy prose overlap. Validate evidence shape/length and fail closed on malformed output. Add adversarial bypass tests.

**Human sign-off required:** No.

### SEC-RB-008 — Medium — SQLite persistence APIs lack ownership invariants and safe bounds

**Evidence**

- `packages/sqlite/src/index.ts:8-11` exports a synchronous product-shaped database barrel for projects, conversations, messages, and agent sessions, beyond the locked EventLog adapter scope.
- `packages/sqlite/src/db/core/types.ts:10` defines `DbRow` as `Record<string, any>`, and JSON helpers return unchecked values at persistence boundaries.
- `packages/sqlite/src/db/schema/migrate.ts:22-84` stores message content, custom instructions, cwd/session data, and event JSON without an ownership/principal model.
- `packages/sqlite/src/db/messages/messages.ts:55-141` locates/updates an existing message by global ID without also requiring the supplied conversation ID. Position calculation, insert/update, and conversation bump are not one transaction.
- `packages/sqlite/src/db/messages/messages.ts:178-228` read-modify-writes unbounded event arrays. `packages/sqlite/src/event-log.ts:24-33`, `packages/sqlite/src/event-log.ts:55-61`, and `packages/sqlite/src/event-log.ts:145-174` show unlimited default retention, unchecked serialized payload size, and throwing JSON row conversion; `packages/sqlite/src/event-log.ts:185-215` accepts finite fractional/negative numeric cursors.
- `packages/sqlite/src/db/connection/connection.ts:24-36` uses a process-global connection that closes the prior database when another path is selected.
- Tests establish parameterization and many functional flows but omit cross-conversation ID mutation, competing writers/connections, busy-timeout behavior, oversized/cyclic JSON, invalid retention/cursors, corrupt persisted EventLog rows, filesystem containment, and database-file permissions. `packages/sqlite/src/__tests__/event-log.test.ts:144-155` explicitly exercises uncapped 2,500-event retention.

**Impact and exploit path**

Once routes or plugins expose these helpers, a confused caller can mutate a message in one conversation while presenting another conversation, and absent ownership fields make cross-tenant enforcement impossible at the persistence layer. Concurrent operations can lose ordering/update state. Prompt-influenced content and events can grow the database or process memory without limit; malformed rows can turn replay into denial of service.

**Required remediation**

First obtain architecture ownership for the product-shaped barrel; the neutral package should expose the locked adapter, not consumer DTOs by accident. Add explicit owner/tenant scope to keys or require a host-owned authorization context, and make compound message operations transactional with `(conversation_id, id)` invariants. Apply runtime schemas, payload/count/retention bounds, busy timeout/concurrency policy, corruption handling, and secure database path/mode policy. Add the missing isolation, contention, bounds, and corrupt-row tests.

**Human sign-off required:** No, unless the broader architecture mismatch is accepted.

### SEC-RB-009 — Medium — CLI network, error, and prompt boundaries are unbounded and disclose raw data

**Evidence**

- `packages/cli/src/daemon-url.ts:46-67` returns caller/environment configuration without restricting scheme, host, userinfo, or loopback policy.
- `packages/cli/src/http.ts:69-117` sends requests and consumes responses without a timeout, cancellation signal, redirect/destination policy, or response-byte limit.
- `packages/cli/src/http.ts:24-45` and `packages/cli/src/errors.ts:84-130` surface raw URL, cause, details, and response-body data without a secret/control-character redaction allowlist.
- `packages/cli/src/__tests__/errors.test.ts:138-163` explicitly pins raw response disclosure.
- `packages/cli/src/prompt.ts:43-74` and `packages/cli/src/prompt.ts:98-118` read files/stdin into memory without size/time limits.
- `packages/cli/src/command-registry.ts:35-38` silently overwrites an existing command registration; its test at `packages/cli/src/__tests__/command-registry.test.ts:46-55` pins that behavior.

**Impact and exploit path**

A malicious/misconfigured daemon can hold the CLI indefinitely, return an oversized body, inject terminal control sequences, or echo secret-bearing diagnostics. URL userinfo may be printed. Large files/stdin can exhaust memory. If third-party commands are later loaded, silent duplicate registration lets a pack replace a trusted command by name.

**Required remediation**

Validate daemon URLs and default to loopback/approved schemes; require explicit policy for remote hosts and strip userinfo from diagnostics. Add request deadlines, cancellation, response-byte limits, manual/disabled redirects as appropriate, and stable redacted error codes. Strip terminal controls. Stream/cap prompt input and define symlink policy. Reject duplicate command registrations unless an explicit, trusted override API is used. Rewrite disclosure/overwrite tests and add timeout, huge-input/response, redirect, credential, and terminal-injection cases.

**Human sign-off required:** No.

### SEC-RB-010 — Medium — Media policy and task-store defaults fail open and omit ownership/state invariants

**Evidence**

- `packages/media/src/policy.ts:39-73` defaults media to enabled; absent/empty provider and model allowlists mean unrestricted, and a request with no model bypasses `allowedModels`.
- `packages/media/src/__tests__/policy.test.ts:5-12` and `packages/media/src/__tests__/policy.test.ts:46-49` pin default-unrestricted and missing-model bypass behavior.
- The media package does not centrally invoke policy; each future caller must remember to do so.
- `packages/media/src/task-store.ts:95-108` permits get/update/delete by task ID alone; `packages/media/src/task-store.ts:121-141` allows duplicate create to replace a task, and `packages/media/src/task-store.ts:148-169` accepts arbitrary state transitions and mutable reference objects.
- Tests omit owner-scoped mutations, duplicate-ID rejection, transition graphs, immutable snapshots, record/URL bounds, and cross-owner access.

**Impact and exploit path**

Future hosts can accidentally enable costly external generation for every provider/model, bypass a model restriction by omitting the field, or skip policy entirely. Predictable/colliding task IDs and unscoped mutation APIs allow one caller to read, replace, transition, or delete another caller's task when exposed. Unbounded results/URLs can consume memory.

**Required remediation**

Make policy deny by default and require an explicit enabled provider/model capability; require model normalization before evaluation. Centralize policy in the dispatch gateway so adapters cannot bypass it. Scope every task operation to owner/tenant, reject duplicate IDs, enforce a finite transition machine and immutable copies, and cap stored data. Add negative policy and cross-owner/state/concurrency tests.

**Human sign-off required:** No.

### SEC-RB-011 — Medium — MCP filesystem grant and idle-controller helpers accept unsafe boundary values

**Evidence**

- `packages/mcp/src/core/config.ts:282-290` decides whether a project cwd is managed with lexical `startsWith`; `..` segments or symlinked descendants can make an outside directory appear managed for config writes.
- OpenCode permission generation accepts root-wide paths, and `packages/mcp/src/core/__tests__/config.test.ts:255-279` explicitly expects `/`, `/*`, and related grants rather than rejecting a whole-filesystem permission.
- `packages/mcp/src/client/client.ts:28-85` does not validate idle duration. Negative/NaN values and repeated rescheduling while calls are in flight can create immediate timer churn.
- Tests omit canonical managed-cwd containment, symlink roots, unsafe root grants, and invalid/extreme idle values.

**Impact and exploit path**

A caller mistake or crafted project path can write MCP configuration outside the intended managed workspace. A root path can grant an agent external-directory access to the entire filesystem. Invalid idle values can produce CPU/timer churn and unreliable lifecycle behavior.

**Required remediation**

Canonicalize both managed roots and cwd, verify separator-aware containment, and define behavior for nonexistent paths/symlinks. Reject filesystem roots and overly broad globs unless a separate explicit high-risk override is authorized and surfaced to the user. Validate idle duration as a finite integer within documented bounds and avoid reschedule loops. Add adversarial path/grant/timer tests.

**Human sign-off required:** No.

## Package-wide test-security assessment

All current tests passing—even with 100% executable-source coverage—does not establish the missing security invariants. In several packages, tests positively require unsafe behavior.

| Package | Useful existing assurance | Security journeys missing or pinned unsafe |
|---|---|---|
| sqlite | Real SQLite/restart coverage, parameterized SQL, EventLog append/replay behavior | Cross-owner/conversation mutation, competing connections, busy handling, corrupt rows, payload/retention bounds, path/mode policy; uncapped retention is pinned |
| cli | Broad resolver/error/parser branch coverage | URL scheme/host policy, redirects, timeout/cancel, response and prompt bounds, terminal/secret redaction, symlink input; raw response disclosure and command overwrite are pinned |
| mcp | Many OAuth/config/token happy/error branches | SSRF, redirect/DNS rebinding, time/byte limits, cache races/modes, symlink cwd; chmod-failure persistence and root grants are pinned; no server/framing tests because implementation is absent |
| registry | CRUD/backend semantics for typed fixtures | Runtime mutation schemas, trust spoofing, signatures/integrity mismatch, path/branch injection, corrupt/huge manifests, concurrency and network-client boundary; pending integrity is pinned |
| memory | Functional note lifecycle and ordinary scorecards | Traversal/symlink/hardlink, atomic/crash/concurrent writes, fail-closed config, storage bounds, Markdown injection, unknown score statuses and evidence collisions |
| media | Functional policy/staging/task helpers | Staging-name traversal/symlink/TOCTOU, file bounds/type, owner-scoped task mutation, duplicate IDs, transition graph; arbitrary outside-file staging, restriction disable, and fail-open policy are pinned |
| capability-providers | Deterministic reference behavior | Cryptography/password/rate limits, session entropy/expiry, tenant isolation/authz, payment validation/idempotency, ACLs/quotas, callback isolation; suite tests intentionally insecure stubs only |

## Dependency advisory check

`pnpm audit --prod --audit-level=moderate` reported one High and four Moderate advisories, all through `packages/ui -> @excalidraw/excalidraw` dependency paths. **None of the reported paths traversed the seven packages in this audit.** This does not prove those packages free of future advisories, but the current lockfile audit produced no target-package dependency path. The only direct non-workspace production dependency in the target set is `better-sqlite3` in sqlite and registry; it was not named by the audit output.

The workspace-level UI advisories are outside this report's assigned scope and should remain tracked by the owning audit rather than being silently treated as resolved.

## Verification evidence

The independent TestRunner report is `ADS-memory/reports/test-runs/TR-remaining-backend-audit-2026-07-21.md` and records:

- Root `pnpm guard` — passed.
- Root `pnpm typecheck` — passed.
- All seven package suites — **701 tests passed**.
- Explicit V8 coverage over executable `src/**` — **100% statements, branches, functions, and lines** under the report's executable-source denominator.

Those green results establish reproducibility and executable coverage. They do not negate this report: semantic security controls, omitted server functionality, adversarial filesystem/network behavior, and intentionally unsafe expected results are not repaired by line execution.

## Required release gates

1. **Block any release or wiring of `@jini/mcp`** until SEC-RB-001 and SEC-RB-002 are fixed, then resolve SEC-RB-011. Separately obtain architecture sign-off because MCP is outside the locked package set and the advertised stdio/server security boundary is absent.
2. **Block publication or production use of media, memory, registry, and capability-providers** until their High findings are fixed and the Coordinator/Software Architect approves their addition to the locked architecture.
3. **Do not expose sqlite's product-shaped CRUD barrel through a daemon or multi-user host** until its ownership/transaction/bounds issues and architecture scope are resolved.
4. Harden CLI URL, error, and input boundaries before treating daemon/provider output as untrusted.
5. Add the adversarial tests specified in each finding. Do not preserve current tests that pin unsafe behavior merely to retain 100% coverage.

## Human decisions required

- Explicit accept/fix/defer decision for each High finding: SEC-RB-001 through SEC-RB-006.
- Coordinator/Software Architect sign-off before treating MCP, registry, memory, media, or capability-providers as part of the locked architecture.
- A separate architecture decision on whether sqlite's product-shaped synchronous database barrel belongs in the neutral engine at all.

**Final security verdict:** **BLOCK the audited seven-package release set.** A narrower locked-package build that excludes the five non-locked packages still must not expose sqlite/CLI boundaries to untrusted callers until the Medium findings are addressed and the sqlite surface receives architecture review.
