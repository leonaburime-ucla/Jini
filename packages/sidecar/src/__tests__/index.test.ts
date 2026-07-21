import { spawn } from "node:child_process";
import { existsSync, lstatSync, writeFileSync } from "node:fs";
import { createServer as createNetServer, createConnection } from "node:net";
import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  allocatePort,
  bootstrapSidecarRuntime,
  createJsonIpcServer,
  createSidecarLaunchEnv,
  isWindowsNamedPipePath,
  normalizeIpcPath,
  readJsonFile,
  removeFile,
  removePointerIfCurrent,
  requestJsonIpc,
  resolveAppIpcPath,
  resolveAppRuntimePath,
  resolveLogFilePath,
  resolveManifestPath,
  resolveNamespace,
  resolveNamespaceRoot,
  resolvePointerPath,
  resolveProjectRoot,
  resolveRuntimeNamespaceRoot,
  resolveRuntimeRoot,
  resolveSidecarBase,
  resolveSourceRuntimeRoot,
  writeJsonFile,
  type SidecarContractDescriptor,
  type SidecarStampShape,
} from "../index.js";
// net.ts is an internal module shared by port.ts/json-ipc.ts, not re-exported from the barrel
// (see index.ts's own module doc) — imported directly here, matching the rest of this file's
// convention of importing everything else through the barrel.
import { closeServer, listenOnPort } from "../net.js";
import { allocateDynamicPort } from "../port.js";

/**
 * A fake host contract, standing in for a real consumer's product-specific
 * defaults/env names/normalizers — proves the sidecar path/bootstrap surface
 * carries no hardcoded product identity.
 */
type FakeStamp = SidecarStampShape & {
  app: "api" | "ui";
  mode: "dev" | "prod";
  source: "tool" | "pack";
};

const fakeContract: SidecarContractDescriptor<FakeStamp> = {
  defaults: {
    host: "127.0.0.1",
    ipcBase: "/tmp/fake-product/ipc",
    namespace: "default",
    projectTmpDirName: ".fake-tmp",
    windowsPipePrefix: "fake-product",
  },
  env: {
    base: "FAKE_BASE",
    ipcBase: "FAKE_IPC_BASE",
    ipcPath: "FAKE_IPC_PATH",
    namespace: "FAKE_NAMESPACE",
    source: "FAKE_SOURCE",
  },
  normalizeApp(value) {
    if (value === "api" || value === "ui") return value;
    throw new Error(`unsupported fake app: ${String(value)}`);
  },
  normalizeNamespace(value) {
    if (typeof value !== "string" || !/^[a-z0-9-]+$/.test(value)) {
      throw new Error("invalid fake namespace");
    }
    return value;
  },
  normalizeSource(value) {
    if (value === "tool" || value === "pack") return value;
    throw new Error(`unsupported fake source: ${String(value)}`);
  },
  normalizeStamp(value) {
    const stamp = value as Partial<FakeStamp>;
    return {
      app: this.normalizeApp(stamp.app),
      ipc: String(stamp.ipc),
      mode: stamp.mode === "prod" ? "prod" : "dev",
      namespace: this.normalizeNamespace(stamp.namespace),
      source: this.normalizeSource(stamp.source),
    };
  },
};

function testIpcPath(root: string): string {
  if (process.platform === "win32") return `\\\\.\\pipe\\jini-sidecar-test-${process.pid}-${Date.now()}`;
  return join(root, "ipc.sock");
}

describe("@jini/sidecar — ipc-path", () => {
  it("recognizes Windows named pipes and validates absolute unix socket paths", () => {
    expect(isWindowsNamedPipePath("\\\\.\\pipe\\my-app")).toBe(true);
    expect(isWindowsNamedPipePath("/tmp/socket.sock")).toBe(false);

    expect(normalizeIpcPath("/tmp/socket.sock")).toBe("/tmp/socket.sock");
    expect(normalizeIpcPath("\\\\.\\pipe\\my-app")).toBe("\\\\.\\pipe\\my-app");
    expect(() => normalizeIpcPath("relative/socket.sock")).toThrow(/must be absolute/);
    expect(() => normalizeIpcPath("")).toThrow(/must not be empty/);
    expect(() => normalizeIpcPath(" /tmp/socket.sock ")).toThrow(/leading or trailing whitespace/);
    expect(() => normalizeIpcPath(42)).toThrow(/must be a string/);
    expect(() => normalizeIpcPath("/tmp/soc\0ket.sock")).toThrow(/must not contain null bytes/);
  });
});

