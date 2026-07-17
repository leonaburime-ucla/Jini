import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";

import {
  assertFreshToolBuild,
  type ToolBuildMetadataPolicy,
  writeToolBuildMetadata,
} from "./index.js";

async function createFreshBuild(name: string): Promise<{ policy: ToolBuildMetadataPolicy; toolRoot: string }> {
  const toolRoot = await createToolFixture(name);
  const policy = policyFor(name);
  await writeToolBuildMetadata(policy, toolRoot);
  return { policy, toolRoot };
}

function policyFor(name: string): ToolBuildMetadataPolicy {
  return {
    buildCommand: `pnpm --filter @jini/${name} build`,
    distEntries: ["dist/index.mjs"],
    inputs: ["src", "package.json", "esbuild.config.mjs", "tsconfig.json"],
    packageName: `@jini/${name}`,
    toolName: name,
  };
}

async function createToolFixture(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `jini-metatool-${name}-`));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "index.ts"), "export const value = 1;\n", "utf8");
  await writeFile(join(root, "package.json"), JSON.stringify({ name, private: true }, null, 2), "utf8");
  await writeFile(join(root, "esbuild.config.mjs"), "export default {};\n", "utf8");
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext" } }, null, 2), "utf8");
  await mkdir(join(root, "dist"), { recursive: true });
  await writeFile(join(root, "dist", "index.mjs"), "export {};\n", "utf8");
  return root;
}

test("writeToolBuildMetadata writes the expected build hash shape", async () => {
  const toolRoot = await createToolFixture("tools-dev");
  const policy = policyFor("tools-dev");
  try {
    const { hash, metadataPath } = await writeToolBuildMetadata(policy, toolRoot);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    assert.deepEqual(metadata, { build: { hash } });
    await assert.doesNotReject(assertFreshToolBuild(policy, toolRoot));
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("assertFreshToolBuild fails when source hash drifts from dist metadata", async () => {
  const toolRoot = await createToolFixture("tools-serve");
  const policy = policyFor("tools-serve");
  try {
    await writeToolBuildMetadata(policy, toolRoot);
    await writeFile(join(toolRoot, "src", "index.ts"), "export const value = 2;\n", "utf8");
    await assert.rejects(
      assertFreshToolBuild(policy, toolRoot),
      /build metadata hash mismatch/,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("assertFreshToolBuild fails when a declared dist entry is missing on disk", async () => {
  const { policy, toolRoot } = await createFreshBuild("tools-missing-dist");
  try {
    await rm(join(toolRoot, "dist", "index.mjs"), { force: true });
    await assert.rejects(
      assertFreshToolBuild(policy, toolRoot),
      /dist entries not found:.*index\.mjs/s,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("assertFreshToolBuild fails when no build metadata file exists yet", async () => {
  const toolRoot = await createToolFixture("tools-no-metadata");
  const policy = policyFor("tools-no-metadata");
  try {
    await assert.rejects(
      assertFreshToolBuild(policy, toolRoot),
      /build metadata missing or invalid at/,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("assertFreshToolBuild fails when the recorded build hash is an empty string", async () => {
  const { policy, toolRoot } = await createFreshBuild("tools-empty-hash");
  try {
    await writeFile(
      join(toolRoot, "dist", "metadata.json"),
      JSON.stringify({ build: { hash: "" } }, null, 2),
      "utf8",
    );
    await assert.rejects(
      assertFreshToolBuild(policy, toolRoot),
      /build metadata missing or invalid at/,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("assertFreshToolBuild fails when the recorded build hash is not a string", async () => {
  const { policy, toolRoot } = await createFreshBuild("tools-nonstring-hash");
  try {
    await writeFile(
      join(toolRoot, "dist", "metadata.json"),
      JSON.stringify({ build: { hash: 12345 } }, null, 2),
      "utf8",
    );
    await assert.rejects(
      assertFreshToolBuild(policy, toolRoot),
      /build metadata missing or invalid at/,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("assertFreshToolBuild fails when the metadata file contains unparsable JSON", async () => {
  const { policy, toolRoot } = await createFreshBuild("tools-malformed-metadata");
  try {
    await writeFile(join(toolRoot, "dist", "metadata.json"), "{not valid json", "utf8");
    await assert.rejects(
      assertFreshToolBuild(policy, toolRoot),
      /build metadata missing or invalid at/,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("computeToolSourceHash hashes a symlink as its own entry instead of following it", async () => {
  const toolRoot = await createToolFixture("tools-symlink");
  const policy = policyFor("tools-symlink");
  try {
    await symlink(join(toolRoot, "src", "index.ts"), join(toolRoot, "src", "index-link.ts"));
    const { hash } = await writeToolBuildMetadata(policy, toolRoot);
    assert.equal(typeof hash, "string");
    assert.ok(hash.length > 0);
    await assert.doesNotReject(assertFreshToolBuild(policy, toolRoot));
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});

test("computeToolSourceHash throws when a declared input path is missing from disk", async () => {
  const toolRoot = await createToolFixture("tools-missing-input");
  const policy: ToolBuildMetadataPolicy = { ...policyFor("tools-missing-input"), inputs: ["src", "does-not-exist.txt"] };
  try {
    await assert.rejects(
      writeToolBuildMetadata(policy, toolRoot),
      /required build input missing:.*does-not-exist\.txt/,
    );
  } finally {
    await rm(toolRoot, { force: true, recursive: true });
  }
});
