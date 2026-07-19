import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  atomicCopyFile,
  collectProcessTreePids,
  createCommandInvocation,
  createPackageManagerInvocation,
  createProcessStampArgs,
  isProcessAlive,
  matchesProcessStamp,
  matchesStampedProcess,
  mergeProxyAwareEnv,
  parseMacosScutilProxyOutput,
  parseWindowsInternetSettingsProxyOutput,
  pathContains,
  readFlagValue,
  readLogTail,
  readProcessStamp,
  readProcessStampFromCommand,
  removePathBestEffort,
  resolveSystemProxyEnv,
  waitForHttpOk,
  wellKnownUserToolchainBins,
  type ProcessStampContract,
} from "../index.js";

/**
 * A minimal fake stamp contract, standing in for a real consumer's process
 * stamp shape — proves `process.ts` carries no product-specific assumptions.
 */
type FakeStamp = {
  app: "api" | "ui";
  namespace: string;
};

const fakeStampContract: ProcessStampContract<FakeStamp> = {
  stampFields: ["app", "namespace"],
  stampFlags: { app: "--fake-app", namespace: "--fake-namespace" },
  normalizeStamp(input) {
    const value = input as Partial<FakeStamp>;
    if (value.app !== "api" && value.app !== "ui") throw new Error("invalid app");
    if (typeof value.namespace !== "string" || value.namespace.length === 0) {
      throw new Error("invalid namespace");
    }
    return { app: value.app, namespace: value.namespace };
  },
  normalizeStampCriteria(input = {}) {
    const value = input as Partial<FakeStamp>;
    return {
      ...(value.app == null ? {} : { app: value.app }),
      ...(value.namespace == null ? {} : { namespace: value.namespace }),
    };
  },
};

const tempDirsToClean: string[] = [];

afterEach(async () => {
  while (tempDirsToClean.length > 0) {
    const dir = tempDirsToClean.pop();
    if (dir) await rm(dir, { force: true, recursive: true });
  }
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirsToClean.push(dir);
  return dir;
}

describe("@jini/platform — command", () => {
  it("passes non-Windows-shim commands straight through", () => {
    const invocation = createCommandInvocation({ args: ["--version"], command: "node" });
    expect(invocation).toEqual({ args: ["--version"], command: "node" });
  });

  it("builds a package-manager invocation from npm_execpath when present", () => {
    const invocation = createPackageManagerInvocation(["install"], { npm_execpath: "/usr/lib/pnpm/bin/pnpm.cjs" });
    expect(invocation.args).toEqual(["/usr/lib/pnpm/bin/pnpm.cjs", "install"]);
    expect(invocation.command).toBe(process.execPath);
  });
});

describe("@jini/platform — process stamps", () => {
  const stamp: FakeStamp = { app: "ui", namespace: "alpha" };

  it("round-trips a stamp through args, flag reads, and decode", () => {
    const args = createProcessStampArgs(stamp, fakeStampContract);
    expect(args).toEqual(["--fake-app=ui", "--fake-namespace=alpha"]);

    expect(readFlagValue(args, "--fake-app")).toBe("ui");
    expect(readFlagValue(["--fake-app", "ui"], "--fake-app")).toBe("ui");
    expect(readFlagValue(args, "--missing")).toBeNull();

    expect(readProcessStamp(args, fakeStampContract)).toEqual(stamp);
    expect(readProcessStampFromCommand(`node server.js ${args.join(" ")}`, fakeStampContract)).toEqual(stamp);
  });

  it("matches partial criteria and rejects mismatched criteria", () => {
    expect(matchesProcessStamp(stamp, { app: "ui" }, fakeStampContract)).toBe(true);
    expect(matchesProcessStamp(stamp, { app: "api" }, fakeStampContract)).toBe(false);
    expect(matchesProcessStamp(stamp, undefined, fakeStampContract)).toBe(true);

    const command = `node server.js ${createProcessStampArgs(stamp, fakeStampContract).join(" ")}`;
    expect(matchesStampedProcess({ command }, { namespace: "alpha" }, fakeStampContract)).toBe(true);
    expect(matchesStampedProcess({ command: "node unrelated.js" }, { namespace: "alpha" }, fakeStampContract)).toBe(
      false,
    );
  });

  it("collects a process tree from a snapshot list, roots-and-descendants, deepest first", () => {
    const processes = [
      { command: "root", pid: 1, ppid: 0 },
      { command: "child-a", pid: 2, ppid: 1 },
      { command: "child-b", pid: 3, ppid: 1 },
      { command: "grandchild", pid: 4, ppid: 2 },
      { command: "unrelated", pid: 5, ppid: 0 },
    ];
    const pids = collectProcessTreePids(processes, [1]);
    expect(pids).toEqual([4, 3, 2, 1]);
  });

  it("reports the current process as alive and treats invalid pids as dead", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(null)).toBe(false);
    expect(isProcessAlive(undefined)).toBe(false);
  });
});

