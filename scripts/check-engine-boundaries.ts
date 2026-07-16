/**
 * R1: packages/@jini/** must not import apps/**, integrations/**, examples/**, automation/**.
 * R2: engine packages import each other only by package name (no deep paths).
 * R4: integrations/** may import @jini/* but never vice-versa.
 * R5: no product-identity strings in packages/@jini/**.
 * Model on OD scripts/check-cross-app-imports.ts (AST + ts.resolveModuleName). SKELETON.
 */
export type Violation = { rule: string; file: string; reason: string };

export async function checkEngineBoundaries(): Promise<Violation[]> {
  // TODO: walk packages/**/src, parse imports with typescript, resolve, classify target dir, flag forbidden edges.
  return [];
}
