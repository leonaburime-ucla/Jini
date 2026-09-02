import assert from "node:assert/strict";
import { test } from "vitest";

import type { ToolExecutionContext } from "@jini-ai/core";

import { buildMediaRegistrations, type MediaToolDeps } from "../tool-registrations.js";
import { InMemoryAssetBlobRepo, InMemoryAssetRenditionRepo, InMemoryMediaRepo } from "../repo.memory.js";
import { InMemoryBlobStore } from "../blob-store.memory.js";
import type { MediaRecord } from "../types.js";

/**
 * Covers `media_upload_asset`'s {@link MediaToolDeps.recordUploadContentType} hook — the fix for the
 * defect where an asset uploaded through this tool never had ANY content type recorded anywhere
 * (`uploadMedia`/`AssetBlobRecord` deliberately carry no such field — see `media-service.ts`'s own
 * file header), unlike `media_generate_asset` and the HTTP admin upload route, both of which record
 * one through a host-owned content-type store. See this file's sibling `resolvePublicUrls` coverage
 * pattern (`buildMediaRegistrations`'s own header) for why this is another OPTIONAL, host-injected
 * hook rather than a hard dependency: a host with no such store must keep compiling and behaving
 * exactly as before (hook omitted -> never called -> `publicUrl`'s own precedent for "omitted stays
 * silent, no throw").
 */

const WORKSPACE_ID = "ws-media-tool-registrations";
const PRINCIPAL_ID = "principal-under-test";
const NOW = "2026-09-02T00:00:00.000Z";

function executionContext(input: Record<string, unknown>): ToolExecutionContext {
  return { executionId: "exec-1", principal: { id: PRINCIPAL_ID }, run: { id: "run-1" }, input, signal: new AbortController().signal };
}

function fakeDeps(overrides: Partial<MediaToolDeps> = {}): { deps: MediaToolDeps; mediaRepo: InMemoryMediaRepo } {
  const mediaRepo = new InMemoryMediaRepo();
  let counter = 0;
  const deps: MediaToolDeps = {
    authorize: async () => ({ allowed: true, reason: "matched" }),
    workspaceId: WORKSPACE_ID,
    clock: { nowIso: () => NOW },
    idGen: { newId: () => `id-${++counter}` },
    mediaRepo,
    assetBlobRepo: new InMemoryAssetBlobRepo(),
    assetRenditionRepo: new InMemoryAssetRenditionRepo(),
    blobStore: new InMemoryBlobStore(),
    ...overrides,
  };
  return { deps, mediaRepo };
}

// A real PNG signature so a future sniff-based assertion has genuine magic bytes to check, not an
// arbitrary string — mirrors `media-generation`'s own `FAKE_PNG_BYTES` convention, but with a real
// leading signature rather than an arbitrary string, since Defect 2's whole point is bytes vs.
// declared-string fidelity.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xde, 0xad, 0xbe, 0xef]);

test("media_upload_asset calls recordUploadContentType with the uploaded bytes and the saved media row, when the hook is provided", async () => {
  const recorded: Array<{ media: MediaRecord; bytes: Uint8Array }> = [];
  const { deps } = fakeDeps({
    recordUploadContentType: async (params) => {
      recorded.push(params);
    },
  });
  const registrations = buildMediaRegistrations(deps);
  const upload = registrations.find((r) => r.descriptor.id === "media_upload_asset");
  assert.ok(upload, "media_upload_asset must be wired");

  const result = (await upload.handler(
    executionContext({ dataBase64: PNG_BYTES.toString("base64"), filename: "logo.png", contentType: "image/png" })
  )) as { media: { id: string } };

  assert.equal(recorded.length, 1, "the hook must be called exactly once per upload");
  assert.equal(recorded[0]!.media.id, result.media.id, "the hook must receive the SAME media row the tool just saved");
  assert.deepEqual(Buffer.from(recorded[0]!.bytes), PNG_BYTES, "the hook must receive the exact uploaded bytes, not a re-derived or re-encoded copy");
});

test("media_upload_asset without the hook configured behaves exactly as before — no throw, upload still succeeds", async () => {
  const { deps } = fakeDeps(); // no recordUploadContentType at all
  const registrations = buildMediaRegistrations(deps);
  const upload = registrations.find((r) => r.descriptor.id === "media_upload_asset");
  assert.ok(upload);

  const result = (await upload.handler(
    executionContext({ dataBase64: PNG_BYTES.toString("base64"), filename: "logo.png", contentType: "image/png" })
  )) as { media: { id: string } };

  assert.ok(result.media.id, "upload must still succeed when no host has opted into content-type recording");
});

test("a hook that throws propagates — an upload must not be silently reported successful if recording the type fails", async () => {
  const { deps } = fakeDeps({
    recordUploadContentType: async () => {
      throw new Error("content-type store unavailable");
    },
  });
  const registrations = buildMediaRegistrations(deps);
  const upload = registrations.find((r) => r.descriptor.id === "media_upload_asset");
  assert.ok(upload);

  await assert.rejects(
    () => upload.handler(executionContext({ dataBase64: PNG_BYTES.toString("base64"), filename: "logo.png", contentType: "image/png" })),
    /content-type store unavailable/
  );
});
