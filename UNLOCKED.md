# Unlocked package admission manifest

Every `packages/*` directory NOT in `docs/jini-port/extraction-plan.md` §3's locked 14-package
set must have an entry here. This is the package-admission manifest the 2026-07-19 swarm-consensus
architecture debate recommended (`ADS-memory/reports/swarm-consensus/runs/2026-07-19T1632-consensus-report.md`)
after finding 9 packages had been added ad hoc, without the Coordinator/Software-Architect
sign-off `AGENTS.md` says is required, and at least 2 (`capability-providers`, `metatool`)
admitting zero consumers in their own `source-map.md` files.

**Enforcement:** `scripts/check-engine-boundaries.ts` reads the fenced JSON block below. A locked
package (one of the §3 fourteen) may not import an unlocked package unless that package's
`status` is `"stable"`. This is a first-pass classification — sign-off is still `PENDING` for
every entry; see the "Promotion" section below for what changes that.

## Manifest

```json
{
  "@jini/artifacts": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Not ad hoc sprawl like the other 9 entries here — moved OUT of @jini/daemon's kernel token set on 2026-07-19 to fix a locked-rule violation (ArtifactStoreToken sat alongside genuine kernel tokens). Zero consumers confirmed before the move. Listed here because it is, structurally, an unlocked package like the rest: not in extraction-plan.md §3's 14, needs the same named-consumer promotion path."
  },
  "@jini/deploy": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "DeployTarget many-token port + Vercel/Cloudflare Pages adapters. Named only in extraction-plan.md §10's roadmap-appendix prose (Netlify/Vercel/GitHub Pages wishlist), not §3's locked set."
  },
  "@jini/registry": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Pluggable static/GitHub/database registry backends. Not named anywhere in extraction-plan.md."
  },
  "@jini/memory": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Frontmatter note-store + extraction-attempt log + self-verify scorecard enforcer. Not named anywhere in extraction-plan.md."
  },
  "@jini/media": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Multi-provider image/video/audio generation gateway substrate. Not named anywhere in extraction-plan.md."
  },
  "@jini/capability-providers": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Greenfield, no OD source. Own source-map.md states: 'This package currently has NO identified consumer.' Named aspirational future consumers (Zana, Tovu-Runner) per docs/jini-port/recon/r5b-consumers-matrix.md, but neither is confirmed today. Highest-priority candidate for archival if not promoted soon."
  },
  "@jini/desktop-host": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "extraction-plan.md §3 explicitly deferred this 'until a 2nd host exists'; built ahead of that deferral by explicit human decision on 2026-07-17. No second host consumer confirmed today."
  },
  "@jini/diagnostics": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Not named anywhere in extraction-plan.md; not even listed in AGENTS.md's own package inventory (stale by 3 packages per the 2026-07-19 debate's Round 3 finding)."
  },
  "@jini/mcp": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Not named anywhere in extraction-plan.md; not even listed in AGENTS.md's own package inventory."
  },
  "@jini/metatool": {
    "status": "incubating",
    "consumers": [],
    "lockedPackagesMayImport": false,
    "signOff": "PENDING",
    "note": "Own source-map.md states: 'Ported speculatively with no current consumer... likely not needed by an engine.' No other package in this repo imports it. Highest-priority candidate for archival alongside capability-providers."
  }
}
```

## Promotion requirements (per the 2026-07-19 debate's convergence)

An entry graduates from `"incubating"` to `"stable"` only when ALL of the following are true,
matching the same two-consumer-rule discipline `extraction-plan.md` §7 already applies to new
kernel tokens/protocol event families (this manifest exists because that rule was never extended
to whole new *packages* — see the debate report's Divergence/Agreement sections):

1. At least one real, named consumer (an actual external repo, not an aspirational one) depends
   on the package via a packed tarball, not a workspace link.
2. An API snapshot review has been done and recorded.
3. The package passes through `examples/minimal-host`'s packed-release-slice test
   (`scripts/health-boot.ts`) without requiring product-shaped concepts.
4. Coordinator + Software-Architect sign-off is recorded in this file (`signOff` field updated
   from `PENDING` to a date + reviewer).

Until then, `lockedPackagesMayImport: false` is enforced by `scripts/check-engine-boundaries.ts`:
none of the 14 locked packages may import any package listed here.
