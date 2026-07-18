import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectLogSource, collectLogSources, findMacOSCrashReports } from "./sources.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "diagnostics-sources-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("collectLogSource / collectLogSources", () => {
  it("reads the whole file when tailBytes is omitted", async () => {
    const filePath = join(tempDir, "whole.log");
    await writeFile(filePath, "hello world", "utf8");

    const collected = await collectLogSource({ name: "whole.log", absolutePath: filePath, kind: "text" });

    expect(collected.content).toBe("hello world");
    expect(collected.bytes).toBe(11);
    expect(collected.error).toBeUndefined();
  });

  it("reads the whole file when tailBytes is zero or negative", async () => {
    const filePath = join(tempDir, "zero-tail.log");
    await writeFile(filePath, "full content", "utf8");

    const zero = await collectLogSource({ name: "zero-tail.log", absolutePath: filePath, kind: "text", tailBytes: 0 });
    const negative = await collectLogSource({
      name: "zero-tail.log",
      absolutePath: filePath,
      kind: "text",
      tailBytes: -5,
    });

    expect(zero.content).toBe("full content");
    expect(negative.content).toBe("full content");
  });

  it("reads the whole file via the tail path when the file is not larger than tailBytes", async () => {
    const filePath = join(tempDir, "small.log");
    await writeFile(filePath, "short", "utf8");

    const collected = await collectLogSource({ name: "small.log", absolutePath: filePath, kind: "text", tailBytes: 1024 });

    expect(collected.content).toBe("short");
    expect(collected.bytes).toBe(5);
  });

  it("reads only the trailing window for files larger than tailBytes", async () => {
    const filePath = join(tempDir, "big.log");
    const content = "0123456789".repeat(50); // 500 bytes
    await writeFile(filePath, content, "utf8");

    const collected = await collectLogSource({ name: "big.log", absolutePath: filePath, kind: "text", tailBytes: 20 });

    expect(collected.content).toBe(content.slice(-20));
    expect(collected.bytes).toBe(20);
  });

  it("redacts JSON-kind sources through redactJsonText", async () => {
    const filePath = join(tempDir, "data.json");
    await writeFile(filePath, JSON.stringify({ token: "shh", note: "ok" }), "utf8");

    const collected = await collectLogSource({ name: "data.json", absolutePath: filePath, kind: "json" });

    const parsed = JSON.parse(collected.content ?? "{}");
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.note).toBe("ok");
  });

  it("returns a null-content entry with the error message when the file cannot be read", async () => {
    const collected = await collectLogSource({
      name: "missing.log",
      absolutePath: join(tempDir, "does-not-exist.log"),
      kind: "text",
    });

    expect(collected.content).toBeNull();
    expect(collected.bytes).toBe(0);
    expect(collected.error).toMatch(/ENOENT/);
  });

  it("collects multiple sources concurrently", async () => {
    const a = join(tempDir, "a.log");
    const b = join(tempDir, "b.log");
    await writeFile(a, "a-content", "utf8");
    await writeFile(b, "b-content", "utf8");

    const collected = await collectLogSources([
      { name: "a.log", absolutePath: a, kind: "text" },
      { name: "b.log", absolutePath: b, kind: "text" },
    ]);

    expect(collected.map((entry) => entry.content)).toEqual(["a-content", "b-content"]);
  });
});

/**
 * The scan logic in `findMacOSCrashReports` only runs on darwin (it early-
 * returns `[]` for every other platform — see sources.ts). Running this
 * suite on a non-darwin CI host (Linux, in this repo) means the real
 * scan branches are never reached unless the test stubs `process.platform`
 * for its own duration, the same way the "non-darwin" test below stubs it
 * to `"linux"`. Without this stub these tests either fail (the crash-report
 * assertions expect real matches) or pass vacuously (an assertion of `[]`
 * is trivially satisfied by the platform guard alone, never exercising the
 * scan). This helper makes every darwin-only test genuinely run the darwin
 * code path regardless of host OS.
 */
async function withDarwinPlatform<T>(fn: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, "platform", originalDescriptor);
  }
}

describe("findMacOSCrashReports", () => {
  it("returns [] immediately on non-darwin platforms", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      const result = await findMacOSCrashReports({ matchSubstrings: ["anything"], searchDirs: [tempDir] });
      expect(result).toEqual([]);
    } finally {
      Object.defineProperty(process, "platform", originalDescriptor);
    }
  });

  it("filters by substring/recency/file-type, sorts newest first, and honors maxReports", async () => {
    const newest = join(tempDir, "MyApp-2024-report.crash");
    const older = join(tempDir, "myapp-older.crash");
    const stale = join(tempDir, "MyApp-too-old.crash");
    const unrelated = join(tempDir, "unrelated.log");
    const dirLikeMatch = join(tempDir, "MyApp-dir-report.crash");
    const brokenLink = join(tempDir, "MyApp-broken-link.crash");

    await writeFile(newest, "log", "utf8");
    await utimes(newest, new Date(), new Date());
    await writeFile(older, "log", "utf8");
    await utimes(older, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    await writeFile(stale, "log", "utf8");
    await utimes(stale, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    await writeFile(unrelated, "log", "utf8");
    await mkdir(dirLikeMatch, { recursive: true });
    await symlink(join(tempDir, "does-not-exist-target"), brokenLink);

    await withDarwinPlatform(async () => {
      const all = await findMacOSCrashReports({
        matchSubstrings: ["MyApp"],
        searchDirs: [tempDir, join(tempDir, "does-not-exist-subdir")],
        withinDays: 7,
        maxReports: 5,
      });
      expect(all.map((entry) => entry.name)).toEqual([
        "crash-reports/MyApp-2024-report.crash",
        "crash-reports/myapp-older.crash",
      ]);
      expect(all[0]?.kind).toBe("text");

      const limited = await findMacOSCrashReports({
        matchSubstrings: ["MyApp"],
        searchDirs: [tempDir],
        withinDays: 7,
        maxReports: 1,
      });
      expect(limited).toHaveLength(1);
      expect(limited[0]?.name).toBe("crash-reports/MyApp-2024-report.crash");
    });
  });

  it("derives ~/Library/Logs/DiagnosticReports from homeDir and uses default withinDays/maxReports", async () => {
    const homeDir = tempDir;
    const reportsDir = join(homeDir, "Library/Logs/DiagnosticReports");
    await mkdir(reportsDir, { recursive: true });
    await writeFile(join(reportsDir, "HomeApp-crash.crash"), "log", "utf8");

    await withDarwinPlatform(async () => {
      const result = await findMacOSCrashReports({ matchSubstrings: ["homeapp"], homeDir });

      expect(result).toHaveLength(1);
      expect(result[0]?.absolutePath).toBe(join(reportsDir, "HomeApp-crash.crash"));
    });
  });

  it("uses only the built-in default darwin dirs when neither homeDir nor searchDirs is given", async () => {
    await withDarwinPlatform(async () => {
      const result = await findMacOSCrashReports({ matchSubstrings: ["no-such-app-xyz-shouldnt-match"] });
      expect(result).toEqual([]);
    });
  });
});
