# Data Classification and Secret Handling Policy

Defines how agents treat sensitive data encountered during pipeline execution. All agents are bound by this policy. Violations are Constitution Article VI (Security-by-Default) concerns and are logged to memory-store.md.

Supplements `<AI_DEV_SHOP_ROOT>/framework/governance/tool-permission-policy.md`, which governs tool scope. This document governs data handling within those scopes.

---

## Data Classes

| Class | Definition | Examples |
|-------|------------|---------|
| **SECRET** | Credentials, keys, tokens, or any value that grants access to a system | API keys, database passwords, private keys, OAuth tokens, session tokens, `.env` values |
| **PII** | Personally Identifiable Information — data that can identify a natural person | Names, email addresses, phone numbers, IP addresses (when linked to a person), user IDs that map to real people |
| **SENSITIVE-BUSINESS** | Non-public business data that could cause harm if disclosed | Pricing models, unreleased feature names, customer lists, internal architecture diagrams |
| **INTERNAL** | Data not intended for public access but not individually harmful | Internal API responses, test fixture data, non-public configuration values |
| **PUBLIC** | Data safe to appear in any context | Public API schemas, open source library names, published documentation |

---

## Agent Handling Rules by Class

### SECRET

- **Never log, echo, or include in agent output.** Even in summarized or partial form.
- **Never include in spec, ADR, or task artifacts.** Reference the secret's purpose and location, not its value. Example: "uses `DATABASE_URL` from environment" — not the actual URL.
- **Never write to memory-store.md.** If a secret appears in input data, redact before any memory write.
- **If found in source code or config:** Flag immediately as a Security Agent finding (High severity). Do not include the value in the finding — reference line number and file only.
- **If accidentally written to an artifact:** Flag to Coordinator immediately. Treat as a blocking escalation.

### PII

- **Do not include real PII in specs, ADRs, test certifications, or examples.** Use synthetic data (e.g., `user@example.com`, `+1-555-555-0100`, `Jane Doe`).
- **Test fixtures must use synthetic PII only.** Never copy production user data into test fixtures.
- **If PII is encountered in source files during analysis:** Note that the system handles PII without quoting or logging the actual values.
- **Describe PII flows in architecture artifacts:** "User email is hashed before storage" — acceptable. Including actual email values in an ADR — not acceptable.

### SENSITIVE-BUSINESS

- **Do not include in external-facing artifacts** (e.g., public docs, open source examples).
- **Flag in spec if business sensitivity affects architecture decisions.** Example: "pricing logic must not be exposed via client-side code."
- Treat as INTERNAL within the pipeline — permitted in specs and ADRs, not in memory-store entries that may be shared.

### INTERNAL

- **Permitted in specs, ADRs, and task artifacts** where necessary for technical accuracy.
- **Include in memory-store only when relevant to future pipeline decisions** (e.g., "the internal reporting API rate-limits to 10 req/s").

### PUBLIC

No restrictions.

---

## Where Each Class Is Permitted

| Artifact | SECRET | PII | SENSITIVE-BUSINESS | INTERNAL | PUBLIC |
|----------|--------|-----|--------------------|----------|--------|
| provider-defined spec entrypoint (for example `feature.spec.md`) | ❌ | ❌ (synthetic only) | ⚠️ (flag in Agent Directives) | ✅ | ✅ |
| adr.md | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| tasks.md | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| test-certification.md | ❌ | ❌ (synthetic only) | ⚠️ | ✅ | ✅ |
| memory-store.md | ❌ | ❌ | ❌ | ✅ (when decision-relevant) | ✅ |
| agent handoff | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| source code (implementation) | ❌ (use env vars) | ⚠️ (only if required by spec, via approved pattern) | ✅ | ✅ | ✅ |

**❌ Never · ⚠️ With explicit flag/justification · ✅ Permitted**

---

## Secret Detection Rules

All agents must watch for patterns indicating a SECRET has appeared in their input or is about to appear in their output:

- Strings matching `[A-Za-z0-9+/]{32,}={0,2}` (base64-encoded credential shapes)
- Strings matching `sk-[A-Za-z0-9]{32,}`, `ghp_[A-Za-z0-9]{36}`, `AKIA[A-Z0-9]{16}` (known key prefixes)
- Values adjacent to keys named `password`, `secret`, `token`, `key`, `credential`, `auth`, `api_key`
- `.env` file contents
- Database connection strings containing `://`

On detection:
1. Stop before including the value in output
2. Redact: replace with `[REDACTED:<type>]` (e.g., `[REDACTED:API_KEY]`)
3. Flag to Coordinator as a SECRET exposure risk

---

## Secret Storage Policy (for agents advising on architecture)

When a spec requires storing or accessing secrets, the Software Architect and Programmer agents must follow this hierarchy:

1. **Environment variables** — preferred for runtime secrets
2. **Secrets manager** (AWS Secrets Manager, HashiCorp Vault, etc.) — required for production systems with rotation requirements
3. **Encrypted config file** — acceptable only for development environments, never committed with the key
4. **Plaintext config or source code** — never acceptable

The Security Agent must flag any architecture or implementation that stores secrets outside this hierarchy as a **High** finding.

---

## Compliance Linkage

- **Constitution Article VI (Security-by-Default):** Secret exposure violations are a constitution violation. The Coordinator logs a `[CONSTITUTION]` entry in memory-store.md.
- **Constitution Article VII (Spec Integrity):** PII handling requirements discovered mid-pipeline that are not in the spec route back to the Spec Agent — do not handle ad-hoc.
- **Tool Permission Policy:** Agents may not read files outside their assigned scope. This limits accidental secret exposure from filesystem reads.

---

## Synthetic Data Patterns for Tests

Use these patterns in test fixtures to avoid accidental PII:

| Data type | Synthetic pattern |
|-----------|-----------------|
| Email | `user-<NNN>@example.com` |
| Phone | `+1-555-000-<NNNN>` |
| Name | `Test User <NNN>` |
| User ID | `usr_test_<NNN>` |
| IP address | `203.0.113.<N>` (TEST-NET-3, RFC 5737) |
| Credit card | `4111 1111 1111 1111` (Visa test number) |
| API key | `test_key_<NNN>` or `sk-test-<random>` |
