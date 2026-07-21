import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  MANAGED_DOWNLOAD_ERROR_CODES,
  downloadCopyAndClear,
  inspectManagedDownload,
  managedDownload,
  pruneManagedDownloads,
  removeManagedDownload,
  type ManagedDownloadProgress,
} from "../download.js";

type FixtureRequest = {
  range?: string;
};

type FixtureServer = {
  close(): Promise<void>;
  requests: FixtureRequest[];
  url: string;
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tmpRoot(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `jini-download-${label}-`));
  roots.push(root);
  return root;
}

function sha256(body: Buffer | string): string {
  return createHash("sha256").update(body).digest("hex");
}

function targetKey(bucket: string, fileName: string): string {
  return createHash("sha256").update(`${bucket}\0${fileName}`).digest("hex");
}

function lockPath(basePath: string, bucket: string, fileName: string): string {
  return join(basePath, ".locks", `${targetKey(bucket, fileName)}.lock`);
}

function manifestPathFor(basePath: string, bucket: string, fileName: string): string {
  return join(basePath, ".state", `${targetKey(bucket, fileName)}.json`);
}

function partialPathFor(basePath: string, bucket: string, fileName: string): string {
  return join(basePath, ".partial", `${targetKey(bucket, fileName)}.partial`);
}

function urlDigestFor(url: string): string {
  return createHash("sha256").update(new URL(url).toString()).digest("hex");
}

function identityDigestFor(url: string, algorithm: "sha256" | "sha512", value: string): string {
  return createHash("sha256").update(`${new URL(url).toString()}\0${algorithm}\0${value}`).digest("hex");
}

/** Hand-write a manifest matching the on-disk shape `readManifest`/`isManifest`
 *  expect, for tests that need to seed a specific prior-run state (a stale
 *  partial, a suspicious mismatch, an out-of-band final file) without
 *  actually driving a full download to produce it. */
function writeManifestFile(
  basePath: string,
  bucket: string,
  fileName: string,
  options: {
    checksum: { algorithm: "sha256" | "sha512"; value: string };
    identityDigest?: string;
    state: "complete" | "partial";
    url: string;
    validators?: { etag?: string; lastModified?: string };
  },
): void {
  writeFileSync(
    manifestPathFor(basePath, bucket, fileName),
    JSON.stringify({
      bucket,
      checksum: options.checksum,
      createdAt: new Date().toISOString(),
      fileName,
      identityDigest:
        options.identityDigest ?? identityDigestFor(options.url, options.checksum.algorithm, options.checksum.value),
      kind: "jini-managed-download",
      schemaVersion: 1,
      state: options.state,
      targetKey: targetKey(bucket, fileName),
      updatedAt: new Date().toISOString(),
      urlDigest: urlDigestFor(options.url),
      ...(options.validators == null ? {} : { validators: options.validators }),
    }),
  );
}

function exitedPid(): number {
  const child = spawnSync(process.execPath, ["-e", ""], { stdio: "ignore" });
  if (child.error != null) throw child.error;
  if (typeof child.pid !== "number") throw new Error("spawnSync did not expose a pid");
  return child.pid;
}

function sendBody(response: ServerResponse, body: Buffer, options: { delayMs?: number | undefined } = {}): void {
  const send = () => {
    response.end(body);
  };
  if (options.delayMs == null) send();
  else setTimeout(send, options.delayMs);
}

