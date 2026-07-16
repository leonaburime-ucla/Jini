/**
 * Jini repo guard — aggregates the boundary + neutrality checks.
 * Run via `pnpm guard`. See docs/jini-port/extraction-plan.md §7 (guardrails) and §12 C-series.
 *
 * STATUS: skeleton. The rule engine (AST via ts.resolveModuleName, modeled on OD's
 * scripts/check-web-slice-boundaries.ts) is implemented in the two checks below.
 */
import { checkEngineBoundaries } from './check-engine-boundaries.js';
import { checkProtocolPurity } from './check-protocol-purity.js';

async function main() {
  const results = [
    await checkEngineBoundaries(),
    await checkProtocolPurity(),
    // TODO: product-neutrality string scan (no "Open Design"/OD_/--od-stamp in packages/@jini/**)
    // TODO: vocabulary-firewall check (automation/** must not import engine domain types)
    // TODO: residual-JS allowlist
  ];
  const violations = results.flat();
  if (violations.length) {
    for (const v of violations) console.error(`[guard] ${v.rule} ${v.file}: ${v.reason}`);
    console.error(`\n${violations.length} guard violation(s).`);
    process.exit(1);
  }
  console.log('[guard] ok (skeleton — rules pending implementation during extraction)');
}
main();
