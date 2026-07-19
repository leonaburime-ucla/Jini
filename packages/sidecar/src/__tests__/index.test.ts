import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

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
  resolveNamespace,
  resolveNamespaceRoot,
  resolveRuntimeNamespaceRoot,
  resolveSidecarBase,
  resolveSourceRuntimeRoot,
  writeJsonFile,
  type SidecarContractDescriptor,
  type SidecarStampShape,
} from "../index.js";

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
});