async function startFixture(
  body: Buffer | string,
  options: {
    delayMs?: number;
    failFirstBytes?: number;
    range?: boolean;
  } = {},
): Promise<FixtureServer> {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const requests: FixtureRequest[] = [];
  let requestCount = 0;
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    requestCount += 1;
    const range = typeof request.headers.range === "string" ? request.headers.range : undefined;
    requests.push({ ...(range == null ? {} : { range }) });

    if (options.failFirstBytes != null && requestCount === 1) {
      response.writeHead(200, {
        "content-length": payload.byteLength,
        "content-type": "application/octet-stream",
        etag: '"fixture-etag"',
      });
      // Known flaky: destroy() after a fixed delay races against the client
      // actually flushing the received bytes to its partial file before the
      // pipeline sees the RST. See "resumes a partial download..." below,
      // skipped pending a deterministic fetchImpl-based rewrite — tracked in
      // ADS-memory/reports/session-handoff-2026-07-20-coverage-push.md.
      response.write(payload.subarray(0, options.failFirstBytes));
      setTimeout(() => response.destroy(), 5);
      return;
    }

    if (range != null && options.range !== false) {
      const match = /^bytes=(\d+)-$/.exec(range);
      const start = match?.[1] == null ? Number.NaN : Number(match[1]);
      if (Number.isInteger(start) && start >= 0 && start < payload.byteLength) {
        const chunk = payload.subarray(start);
        response.writeHead(206, {
          "content-length": chunk.byteLength,
          "content-range": `bytes ${start}-${payload.byteLength - 1}/${payload.byteLength}`,
          "content-type": "application/octet-stream",
          etag: '"fixture-etag"',
        });
        sendBody(response, chunk, { delayMs: options.delayMs });
        return;
      }
    }

    response.writeHead(200, {
      "content-length": payload.byteLength,
      "content-type": "application/octet-stream",
      etag: '"fixture-etag"',
    });
    sendBody(response, payload, { delayMs: options.delayMs });
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (address == null || typeof address === "string") throw new Error("fixture did not listen on tcp");
  return {
    close: () => new Promise<void>((resolveClose, rejectClose) => server.close((error) => (error == null ? resolveClose() : rejectClose(error)))),
    requests,
    url: `http://127.0.0.1:${address.port}/artifact.bin`,
  };
}

