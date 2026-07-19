import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test, vi } from "vitest";

// cli.ts is a `#!/usr/bin/env node` entrypoint: it runs `await main(process.argv.slice(2))`
// at the top level as soon as the module is evaluated. To get real, in-process v8 coverage
// of that top-level line (a subprocess run wouldn't be instrumented by this process's
// coverage collector), each case here mocks `process.argv`/`process.cwd`, spies on
// `process.stdout.write`, and re-imports the module fresh via `vi.resetModules()` — the
// same pattern this repo already uses for other side-effecting modules (see
// packages/ui/src/utils/notifications.test.ts and packages/ui/src/features/observability/install.test.ts).

const originalArgv = process.argv;
const cleanupRoots: string[] = [];

afterEach(async () => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  for (const root of cleanupRoots.splice(0)) {
    await rm(root, { force: true, recursive: true });
  }
});

async function createMetaJsonFixture(root: string, name: string): Promise<void> {
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n", "utf8");
  await writeFile(join(root, "package.json"), JSON.stringify({ name, private: true }, null, 2), "utf8");
  await writeFile(
    join(root, "meta.json"),
    JSON.stringify(
      {
        buildCommand: `pnpm --filter @jini/${name} build`,
        distEntries: ["dist/index.mjs"],
        inputs: ["src", "package.json"],
        packageName: `@jini/${name}`,
        toolName: name,
      },
      null,
      2,
    ),
    "utf8",
  );
  await mkdir(join(root, "dist"), { recursive: true });
  await writeFile(join(root, "dist", "index.mjs"), "export {};\n", "utf8");
}

async function runCli(args: string[]): Promise<string> {
  process.argv = ["node", "cli.js", ...args];
  const chunks: string[] = [];
  const writeSpy = vi.spyOn(process.stdout, "write");
  writeSpy.mockImplementation(((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stdout.write);
  vi.resetModules();
  await import("../cli.js");
  writeSpy.mockRestore();
  return chunks.join("");
}

test("throws a usage error for a command that is neither write nor check", async () => {
  process.argv = ["node", "cli.js", "bogus"];
  vi.resetModules();
  await assert.rejects(import("../cli.js"), /usage: cli\.ts <write\|check> \[tool-root\]/);
});

test("write subcommand defaults the tool root to the current working directory", async () => {
  const toolRoot = await mkdtemp(join(tmpdir(), "jini-metatool-cli-cwd-"));
  cleanupRoots.push(toolRoot);
  await createMetaJsonFixture(toolRoot, "cwd-default");
  vi.spyOn(process, "cwd").mockReturnValue(toolRoot);

  const stdout = await runCli(["write"]);

  const parsed = JSON.parse(stdout) as { hash: string; metadataPath: string };
  assert.equal(parsed.metadataPath, join(toolRoot, "dist", "metadata.json"));
  assert.equal(typeof parsed.hash, "string");
  assert.ok(parsed.hash.length > 0);
  const onDisk = JSON.parse(await readFile(parsed.metadataPath, "utf8")) as { build: { hash: string } };
  assert.equal(onDisk.build.hash, parsed.hash);
});

test("write subcommand resolves a relative tool-root argument against the cwd", async () => {
  const base = await mkdtemp(join(tmpdir(), "jini-metatool-cli-relroot-"));
  cleanupRoots.push(base);
  const toolRoot = join(base, "tool-root");
  await createMetaJsonFixture(toolRoot, "relative-root");
  vi.spyOn(process, "cwd").mockReturnValue(base);

  const stdout = await runCli(["write", "tool-root"]);

  const parsed = JSON.parse(stdout) as { hash: string; metadataPath: string };
  assert.equal(parsed.metadataPath, join(toolRoot, "dist", "metadata.json"));
});

test("check subcommand reports freshness for a build with matching metadata (absolute tool-root arg)", async () => {
  const toolRoot = await mkdtemp(join(tmpdir(), "jini-metatool-cli-check-"));
  cleanupRoots.push(toolRoot);
  await createMetaJsonFixture(toolRoot, "check-fresh");

  await runCli(["write", toolRoot]);
  const stdout = await runCli(["check", toolRoot]);

  const parsed = JSON.parse(stdout) as { hash: string; metadataPath: string };
  assert.equal(parsed.metadataPath, join(toolRoot, "dist", "metadata.json"));
  assert.equal(typeof parsed.hash, "string");
});