describe("@jini/platform — fs", () => {
  it("containment: descendants pass, sibling/parent escapes fail, root itself passes", () => {
    expect(pathContains("/repo/root", "/repo/root/child")).toBe(true);
    expect(pathContains("/repo/root", "/repo/root")).toBe(true);
    expect(pathContains("/repo/root", "/repo/root/../sibling")).toBe(false);
    expect(pathContains("/repo/root", "/repo/other")).toBe(false);
  });

  it("atomically copies a file, refuses to clobber, and allows overwrite", async () => {
    const dir = await makeTempDir("jini-platform-fs-");
    const source = join(dir, "source.txt");
    const destination = join(dir, "nested", "destination.txt");
    await writeFile(source, "hello world", "utf8");

    const result = await atomicCopyFile(source, destination);
    expect(result).toEqual({ bytesCopied: "hello world".length, replaced: false });
    expect(await readFile(destination, "utf8")).toBe("hello world");

    await expect(atomicCopyFile(source, destination)).rejects.toThrow(/destination already exists/);

    await writeFile(source, "updated content", "utf8");
    const overwritten = await atomicCopyFile(source, destination, { overwrite: true });
    expect(overwritten.replaced).toBe(true);
    expect(await readFile(destination, "utf8")).toBe("updated content");
  });

  it("removes a path best-effort and reports success", async () => {
    const dir = await makeTempDir("jini-platform-fs-");
    const target = join(dir, "to-remove.txt");
    await writeFile(target, "bye", "utf8");

    const result = await removePathBestEffort(target);
    expect(result).toEqual({ removed: true });
    await expect(stat(target)).rejects.toThrow();
  });

  it("reads the trailing non-empty lines of a log file, and returns empty for a missing file", async () => {
    const dir = await makeTempDir("jini-platform-fs-");
    const logPath = join(dir, "out.log");
    await writeFile(logPath, "line1\nline2\n\nline3\n", "utf8");

    expect(await readLogTail(logPath, 2)).toEqual(["line2", "line3"]);
    expect(await readLogTail(join(dir, "missing.log"))).toEqual([]);
  });
});

describe("@jini/platform — http", () => {
  it("resolves once the URL answers OK, retrying through initial failures", async () => {
    let requestCount = 0;
    const server = createServer((_req, res) => {
      requestCount += 1;
      if (requestCount < 3) {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200).end("ok");
    });
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    if (address == null || typeof address === "string") throw new Error("expected a TCP address");

    try {
      await expect(waitForHttpOk(`http://127.0.0.1:${address.port}/`, { timeoutMs: 5000 })).resolves.toBe(true);
      expect(requestCount).toBeGreaterThanOrEqual(3);
    } finally {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  });

  it("rejects once the timeout elapses without an OK response", async () => {
    await expect(waitForHttpOk("http://127.0.0.1:1/", { timeoutMs: 200 })).rejects.toThrow(/timed out waiting for/);
  });
});

describe("@jini/platform — proxy-env", () => {
  it("merges layered sources, canonicalizing proxy variable spellings", () => {
    const merged = mergeProxyAwareEnv(
      "darwin",
      { HTTP_PROXY: "http://proxy.example:8080", PATH: "/usr/bin" },
      { https_proxy: "http://proxy.example:8443" },
    );
    expect(merged.HTTP_PROXY).toBe("http://proxy.example:8080");
    expect(merged.HTTPS_PROXY).toBe("http://proxy.example:8443");
    expect(merged.https_proxy).toBe("http://proxy.example:8443");
    expect(merged.PATH).toBe("/usr/bin");
    expect(merged.NODE_USE_ENV_PROXY).toBe("1");
  });

  it("parses macOS scutil proxy output into a normalized env", () => {
    const scutilOutput = [
      "HTTPEnable : 1",
      "HTTPProxy : proxy.example",
      "HTTPPort : 8080",
      "HTTPSEnable : 0",
      "ExceptionsList : <array> {",
      "  0 : *.internal",
      "}",
    ].join("\n");
    const env = parseMacosScutilProxyOutput(scutilOutput, "darwin");
    expect(env.HTTP_PROXY).toBe("http://proxy.example:8080");
    expect(env.NO_PROXY).toContain(".internal");
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
  });

  it("parses Windows Internet Settings registry output into a normalized env", () => {
    const env = parseWindowsInternetSettingsProxyOutput(
      {
        proxyEnable: "    ProxyEnable    REG_DWORD    0x1",
        proxyOverride: "    ProxyOverride    REG_SZ    *.local;10.0.0.1",
        proxyServer: "    ProxyServer    REG_SZ    proxy.example:8080",
      },
      "win32",
    );
    expect(env.HTTP_PROXY).toBe("http://proxy.example:8080");
    expect(env.HTTPS_PROXY).toBe("http://proxy.example:8080");
    expect(env.NO_PROXY).toContain("10.0.0.1");
  });

  it("resolves system proxy env via an injected command runner", () => {
    const env = resolveSystemProxyEnv({
      platform: "darwin",
      runCommand: () => "HTTPEnable : 1\nHTTPProxy : proxy.example\nHTTPPort : 3128\n",
    });
    expect(env.HTTP_PROXY).toBe("http://proxy.example:3128");
  });
});

describe("@jini/platform — toolchain", () => {
  it("assembles an ordered, home-relative bin list honoring explicit prefixes and env overrides", () => {
    const dirs = wellKnownUserToolchainBins({
      env: { NPM_CONFIG_PREFIX: "/custom/npm-prefix" },
      home: "/home/fakeuser",
      includeSystemBins: false,
    });

    expect(dirs[0]).toBe(join("/custom/npm-prefix", "bin"));
    expect(dirs).toContain(join("/home/fakeuser", ".local", "bin"));
    expect(dirs).toContain(join("/home/fakeuser", ".cargo", "bin"));
    expect(dirs).not.toContain("/opt/homebrew/bin");
  });

  it("prepends VP_HOME's bin dir ahead of conventional locations when set", () => {
    const dirs = wellKnownUserToolchainBins({ env: { VP_HOME: "/custom/vp" }, home: "/home/fakeuser" });
    expect(dirs[0]).toBe(join("/custom/vp", "bin"));
  });
});