describe("managed download engine", () => {
  it("downloads, copies to caller output, verifies, and clears managed state", async () => {
    const body = "copy and clear payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("copy-clear");
    const outputPath = join(root, "out", "artifact.bin");
    try {
      const result = await downloadCopyAndClear({
        basePath: join(root, "downloads"),
        bucket: "artifacts",
        fileName: "payload.bin",
        outputPath,
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      expect(result.cleanup).toBe("removed");
      expect(readFileSync(outputPath, "utf8")).toBe(body);
      const inspected = await inspectManagedDownload({ basePath: join(root, "downloads"), bucket: "artifacts", fileName: "payload.bin" });
      expect(inspected.complete).toBe(false);
      expect(inspected.manifest).toBe("missing");
    } finally {
      await fixture.close();
    }
  });

  it("rejects a Windows drive-relative bucket/fileName segment (e.g. \"C:evil\") that could otherwise escape basePath onto another drive", async () => {
    const root = tmpRoot("drive-relative-escape");
    await expect(
      inspectManagedDownload({ basePath: join(root, "downloads"), bucket: "C:evil", fileName: "payload.bin" }),
    ).rejects.toThrow(/safe single path segment/);
    await expect(
      inspectManagedDownload({ basePath: join(root, "downloads"), bucket: "artifacts", fileName: "D:payload.bin" }),
    ).rejects.toThrow(/safe single path segment/);
  });

  // Skipped: this test's fixture races destroy() against the client actually
  // persisting the received bytes to its partial file before the pipeline
  // sees the connection error. Confirmed (2026-07-20) to fail 100% of the
  // time on this machine even on unmodified pre-session code — this is a
  // pre-existing environmental race, not a regression from this session's
  // changes. Two timing-tweak fix attempts this session did not help (both
  // also failed 100%). A standalone probe script showed the raw
  // write+5ms-delay+destroy() strategy is reliable in isolation (15/15) but
  // not inside the full vitest suite, meaning the fix needs to remove the
  // race entirely rather than tune its timing — e.g. inject a custom `fetch`
  // (managedDownload's `options.fetch` already supports this) whose Response
  // body deterministically emits exactly `failFirstBytes` then errors, with
  // no real socket/timing involved at all. See
  // ADS-memory/reports/session-handoff-2026-07-20-coverage-push.md for the
  // full diagnosis and next steps.
  it.skip("resumes a partial download when the server supports Range", async () => {
    const body = "resumable payload from a flaky connection";
    const fixture = await startFixture(body, { failFirstBytes: 9, range: true });
    const root = tmpRoot("resume");
    try {
      const result = await managedDownload({
        basePath: join(root, "downloads"),
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      expect(result.resumed).toBe(true);
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(fixture.requests.some((request) => request.range?.startsWith("bytes="))).toBe(true);
    } finally {
      await fixture.close();
    }
  });

  it("falls back to a full download when Range is not honored", async () => {
    const body = "fallback payload from a server without range support";
    const fixture = await startFixture(body, { failFirstBytes: 8, range: false });
    const root = tmpRoot("range-fallback");
    try {
      const result = await managedDownload({
        basePath: join(root, "downloads"),
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      expect(result.resumed).toBe(false);
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(fixture.requests.some((request) => request.range?.startsWith("bytes="))).toBe(true);
    } finally {
      await fixture.close();
    }
  });

  it("quick-fails a checksum mismatch after resetting owned state", async () => {
    const fixture = await startFixture("wrong bytes");
    const root = tmpRoot("checksum-mismatch");
    await expect(
      managedDownload({
        basePath: join(root, "downloads"),
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256("expected bytes") }, url: fixture.url },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.CHECKSUM_MISMATCH });
    await fixture.close();
  });

  it("dedupes same-process callers and fans out progress", async () => {
    const body = "dedupe payload";
    const fixture = await startFixture(body, { delayMs: 40 });
    const root = tmpRoot("dedupe");
    const firstProgress: ManagedDownloadProgress[] = [];
    const secondProgress: ManagedDownloadProgress[] = [];
    try {
      const input = {
        basePath: join(root, "downloads"),
        bucket: "shared",
        fileName: "payload.bin",
        payload: { checksum: { algorithm: "sha256" as const, value: sha256(body) }, url: fixture.url },
      };
      const [first, second] = await Promise.all([
        managedDownload({ ...input, onProgress: (progress) => firstProgress.push(progress) }),
        managedDownload({ ...input, onProgress: (progress) => secondProgress.push(progress) }),
      ]);

      expect(first.path).toBe(second.path);
      expect(fixture.requests).toHaveLength(1);
      expect(firstProgress.length).toBeGreaterThan(0);
      expect(secondProgress.length).toBeGreaterThan(0);
    } finally {
      await fixture.close();
    }
  });

  it("aborts only the caller wait while the shared transfer continues", async () => {
    const body = "abort subscriber payload";
    const fixture = await startFixture(body, { delayMs: 60 });
    const root = tmpRoot("abort");
    const controller = new AbortController();
    try {
      const input = {
        basePath: join(root, "downloads"),
        bucket: "shared",
        fileName: "payload.bin",
        payload: { checksum: { algorithm: "sha256" as const, value: sha256(body) }, url: fixture.url },
      };
      const aborted = managedDownload({ ...input, signal: controller.signal });
      const keeper = managedDownload(input);
      await sleep(5);
      controller.abort();

      await expect(aborted).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.ABORTED });
      const result = await keeper;
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("clears a stale pid lock before acquiring the target", async () => {
    const body = "stale lock payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("stale-lock");
    const basePath = join(root, "downloads");
    try {
      await inspectManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" });
      writeFileSync(lockPath(basePath, "updates", "installer.bin"), JSON.stringify({
        createdAt: new Date().toISOString(),
        pid: exitedPid(),
      }));

      const result = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(existsSync(lockPath(basePath, "updates", "installer.bin"))).toBe(false);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("clears a stale lock when Windows reuses the old owner pid for this process", async () => {
    const body = "pid reuse lock payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("pid-reuse-lock");
    const basePath = join(root, "downloads");
    try {
      await inspectManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" });
      writeFileSync(lockPath(basePath, "updates", "installer.bin"), JSON.stringify({
        createdAt: new Date(Date.now() - (process.uptime() + 60) * 1000).toISOString(),
        pid: process.pid,
      }));

      const result = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(existsSync(lockPath(basePath, "updates", "installer.bin"))).toBe(false);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("quick-fails when the target lock pid is still alive", async () => {
    const body = "alive lock payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("alive-lock");
    const basePath = join(root, "downloads");
    try {
      await inspectManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" });
      writeFileSync(lockPath(basePath, "updates", "installer.bin"), JSON.stringify({
        createdAt: new Date().toISOString(),
        pid: process.pid,
      }));

      await expect(
        managedDownload({
          basePath,
          bucket: "updates",
          fileName: "installer.bin",
          payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
        }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.TARGET_LOCKED });
      expect(fixture.requests).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  it("refuses to overwrite caller output when bytes differ", async () => {
    const body = "output conflict payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("output-conflict");
    const outputPath = join(root, "artifact.bin");
    writeFileSync(outputPath, "existing");
    try {
      await expect(
        downloadCopyAndClear({
          basePath: join(root, "downloads"),
          bucket: "updates",
          fileName: "installer.bin",
          outputPath,
          payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
        }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.OUTPUT_CONFLICT });
      expect(readFileSync(outputPath, "utf8")).toBe("existing");
    } finally {
      await fixture.close();
    }
  });

  it("exposes explicit remove for managed targets", async () => {
    const body = "remove payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("remove");
    const basePath = join(root, "downloads");
    try {
      const result = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      expect(existsSync(result.path)).toBe(true);

      await removeManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" });
      expect((await inspectManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" })).complete).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it("prunes managed data older than the default one-day window", async () => {
    const body = "old payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("prune");
    const basePath = join(root, "downloads");
    try {
      await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      const pruned = await pruneManagedDownloads({ basePath, now: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });

      expect(pruned.removed).toBeGreaterThan(0);
      expect((await inspectManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" })).complete).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it("resets suspicious complete state and redownloads from a clean base", async () => {
    const body = "fresh payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("suspicious-reset");
    const basePath = join(root, "downloads");
    try {
      const first = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      writeFileSync(first.path, "tampered bytes");

      const second = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });

      expect(readFileSync(second.path, "utf8")).toBe(body);
      expect(fixture.requests.length).toBeGreaterThanOrEqual(2);
    } finally {
      await fixture.close();
    }
  });

  it("reuses a previously completed download without re-fetching", async () => {
    const body = "reusable payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("reuse-complete");
    const basePath = join(root, "downloads");
    try {
      const first = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      expect(first.reusedComplete).toBe(false);
      expect(fixture.requests).toHaveLength(1);

      const second = await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      expect(second.reusedComplete).toBe(true);
      expect(second.path).toBe(first.path);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("resets and redownloads when the on-disk manifest is corrupt JSON", async () => {
    const body = "recovered payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("bad-manifest");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      writeFileSync(manifestPathFor(basePath, bucket, fileName), "{not valid json");

      const result = await managedDownload({
        basePath,
        bucket,
        fileName,
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("resets when an existing manifest's identity no longer matches the requested payload", async () => {
    const bodyB = "payload b — the one actually requested";
    const fixture = await startFixture(bodyB);
    const root = tmpRoot("identity-mismatch");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      // A manifest left behind for a *different* url/checksum under the same
      // bucket/fileName — its identityDigest/urlDigest deliberately don't
      // match the target we're about to build.
      writeManifestFile(basePath, bucket, fileName, {
        checksum: { algorithm: "sha256", value: "0".repeat(64) },
        identityDigest: "1".repeat(64),
        state: "complete",
        url: "https://example.invalid/a-different-artifact.bin",
      });

      const result = await managedDownload({
        basePath,
        bucket,
        fileName,
        payload: { checksum: { algorithm: "sha256", value: sha256(bodyB) }, url: fixture.url },
      });
      expect(readFileSync(result.path, "utf8")).toBe(bodyB);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("resets when a partial manifest has no matching partial file on disk", async () => {
    const body = "restart after missing partial";
    const fixture = await startFixture(body);
    const root = tmpRoot("missing-partial");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      writeManifestFile(basePath, bucket, fileName, {
        checksum: { algorithm: "sha256", value: sha256(body) },
        state: "partial",
        url: fixture.url,
      });
      // Deliberately no .partial file written — partialExists is false.

      const result = await managedDownload({
        basePath,
        bucket,
        fileName,
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(fixture.requests).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  it("resumes a partial download left behind by a previous process, with matching validators", async () => {
    const body = "resume across separate managedDownload calls";
    const fixture = await startFixture(body, { range: true });
    const root = tmpRoot("cross-call-resume");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      const checksum = { algorithm: "sha256" as const, value: sha256(body) };
      const partialPrefix = Buffer.from(body).subarray(0, 6);
      writeFileSync(partialPathFor(basePath, bucket, fileName), partialPrefix);
      // The saved etag matches what the fixture actually serves, so the
      // resume must proceed rather than restart (validatorsConflict: false).
      writeManifestFile(basePath, bucket, fileName, {
        checksum,
        state: "partial",
        url: fixture.url,
        validators: { etag: '"fixture-etag"' },
      });

      const result = await managedDownload({
        basePath,
        bucket,
        fileName,
        payload: { checksum, url: fixture.url },
      });

      expect(result.resumed).toBe(true);
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(fixture.requests.some((request) => request.range?.startsWith(`bytes=${partialPrefix.byteLength}-`))).toBe(true);
    } finally {
      await fixture.close();
    }
  });

  it("restarts a resume when the server's validators no longer match the saved manifest", async () => {
    const body = "validator conflict payload, long enough to matter";
    const fixture = await startFixture(body, { range: true });
    const root = tmpRoot("validator-conflict");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      const checksum = { algorithm: "sha256" as const, value: sha256(body) };
      const partialPrefix = Buffer.from(body).subarray(0, 6);
      writeFileSync(partialPathFor(basePath, bucket, fileName), partialPrefix);
      writeManifestFile(basePath, bucket, fileName, {
        checksum,
        state: "partial",
        url: fixture.url,
        validators: { etag: '"stale-etag-from-a-different-upload"' },
      });

      const result = await managedDownload({
        basePath,
        bucket,
        fileName,
        payload: { checksum, url: fixture.url },
      });

      // Had to restart from zero — the saved etag conflicted with the
      // server's current one, even though the byte offset matched.
      expect(result.resumed).toBe(false);
      expect(readFileSync(result.path, "utf8")).toBe(body);
    } finally {
      await fixture.close();
    }
  });

  it("dedupes a fresh download against an out-of-band final file with matching bytes", async () => {
    const body = "already present final payload, long enough to resume from";
    const fixture = await startFixture(body);
    const root = tmpRoot("preexisting-final-match");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      const checksum = { algorithm: "sha256" as const, value: sha256(body) };
      const partialPrefix = Buffer.from(body).subarray(0, 8);
      mkdirSync(join(basePath, bucket), { recursive: true });
      writeFileSync(join(basePath, bucket, fileName), body); // out-of-band final, correct bytes
      writeFileSync(partialPathFor(basePath, bucket, fileName), partialPrefix); // genuine correct prefix
      writeManifestFile(basePath, bucket, fileName, { checksum, state: "partial", url: fixture.url });

      const result = await managedDownload({ basePath, bucket, fileName, payload: { checksum, url: fixture.url } });

      expect(result.resumed).toBe(true);
      expect(result.reusedComplete).toBe(false);
      expect(readFileSync(result.path, "utf8")).toBe(body);
      expect(existsSync(partialPathFor(basePath, bucket, fileName))).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it("resets and fails when an out-of-band final file has the wrong bytes", async () => {
    const body = "correct payload for a mismatch test, long enough to resume from";
    const fixture = await startFixture(body);
    const root = tmpRoot("preexisting-final-mismatch");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    try {
      await inspectManagedDownload({ basePath, bucket, fileName });
      const checksum = { algorithm: "sha256" as const, value: sha256(body) };
      const partialPrefix = Buffer.from(body).subarray(0, 8);
      mkdirSync(join(basePath, bucket), { recursive: true });
      writeFileSync(join(basePath, bucket, fileName), "totally wrong bytes sitting at the final path already");
      writeFileSync(partialPathFor(basePath, bucket, fileName), partialPrefix);
      writeManifestFile(basePath, bucket, fileName, { checksum, state: "partial", url: fixture.url });

      await expect(
        managedDownload({ basePath, bucket, fileName, payload: { checksum, url: fixture.url } }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.STORE_CORRUPT });
    } finally {
      await fixture.close();
    }
  });

  it("fails the download when the freshly-written partial file disappears before it can be hashed", async () => {
    const body = "vanishing partial payload, long enough to split into two chunks";
    const root = tmpRoot("vanishing-partial");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    const partial = partialPathFor(basePath, bucket, fileName);

    const bytes = Buffer.from(body);
    const half = bytes.subarray(0, Math.ceil(bytes.length / 2));
    const rest = bytes.subarray(Math.ceil(bytes.length / 2));
    const fakeFetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(half);
          // Wait until the partial file genuinely exists on disk, then
          // unlink it out from under the still-open write stream — safe on
          // POSIX (the writer keeps its fd) — so hashFile sees ENOENT once
          // the "download" is done.
          for (let attempt = 0; attempt < 500 && !existsSync(partial); attempt += 1) {
            await sleep(2);
          }
          rmSync(partial, { force: true });
          controller.enqueue(rest);
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-length": String(bytes.byteLength), "content-type": "application/octet-stream" },
      });
    }) as typeof fetch;

    await expect(
      managedDownload({
        basePath,
        bucket,
        fileName,
        fetch: fakeFetch,
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: "https://example.invalid/artifact.bin" },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.STORE_CORRUPT });
  });

  it("gives up when the download state keeps resetting after cleanup (a permanently unreadable manifest)", async () => {
    const root = tmpRoot("perma-reset");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    await inspectManagedDownload({ basePath, bucket, fileName });
    const stateDir = join(basePath, ".state");
    writeFileSync(manifestPathFor(basePath, bucket, fileName), "{not valid json");
    // With `.state` unreadable, every attempt to read the (corrupt-looking)
    // manifest fails the same way, so the post-cleanup reload is *still*
    // suspicious — the outer "kept resetting" guard has to fire.
    chmodSync(stateDir, 0o000);
    try {
      await expect(
        managedDownload({
          basePath,
          bucket,
          fileName,
          payload: { checksum: { algorithm: "sha256", value: sha256("irrelevant") }, url: "https://example.invalid/artifact.bin" },
        }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.STORE_CORRUPT });
    } finally {
      chmodSync(stateDir, 0o755);
    }
  });

  it("exhausts retries and reports the last failure, even a non-Error rejection", async () => {
    const root = tmpRoot("network-exhausted");
    const basePath = join(root, "downloads");
    const fakeFetch = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "connection refused";
    }) as unknown as typeof fetch;

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        fetch: fakeFetch,
        maxAttempts: 2,
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "https://example.invalid/artifact.bin" },
      }),
    ).rejects.toMatchObject({
      code: MANAGED_DOWNLOAD_ERROR_CODES.NETWORK_EXHAUSTED,
      message: expect.stringContaining("connection refused"),
    });
  });

  it("rejects urls and payloads that fail basic target normalization", async () => {
    const root = tmpRoot("invalid-target");
    const basePath = join(root, "downloads");
    const validUrl = "https://example.invalid/x.bin";

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "ftp://example.invalid/x.bin" },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "not a url at all" },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "md5" as never, value: "0".repeat(64) }, url: validUrl },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "not-hex" }, url: validUrl },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      managedDownload({
        basePath,
        bucket: "",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: validUrl },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "../escape",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: validUrl },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      managedDownload({
        basePath: "",
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: validUrl },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });
  });

  it("refuses a download base that is a symlink rather than a plain directory", async () => {
    const root = tmpRoot("basepath-symlink");
    const realDir = join(root, "real-target");
    mkdirSync(realDir, { recursive: true });
    const basePath = join(root, "downloads-link");
    symlinkSync(realDir, basePath, "dir");

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "https://example.invalid/x.bin" },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.STORE_NOT_OWNED });
  });

  it("refuses a non-empty download base that has no ownership marker", async () => {
    const root = tmpRoot("nonempty-no-sentinel");
    const basePath = join(root, "downloads");
    mkdirSync(basePath, { recursive: true });
    writeFileSync(join(basePath, "unexpected.txt"), "surprise");

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "https://example.invalid/x.bin" },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.STORE_NOT_OWNED });
  });

  it("refuses a download base with an invalid ownership marker", async () => {
    const root = tmpRoot("bad-sentinel");
    const basePath = join(root, "downloads");
    mkdirSync(basePath, { recursive: true });
    writeFileSync(join(basePath, ".jini-download-root.json"), JSON.stringify({ not: "a sentinel" }));

    await expect(
      managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "https://example.invalid/x.bin" },
      }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.STORE_NOT_OWNED });
  });

  it("treats a lock as active when it belongs to a different, currently-alive process", async () => {
    const body = "foreign alive lock payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("foreign-alive-lock");
    const basePath = join(root, "downloads");
    try {
      await inspectManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" });
      writeFileSync(
        lockPath(basePath, "updates", "installer.bin"),
        JSON.stringify({ createdAt: new Date().toISOString(), pid: process.ppid }),
      );

      await expect(
        managedDownload({
          basePath,
          bucket: "updates",
          fileName: "installer.bin",
          payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
        }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.TARGET_LOCKED });
      expect(fixture.requests).toHaveLength(0);
    } finally {
      await fixture.close();
    }
  });

  it("propagates a non-lock-contention error while acquiring the download lock", async () => {
    const root = tmpRoot("lock-acquire-error");
    const basePath = join(root, "downloads");
    const bucket = "updates";
    const fileName = "installer.bin";
    await inspectManagedDownload({ basePath, bucket, fileName }); // creates .locks
    const locksDir = join(basePath, ".locks");
    chmodSync(locksDir, 0o000);
    try {
      await expect(
        managedDownload({
          basePath,
          bucket,
          fileName,
          payload: { checksum: { algorithm: "sha256", value: "0".repeat(64) }, url: "https://example.invalid/x.bin" },
        }),
      ).rejects.toThrow();
    } finally {
      chmodSync(locksDir, 0o755);
    }
  });

  it("rejects immediately when the wait signal is already aborted", async () => {
    const body = "already aborted payload";
    const fixture = await startFixture(body, { delayMs: 30 });
    const root = tmpRoot("pre-aborted");
    const controller = new AbortController();
    controller.abort();
    try {
      await expect(
        managedDownload({
          basePath: join(root, "downloads"),
          bucket: "updates",
          fileName: "installer.bin",
          payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.ABORTED });
      // Let the still-running background task settle before the fixture
      // closes and the temp dir gets swept out from under it.
      await sleep(60);
    } finally {
      await fixture.close();
    }
  });

  it("rejects a conflicting identity for a target that is already active", async () => {
    const bodyA = "identity a payload";
    const fixtureA = await startFixture(bodyA, { delayMs: 60 });
    const root = tmpRoot("target-conflict");
    const basePath = join(root, "downloads");
    try {
      const first = managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(bodyA) }, url: fixtureA.url },
      });
      await expect(
        managedDownload({
          basePath,
          bucket: "updates",
          fileName: "installer.bin",
          payload: { checksum: { algorithm: "sha256", value: sha256("different") }, url: `${fixtureA.url}?v=2` },
        }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.TARGET_CONFLICT });
      await first;
    } finally {
      await fixtureA.close();
    }
  });

  it("refuses to remove a target that is still actively downloading", async () => {
    const body = "still downloading payload";
    const fixture = await startFixture(body, { delayMs: 60 });
    const root = tmpRoot("remove-while-active");
    const basePath = join(root, "downloads");
    try {
      const inFlight = managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      await expect(
        removeManagedDownload({ basePath, bucket: "updates", fileName: "installer.bin" }),
      ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.TARGET_LOCKED });
      await inFlight;
    } finally {
      await fixture.close();
    }
  });

  it("rejects an empty or null-byte outputPath before starting the download", async () => {
    const root = tmpRoot("bad-output-path");
    const basePath = join(root, "downloads");
    const payload = { checksum: { algorithm: "sha256" as const, value: "0".repeat(64) }, url: "https://example.invalid/x.bin" };

    await expect(
      downloadCopyAndClear({ basePath, bucket: "updates", fileName: "installer.bin", outputPath: "", payload }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });

    await expect(
      downloadCopyAndClear({ basePath, bucket: "updates", fileName: "installer.bin", outputPath: "bad\0path", payload }),
    ).rejects.toMatchObject({ code: MANAGED_DOWNLOAD_ERROR_CODES.INVALID_TARGET });
  });

  it("shares a copy lease across concurrent copyAndClear calls, deferring cleanup until the last one releases", async () => {
    const body = "shared lease payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("copy-lease-share");
    const basePath = join(root, "downloads");
    const outputA = join(root, "out-a", "artifact.bin");
    const outputB = join(root, "out-b", "artifact.bin");
    try {
      const input = {
        basePath,
        bucket: "shared",
        fileName: "payload.bin",
        payload: { checksum: { algorithm: "sha256" as const, value: sha256(body) }, url: fixture.url },
      };
      const [resultA, resultB] = await Promise.all([
        downloadCopyAndClear({ ...input, outputPath: outputA }),
        downloadCopyAndClear({ ...input, outputPath: outputB }),
      ]);

      expect(readFileSync(outputA, "utf8")).toBe(body);
      expect(readFileSync(outputB, "utf8")).toBe(body);
      // Exactly one of the two must have observed the other lease still
      // held (deferred); whichever released last performs the real cleanup.
      expect([resultA.cleanup, resultB.cleanup]).toContain("deferred");
      const inspected = await inspectManagedDownload({ basePath, bucket: "shared", fileName: "payload.bin" });
      expect(inspected.complete).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it("records a warning when a prunable entry cannot be removed", async () => {
    const body = "prune warning payload";
    const fixture = await startFixture(body);
    const root = tmpRoot("prune-warning");
    const basePath = join(root, "downloads");
    try {
      await managedDownload({
        basePath,
        bucket: "updates",
        fileName: "installer.bin",
        payload: { checksum: { algorithm: "sha256", value: sha256(body) }, url: fixture.url },
      });
      // A locked-down nested dir inside the completed bucket stands in for a
      // permission-denied prunable entry: `rm` fails on it (force only
      // suppresses "already gone", not "can't get in"), so the prune loop
      // must record a warning rather than silently drop the failure.
      const bucketDir = join(basePath, "updates");
      const lockedDir = join(bucketDir, "locked");
      mkdirSync(lockedDir);
      writeFileSync(join(lockedDir, "nested.txt"), "x");
      chmodSync(lockedDir, 0o000);
      try {
        const pruned = await pruneManagedDownloads({ basePath, now: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });
        expect(pruned.warnings.length).toBeGreaterThan(0);
      } finally {
        chmodSync(lockedDir, 0o755);
      }
    } finally {
      await fixture.close();
    }
  });
});
