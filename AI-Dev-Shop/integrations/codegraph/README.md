# codegraph (candidate backend)

> **Tier: candidate.** Clone/audit-only — **not vendored**. A fresh clone of AI Dev
> Shop does **not** contain codegraph's source; only this stub ships. The toolkit
> obtains it on demand, behind a human checkpoint, via the capability validator.

codegraph is a local code-intelligence graph backend (callers / change-impact /
explore / structural query). It fills the `callers` and `change_impact` query
classes in the [`code-navigation`](../../skills/code-navigation/SKILL.md) routing
table when Codebase Memory MCP is unavailable.

| | |
|---|---|
| Upstream | https://github.com/colbymchenry/codegraph (MIT) |
| Pinned ref | `7a361ef` (v1.1.1) |
| Requirements | `node` >=20 <25, `npm`, `git` — **no API key, 100% local** |
| Install footprint | npm deps + a `dist/` build; index written to `<target>/.codegraph/` |
| Managed checkout | `integrations/codegraph/upstream/` (gitignored) |
| Built entrypoint | `integrations/codegraph/upstream/dist/bin/codegraph.js` (run via `node`) |

## Install (human-approved, on demand)

Do not install silently. When CodeBase Analyzer determines codegraph is the right
backend and it is absent, it surfaces the guided-install menu (see
[`backends.manifest.json`](../backends.manifest.json)) and, only on approval:

```bash
# clone the pinned upstream, then build dist/bin/codegraph.js
bash harness-engineering/validators/check_codegraph_capability.sh --download --build
```

Re-check status (read-only) any time:

```bash
bash harness-engineering/validators/check_codegraph_capability.sh
# overall_status: enabled | unverified (needs --build) | unavailable (needs --download)
```

## Use

```bash
CG=integrations/codegraph/upstream/dist/bin/codegraph.js
node "$CG" init    <target>                 # one-time index -> <target>/.codegraph/
node "$CG" callers <symbol> -p <target> --json
node "$CG" impact  <symbol> -p <target> --json
node "$CG" explore "<query>" -p <target> --json
node "$CG" query   "<pattern>" -p <target> --json
```

Deep routing and validation discipline live in
[`skills/codebase-graph/SKILL.md`](../../skills/codebase-graph/SKILL.md) →
"Candidate Backends". codegraph output is a hypothesis until validated against
source; `rg` remains the terminal fallback.