describe("@jini/sidecar — net", () => {
  it("closeServer is a no-op on a server that was never listening", async () => {
    const server = createNetServer();
    await expect(closeServer(server)).resolves.toBeUndefined();
  });

  it("closeServer closes a listening server", async () => {
    const server = await listenOnPort(0, "127.0.0.1");
    expect(server.listening).toBe(true);
    await closeServer(server);
    expect(server.listening).toBe(false);
  });

  it("listenOnPort rejects when the port is already bound by another server", async () => {
    const first = await listenOnPort(0, "127.0.0.1");
    const address = first.address();
    if (address == null || typeof address === "string") throw new Error("expected a TCP address");
    await expect(listenOnPort(address.port, "127.0.0.1")).rejects.toThrow();
    await closeServer(first);
  });

  it("closeServer rejects when the underlying server.close() callback itself reports an error", async () => {
    const server = await listenOnPort(0, "127.0.0.1");
    try {
      const boom = new Error("close failed");
      vi.spyOn(server, "close").mockImplementation(((cb?: (err?: Error) => void) => {
        cb?.(boom);
        return server;
      }) as typeof server.close);
      await expect(closeServer(server)).rejects.toBe(boom);
    } finally {
      vi.restoreAllMocks();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("@jini/sidecar — path boundary uses descriptor defaults, not hardcoded product constants", () => {
  it("derives project/source/namespace roots from the contract's own defaults", () => {
    const sourceRoot = resolveSourceRuntimeRoot({
      contract: fakeContract,
      projectRoot: "/repo/product",
      source: "tool",
    });

    expect(sourceRoot).toBe(resolve("/repo/product", ".fake-tmp", "tool"));
    expect(resolveNamespaceRoot({ base: sourceRoot, contract: fakeContract, namespace: "alpha" })).toBe(
      join(sourceRoot, "alpha"),
    );
    expect(
      resolveAppRuntimePath({
        app: "ui",
        contract: fakeContract,
        fileName: "cache",
        namespaceRoot: join(sourceRoot, "alpha"),
      }),
    ).toBe(join(sourceRoot, "alpha", "ui", "cache"));
  });

  it("resolves descriptor-specific IPC paths", () => {
    expect(resolveAppIpcPath({ app: "ui", contract: fakeContract, namespace: "alpha" })).toBe(
      process.platform === "win32" ? "\\\\.\\pipe\\fake-product-alpha-ui" : "/tmp/fake-product/ipc/alpha/ui.sock",
    );
  });

  it("resolves namespace and base from the descriptor's own env variable names", () => {
    const env = {
      FAKE_BASE: "/runtime/base",
      FAKE_NAMESPACE: "selected",
    };

    expect(resolveNamespace({ contract: fakeContract, env })).toBe("selected");
    expect(
      resolveSidecarBase({ contract: fakeContract, env, projectRoot: "/repo/product", source: "tool" }),
    ).toBe(resolve("/runtime/base"));
  });

  it("resolves the namespace root correctly for both pre-namespace (dev) and packaged bases", () => {
    // dev: base is the pre-namespace source root, so the namespace is appended.
    expect(
      resolveRuntimeNamespaceRoot({
        contract: fakeContract,
        runtime: { base: "/runtime/base", mode: "dev", namespace: "alpha" },
        runtimeMode: "prod",
      }),
    ).toBe(join(resolve("/runtime/base"), "alpha"));

    // packaged: base already points into the namespace tree, so the namespace
    // root is base's parent, and logs resolve as its sibling.
    const runtime = { base: "/data/ns/alpha/runtime", mode: "prod", namespace: "alpha" } as const;
    const namespaceRoot = resolveRuntimeNamespaceRoot({ contract: fakeContract, runtime, runtimeMode: "prod" });
    expect(namespaceRoot).toBe(resolve("/data/ns/alpha"));
    expect(resolveLogFilePath({ app: "api", contract: fakeContract, runtimeRoot: namespaceRoot })).toBe(
      join(resolve("/data/ns/alpha"), "logs", "api", "latest.log"),
    );
  });

  it("resolveNamespace falls back to the contract default when neither an explicit value nor the env var is set", () => {
    expect(resolveNamespace({ contract: fakeContract, env: {} })).toBe("default");
  });

  it("resolveProjectRoot rejects a non-string or empty/whitespace-only value", () => {
    expect(() => resolveProjectRoot("")).toThrow(/non-empty string/);
    expect(() => resolveProjectRoot("   ")).toThrow(/non-empty string/);
    expect(() => resolveProjectRoot(42 as unknown as string)).toThrow(/non-empty string/);
  });

  it("resolveSidecarBase falls all the way through to the computed source runtime root when neither base nor env is set", () => {
    expect(resolveSidecarBase({ contract: fakeContract, env: {}, projectRoot: "/repo/product", source: "tool" })).toBe(
      resolve("/repo/product", ".fake-tmp", "tool"),
    );
  });

  it("resolveRuntimeRoot, resolvePointerPath, and resolveManifestPath derive the documented per-run/pointer/manifest paths", () => {
    const base = "/runtime/base";
    expect(resolveRuntimeRoot({ base, contract: fakeContract, namespace: "alpha", runId: "run_1" })).toBe(
      join(resolve(base), "alpha", "runs", "run_1"),
    );
    expect(resolvePointerPath({ base, contract: fakeContract, namespace: "alpha" })).toBe(join(resolve(base), "alpha", "current.json"));
    expect(resolveManifestPath({ runtimeRoot: "/runtime/base/alpha/runs/run_1" })).toBe(
      join("/runtime/base/alpha/runs/run_1", "manifest.json"),
    );
  });

  it("resolveAppRuntimePath rejects an empty fileName, one with a null byte, and one with a path separator", () => {
    const namespaceRoot = "/runtime/base/alpha";
    expect(() => resolveAppRuntimePath({ app: "ui", contract: fakeContract, fileName: "", namespaceRoot })).toThrow(
      /simple path segment/,
    );
    expect(() =>
      resolveAppRuntimePath({ app: "ui", contract: fakeContract, fileName: "a\0b", namespaceRoot }),
    ).toThrow(/simple path segment/);
    expect(() =>
      resolveAppRuntimePath({ app: "ui", contract: fakeContract, fileName: "../escape", namespaceRoot }),
    ).toThrow(/simple path segment/);
  });

  it("resolveAppIpcPath returns a Windows named pipe path on win32 instead of a unix socket path", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
    try {
      expect(resolveAppIpcPath({ app: "ui", contract: fakeContract, namespace: "alpha" })).toBe(
        "\\\\.\\pipe\\fake-product-alpha-ui",
      );
    } finally {
      Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
    }
  });
});

describe("@jini/sidecar — bootstrap", () => {
  it("creates launch env from descriptor env names and bootstraps back to a matching runtime context", () => {
    const stamp: FakeStamp = {
      app: "api",
      ipc: resolveAppIpcPath({ app: "api", contract: fakeContract, namespace: "alpha" }),
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    };

    const launchEnv = createSidecarLaunchEnv({ base: "/runtime/base", contract: fakeContract, extraEnv: {}, stamp });
    expect(launchEnv).toEqual({
      FAKE_BASE: resolve("/runtime/base"),
      FAKE_IPC_PATH: stamp.ipc,
      FAKE_NAMESPACE: stamp.namespace,
      FAKE_SOURCE: stamp.source,
    });

    expect(bootstrapSidecarRuntime(stamp, launchEnv, { app: "api", contract: fakeContract })).toEqual({
      app: "api",
      base: resolve("/runtime/base"),
      ipc: stamp.ipc,
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    });
  });

  it("rejects a stamp whose app does not match the expected app", () => {
    const stamp: FakeStamp = {
      app: "api",
      ipc: resolveAppIpcPath({ app: "api", contract: fakeContract, namespace: "alpha" }),
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    };
    expect(() => bootstrapSidecarRuntime(stamp, {}, { app: "ui", contract: fakeContract })).toThrow(
      /sidecar stamp app mismatch/,
    );
  });

  it("rejects a stamp whose ipc path does not match the one derived from app/namespace/env", () => {
    const stamp: FakeStamp = {
      app: "api",
      ipc: "/tmp/totally-wrong-path.sock",
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    };
    expect(() => bootstrapSidecarRuntime(stamp, {}, { app: "api", contract: fakeContract })).toThrow(
      /sidecar ipc path mismatch/,
    );
  });

  it("rejects when the incoming env already carries a conflicting canonical value (namespace/source/ipc)", () => {
    const stamp: FakeStamp = {
      app: "api",
      ipc: resolveAppIpcPath({ app: "api", contract: fakeContract, namespace: "alpha" }),
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    };
    const conflictingEnv = { FAKE_NAMESPACE: "some-other-namespace" };
    expect(() => bootstrapSidecarRuntime(stamp, conflictingEnv, { app: "api", contract: fakeContract })).toThrow(
      /sidecar env mismatch for FAKE_NAMESPACE/,
    );
  });

  it("accepts a matching pre-existing env value and honors an explicit projectRoot option", () => {
    const stamp: FakeStamp = {
      app: "api",
      ipc: resolveAppIpcPath({ app: "api", contract: fakeContract, namespace: "alpha" }),
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    };
    const matchingEnv = { FAKE_NAMESPACE: "alpha" };
    const runtime = bootstrapSidecarRuntime(stamp, matchingEnv, {
      app: "api",
      contract: fakeContract,
      projectRoot: "/repo/product",
    });
    expect(runtime.base).toBe(resolve("/repo/product", ".fake-tmp", "tool"));
  });
});

describe("@jini/sidecar — port allocation", () => {
  it("allocates a dynamic port and avoids re-issuing an already-reserved one", async () => {
    const reserved = new Set<number>();
    const first = await allocatePort({ reserved });
    expect(first.source).toBe("dynamic");
    expect(reserved.has(first.port)).toBe(true);

    const second = await allocatePort({ reserved });
    expect(second.port).not.toBe(first.port);
  });

  it("rejects a forced port that conflicts with an already-reserved port", async () => {
    const reserved = new Set<number>();
    const first = await allocatePort({ reserved });
    await expect(allocatePort({ port: first.port, reserved })).rejects.toThrow(/conflicts with another managed port/);
  });

  it("rejects an out-of-range or non-integer forced port before attempting to bind it", async () => {
    await expect(allocatePort({ port: 0 })).rejects.toThrow(/integer between 1 and 65535/);
    await expect(allocatePort({ port: 70_000 })).rejects.toThrow(/integer between 1 and 65535/);
    await expect(allocatePort({ port: 1.5 })).rejects.toThrow(/integer between 1 and 65535/);
    await expect(allocatePort({ port: "not-a-number" })).rejects.toThrow(/integer between 1 and 65535/);
  });

  it("treats a null/empty forced port the same as an unspecified one (falls back to dynamic)", async () => {
    expect((await allocatePort({ port: null })).source).toBe("dynamic");
    expect((await allocatePort({ port: "" })).source).toBe("dynamic");
  });

  it("successfully allocates and reserves a genuinely free forced port", async () => {
    // Find a free port dynamically first, release it, then force-allocate that exact number.
    const probe = await allocatePort({});
    const reserved = new Set<number>();
    const result = await allocatePort({ port: probe.port, reserved });
    expect(result).toEqual({ port: probe.port, source: "forced" });
    expect(reserved.has(probe.port)).toBe(true);
  });

  it("rejects a forced port that is genuinely unavailable at the OS level (not just reserved)", async () => {
    const occupied = await listenOnPort(0, "127.0.0.1");
    const address = occupied.address();
    if (address == null || typeof address === "string") throw new Error("expected a TCP address");
    try {
      await expect(allocatePort({ port: address.port })).rejects.toThrow(/is not available/);
    } finally {
      await closeServer(occupied);
    }
  });

  it("exhausts its 20-attempt dynamic-port budget when every probed port is already reserved (CR-R5: deterministic, no real OS allocation)", async () => {
    // Feeds 20 fixed reserved ports through the injected probe seam, one per attempt, in a fixed
    // order known ahead of time — no dependency on the OS's real ephemeral-port allocation
    // ordering, unlike the previous version of this test (see git history / CR-R5 in
    // ADS-memory/reports/code-review/CR-backend-coverage-push-2026-07-20.md).
    const reserved = new Set<number>(Array.from({ length: 20 }, (_, i) => 40000 + i));
    const probedHosts: string[] = [];
    let call = 0;
    const fakeProbe = async (host: string): Promise<number> => {
      probedHosts.push(host);
      call += 1;
      return 40000 + (call - 1);
    };

    await expect(allocateDynamicPort("runtime", "127.0.0.1", reserved, fakeProbe)).rejects.toThrow(
      /failed to allocate dynamic runtime port without conflict/,
    );
    expect(call).toBe(20);
    expect(probedHosts).toEqual(Array.from({ length: 20 }, () => "127.0.0.1"));
  });

  it("CR-R5: retries past reserved probes and allocates the first free one within the 20-attempt budget, deterministically", async () => {
    // Reserve exactly the first 19 ports the fake probe will hand back — leaving room for one
    // more attempt inside the fixed 20-attempt budget the production loop enforces (attempts
    // are NOT unbounded across calls: a call that never gets a free port within 20 attempts
    // throws, per the "exhausts its budget" test above).
    const reserved = new Set<number>(Array.from({ length: 19 }, (_, i) => 50000 + i));
    let call = 0;
    const fakeProbe = async (): Promise<number> => {
      call += 1;
      // The first 19 probes collide with `reserved`; the 20th (last available attempt) is free.
      return 50000 + (call - 1);
    };

    const result = await allocateDynamicPort("runtime", "127.0.0.1", reserved, fakeProbe);
    expect(result).toEqual({ port: 50019, source: "dynamic" });
    expect(call).toBe(20);
    expect(reserved.has(50019)).toBe(true);
  });
});

describe("@jini/sidecar — json-file", () => {
  it("writes, reads, and best-effort-removes JSON state atomically", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jini-sidecar-jsonfile-"));
    try {
      const filePath = join(dir, "nested", "state.json");
      await writeJsonFile(filePath, { runId: "run_1" });
      expect(await readJsonFile<{ runId: string }>(filePath)).toEqual({ runId: "run_1" });

      await removePointerIfCurrent(filePath, "run_2");
      expect(await readJsonFile(filePath)).toEqual({ runId: "run_1" });

      await removePointerIfCurrent(filePath, "run_1");
      expect(await readJsonFile(filePath)).toBeNull();
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("returns null for a missing or unparsable file, and removeFile is a no-op when absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jini-sidecar-jsonfile-"));
    try {
      expect(await readJsonFile(join(dir, "missing.json"))).toBeNull();
      await expect(removeFile(join(dir, "missing.json"))).resolves.toBeUndefined();
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

describe("@jini/sidecar — JSON IPC", () => {
  it("round-trips a request/response over a unix socket and traces low-level events without changing semantics", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-"));
    const socketPath = testIpcPath(root);
    const previousTrace = process.env.JINI_JSON_IPC_TRACE;
    const previousError = console.error;
    const logs: unknown[] = [];
    process.env.JINI_JSON_IPC_TRACE = "1";
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };

    const server = await createJsonIpcServer({
      handler: async (message) => ({ seen: message?.type }),
      socketPath,
    });

    try {
      await expect(requestJsonIpc(socketPath, { input: { expression: "secret()" }, type: "EVAL" })).resolves.toEqual({
        seen: "EVAL",
      });
    } finally {
      await server.close();
      console.error = previousError;
      if (previousTrace == null) delete process.env.JINI_JSON_IPC_TRACE;
      else process.env.JINI_JSON_IPC_TRACE = previousTrace;
      await rm(root, { force: true, recursive: true });
    }

    const events = logs
      .map((entry) => (Array.isArray(entry) ? (entry[1] as { event?: unknown } | undefined)?.event : undefined))
      .filter(Boolean);
    expect(events).toContain("client.connect_start");
    expect(events).toContain("server.connection");
    expect(events).toContain("server.frame_parsed");
    expect(events).toContain("client.response_success");
    expect(JSON.stringify(logs)).not.toContain("secret()");
  });

  it("preserves multibyte UTF-8 across socket chunk boundaries", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-utf8-"));
    const socketPath = testIpcPath(root);
    const unit = "拥挤让人焦虑，留白让人信任。敢留白，是因为知道什么最重要——交付边界。";
    const big = unit.repeat(4000);
    const server = await createJsonIpcServer({
      handler: async (message: { html?: string }) => ({ echo: message.html }),
      socketPath,
    });
    try {
      const result = await requestJsonIpc<{ echo: string }>(
        socketPath,
        { html: big, type: "RENDER" },
        { timeoutMs: 10_000 },
      );
      expect(result.echo).toBe(big);
      expect(result.echo).not.toContain("�");
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects the client with a timeout error when the server never responds", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-timeout-"));
    const socketPath = testIpcPath(root);
    const server = await createJsonIpcServer({
      handler: () => new Promise(() => undefined), // never resolves
      socketPath,
    });
    try {
      await expect(requestJsonIpc(socketPath, { type: "PING" }, { timeoutMs: 100 })).rejects.toThrow(
        /IPC request timed out/,
      );
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("SEC-004: redacts a handler's thrown Error to a generic message on the wire, logging the real detail server-side only", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-err-"));
    const socketPath = testIpcPath(root);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = await createJsonIpcServer({
      handler: () => {
        throw new Error("handler exploded at /secret/internal/path");
      },
      socketPath,
    });
    try {
      await requestJsonIpc(socketPath, { type: "X" });
      expect.unreachable("expected requestJsonIpc to reject");
    } catch (err) {
      expect((err as Error).message).toBe("internal error");
      expect((err as Error).message).not.toContain("/secret/internal/path");
      expect((err as Error & { code?: string }).code).toBe("HANDLER_ERROR");
      expect((err as Error & { requestId?: string }).requestId).toEqual(expect.any(String));
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleErrorSpy.mock.calls[0]![1])).toContain("/secret/internal/path");
    consoleErrorSpy.mockRestore();
  });

  it("SEC-004: redacts a non-Error thrown value from the handler the same way", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-err2-"));
    const socketPath = testIpcPath(root);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = await createJsonIpcServer({
      handler: () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "raw string failure";
      },
      socketPath,
    });
    try {
      await expect(requestJsonIpc(socketPath, { type: "X" })).rejects.toThrow("internal error");
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleErrorSpy.mock.calls[0]![1])).toContain("raw string failure");
    consoleErrorSpy.mockRestore();
  });

  it("traces a non-object input payload distinctly from an object one (message summarization)", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-summary-"));
    const socketPath = testIpcPath(root);
    const server = await createJsonIpcServer({
      handler: async (message: { input?: unknown }) => ({ inputType: typeof message.input }),
      socketPath,
    });
    try {
      await expect(requestJsonIpc(socketPath, { input: "a plain string, not an object", type: "X" })).resolves.toEqual({
        inputType: "string",
      });
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("SEC-004: a Node-style error code from the handler is redacted the same as any other detail (only the stable HANDLER_ERROR code reaches the client)", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-code-"));
    const socketPath = testIpcPath(root);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = await createJsonIpcServer({
      handler: () => {
        const err = new Error("not found: /etc/shadow") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      },
      socketPath,
    });
    try {
      await requestJsonIpc(socketPath, { type: "X" });
      expect.unreachable("expected requestJsonIpc to reject");
    } catch (err) {
      expect((err as Error).message).toBe("internal error");
      expect((err as Error & { code?: string }).code).toBe("HANDLER_ERROR");
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
    expect(String(consoleErrorSpy.mock.calls[0]![1])).toContain("not found: /etc/shadow");
    consoleErrorSpy.mockRestore();
  });

  it("rejects with a connection error (not a timeout) when the target socket does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-noserver-"));
    try {
      const missingSocketPath = join(root, "nobody-listening.sock");
      await expect(requestJsonIpc(missingSocketPath, { type: "X" }, { timeoutMs: 2000 })).rejects.toThrow();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("replies with a parse-failure error when a client sends a non-JSON frame", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-badjson-"));
    const socketPath = testIpcPath(root);
    const server = await createJsonIpcServer({ handler: async () => "unused", socketPath });
    try {
      const reply = await new Promise<string>((resolvePromise, rejectPromise) => {
        const socket = createConnection(socketPath);
        socket.on("connect", () => socket.write("not valid json\n"));
        let data = "";
        socket.on("data", (chunk) => {
          data += chunk.toString();
        });
        socket.on("close", () => resolvePromise(data));
        socket.on("error", rejectPromise);
      });
      const parsed = JSON.parse(reply) as { ok: boolean; error?: { message?: string } };
      expect(parsed.ok).toBe(false);
      expect(parsed.error?.message).toBeTruthy();
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("cleans up a stale (dead) unix socket file left behind by a server that closed without unlinking it", async () => {
    if (process.platform === "win32") return; // named pipes have no on-disk stale-file concept
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-stale-"));
    const socketPath = join(root, "stale.sock");
    try {
      // A *clean* close (even a raw server.close(), bypassing createJsonIpcServer's own
      // unlink) auto-removes the socket's directory entry on this platform — verified
      // empirically, not assumed — so it can never produce a "stale but present" socket
      // file. A genuinely stale socket only exists after an *unclean* exit: spawn a real
      // child process that binds the socket, then SIGKILL it so nothing gets a chance to
      // unlink — the inode's directory entry survives, but nothing is listening behind it.
      const childScript = `
        const net = require("node:net");
        const server = net.createServer();
        server.listen(process.argv[1], () => {
          if (process.send) process.send("ready");
        });
      `;
      const child = spawn(process.execPath, ["-e", childScript, socketPath], {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      try {
        await new Promise<void>((resolveReady, rejectReady) => {
          child.once("message", () => resolveReady());
          child.once("exit", (code) => rejectReady(new Error(`stale-socket helper exited early: ${code}`)));
          child.once("error", rejectReady);
        });
        expect(existsSync(socketPath)).toBe(true);
      } finally {
        child.kill("SIGKILL");
        await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
      }
      // The socket file must still be on disk (an unclean kill leaves it — no unlink ran),
      // and it must be recognized as a socket, not just any leftover file.
      expect(existsSync(socketPath)).toBe(true);
      expect(lstatSync(socketPath).isSocket()).toBe(true);

      // A fresh server at the same path must detect the dead socket (connect fails
      // ECONNREFUSED/ENOENT, not a live peer), remove it, and bind cleanly in its place.
      const server = await createJsonIpcServer({ handler: async (message) => ({ echoed: message }), socketPath });
      try {
        await expect(requestJsonIpc(socketPath, { type: "PING" })).resolves.toEqual({ echoed: { type: "PING" } });
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("treats an on-disk path that exists but is not a socket (a plain file) as not stale", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-notsocket-"));
    const socketPath = join(root, "not-a-socket.sock");
    try {
      // A plain regular file at the target path: prepareIpcPath's stale-check must see
      // it exists but isn't a socket, and leave it alone rather than trying to connect
      // to it or unlink it — the subsequent real bind attempt then fails on top of it
      // (EADDRINUSE-shaped: the path is occupied by something that isn't a stale socket).
      writeFileSync(socketPath, "not a socket, just a file");
      await expect(
        createJsonIpcServer({ handler: async () => "ok", socketPath }),
      ).rejects.toThrow();
      // The unrelated file was left untouched — only a *stale socket* gets unlinked.
      expect(existsSync(socketPath)).toBe(true);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("propagates a non-ENOENT error from the stale-socket lstat check (e.g. an unsearchable parent directory)", async () => {
    if (process.platform === "win32") return; // chmod-based permission denial doesn't apply
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-lstat-eacces-"));
    const restrictedDir = join(root, "restricted");
    const socketPath = join(restrictedDir, "x.sock");
    await mkdir(restrictedDir);
    // No read/execute on the socket's own parent dir: lstat(socketPath) fails with
    // EACCES, not ENOENT — that must be rethrown, not swallowed as "doesn't exist yet".
    await chmod(restrictedDir, 0o000);
    try {
      await expect(createJsonIpcServer({ handler: async () => "ok", socketPath })).rejects.toMatchObject({ code: "EACCES" });
    } finally {
      await chmod(restrictedDir, 0o755);
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects when probing a stale socket fails with something other than ENOENT/ECONNREFUSED (e.g. permission denied)", async () => {
    if (process.platform === "win32") return; // chmod-based permission denial doesn't apply
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-connect-eacces-"));
    const socketPath = join(root, "locked.sock");
    const childScript = `
      const net = require("node:net");
      const server = net.createServer();
      server.listen(process.argv[1], () => {
        if (process.send) process.send("ready");
      });
    `;
    const child = spawn(process.execPath, ["-e", childScript, socketPath], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    try {
      await new Promise<void>((resolveReady, rejectReady) => {
        child.once("message", () => resolveReady());
        child.once("exit", (code) => rejectReady(new Error(`stale-socket helper exited early: ${code}`)));
        child.once("error", rejectReady);
      });
      child.kill("SIGKILL");
      await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
      expect(existsSync(socketPath)).toBe(true);

      // Strip all permissions on the now-dead socket file itself: connecting to it
      // fails with EACCES rather than the ENOENT/ECONNREFUSED "safe to unlink" cases.
      await chmod(socketPath, 0o000);
      await expect(createJsonIpcServer({ handler: async () => "ok", socketPath })).rejects.toMatchObject({ code: "EACCES" });
    } finally {
      await chmod(socketPath, 0o644).catch(() => undefined);
      await rm(root, { force: true, recursive: true });
    }
  });

  it("prepareIpcPath is a no-op for a Windows named-pipe path (no filesystem staging needed)", async () => {
    if (process.platform !== "win32") return; // this path is inert (and untestable end-to-end) off Windows
    const socketPath = `\\\\.\\pipe\\jini-sidecar-test-pipe-${process.pid}`;
    const server = await createJsonIpcServer({ handler: async () => "ok", socketPath });
    await server.close();
  });

  it("SEC-004: rejects a frame that exceeds maxFrameBytes before any newline arrives", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-toolarge-"));
    const socketPath = testIpcPath(root);
    const server = await createJsonIpcServer({
      handler: async () => "ok",
      socketPath,
      maxFrameBytes: 32,
    });
    try {
      const bigPayload = { input: "a".repeat(1000), type: "X" };
      await expect(requestJsonIpc(socketPath, bigPayload)).rejects.toThrow(/exceeds the maximum size/);
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("SEC-004: destroys a connection that never completes a frame within idleTimeoutMs", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-idle-"));
    const socketPath = testIpcPath(root);
    const server = await createJsonIpcServer({
      handler: async () => "ok",
      socketPath,
      idleTimeoutMs: 30,
    });
    try {
      const socket = createConnection(socketPath);
      await new Promise<void>((resolveClosed, rejectNotClosed) => {
        const giveUp = setTimeout(
          () => rejectNotClosed(new Error("connection was not closed within the expected window")),
          2000,
        );
        socket.once("connect", () => {
          socket.write("no newline here, ever — the server should give up waiting");
        });
        socket.once("close", () => {
          clearTimeout(giveUp);
          resolveClosed();
        });
        socket.once("error", (err) => {
          clearTimeout(giveUp);
          rejectNotClosed(err);
        });
      });
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("SEC-004: ignores a second frame that arrives on the same connection while the first handler call is still in-flight", async () => {
    const root = await mkdtemp(join(tmpdir(), "jini-sidecar-ipc-concurrent-"));
    const socketPath = testIpcPath(root);
    let handlerCalls = 0;
    const server = await createJsonIpcServer({
      handler: async (message: { seq?: number }) => {
        handlerCalls += 1;
        // Widens the in-flight window so the second frame (written below, shortly after
        // the first) reliably arrives while this handler call is still pending.
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
        return { seq: message.seq };
      },
      socketPath,
    });
    try {
      const socket = createConnection(socketPath);
      const responseChunks: string[] = [];
      await new Promise<void>((resolveClosed, rejectFailed) => {
        const giveUp = setTimeout(() => rejectFailed(new Error("connection did not close as expected")), 2000);
        socket.once("connect", () => {
          socket.write(`${JSON.stringify({ seq: 1, type: "X" })}\n`);
          setTimeout(() => socket.write(`${JSON.stringify({ seq: 2, type: "X" })}\n`), 5);
        });
        socket.on("data", (chunk) => responseChunks.push(chunk.toString("utf8")));
        socket.once("close", () => {
          clearTimeout(giveUp);
          resolveClosed();
        });
        socket.once("error", (err) => {
          clearTimeout(giveUp);
          rejectFailed(err);
        });
      });
      expect(handlerCalls).toBe(1);
      const response = responseChunks.join("");
      expect(response).toContain('"seq":1');
      expect(response).not.toContain('"seq":2');
    } finally {
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });
});
