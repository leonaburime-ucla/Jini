import { describe, expect, it, vi } from "vitest";

// collectLogSource's catch clause types `error` as `unknown` (TypeScript's
// mandatory shape for `catch`) and normalizes it with
// `error instanceof Error ? error.message : String(error)`. In real usage
// every node:fs/promises call here rejects with an Error/ErrnoException, so
// the `String(error)` fallback has no trigger via a real file-system failure.
// It IS a genuinely reachable branch though — `catch` can observe anything a
// callee throws, and readFile is a plain injectable function — so this
// mocks just `readFile` (keeping every other fs/promises export real) to
// force a non-Error throw and prove the fallback stringifies it correctly,
// rather than special-casing it away as untestable.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(async () => {
      throw "boom: a non-Error thrown value";
    }),
  };
});

const { collectLogSource } = await import("./sources.js");

describe("collectLogSource error normalization", () => {
  it("stringifies a thrown non-Error value into the error field", async () => {
    const collected = await collectLogSource({
      name: "x.log",
      absolutePath: "/irrelevant/path.log",
      kind: "text",
    });

    expect(collected.content).toBeNull();
    expect(collected.bytes).toBe(0);
    expect(collected.error).toBe("boom: a non-Error thrown value");
  });
});
