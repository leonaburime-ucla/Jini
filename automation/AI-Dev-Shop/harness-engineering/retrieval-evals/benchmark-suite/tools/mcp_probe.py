#!/usr/bin/env python3
"""Minimal stdio MCP client: launch a server, initialize, list tools, optionally call one.

Lets you query MCP-only retrieval backends (serena, code-review-graph) one-shot from the
shell, without registering them in Claude or restarting a session.

Usage:
  mcp_probe.py --list -- <server cmd...>
  mcp_probe.py --call <tool> --args '<json>' -- <server cmd...>

Examples:
  # serena: references to a symbol
  mcp_probe.py --call find_referencing_symbols \
    --args '{"name_path":"getOpenDesignHost","relative_path":"packages/host/src/index.ts"}' \
    -- /path/to/serena start-mcp-server --project <repo> --transport stdio

  # code-review-graph: semantic/keyword node search
  mcp_probe.py --call semantic_search_nodes_tool --args '{"query":"updater popup","limit":5}' \
    -- code-review-graph serve --repo <repo>
"""
import sys, json, subprocess, argparse, time

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--call")
    ap.add_argument("--args", default="{}")
    ap.add_argument("--timeout", type=float, default=120.0)
    argv = sys.argv[1:]
    sep = argv.index("--")
    mine, cmd = argv[:sep], argv[sep+1:]
    a = ap.parse_args(mine)

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, bufsize=1, text=True)
    rid = [0]
    def send(method, params=None, notif=False):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None: msg["params"] = params
        if not notif:
            rid[0] += 1
            msg["id"] = rid[0]
        proc.stdin.write(json.dumps(msg) + "\n"); proc.stdin.flush()
        return msg.get("id")

    def read_until(target_id, deadline):
        while time.time() < deadline:
            line = proc.stdout.readline()
            if not line: return None
            line = line.strip()
            if not line or not line.startswith("{"): continue
            try: obj = json.loads(line)
            except Exception: continue
            if obj.get("id") == target_id: return obj
        return None

    deadline = time.time() + a.timeout
    init_id = send("initialize", {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "mcp-probe", "version": "0.1"}
    })
    init = read_until(init_id, deadline)
    if not init:
        print("INIT FAILED (no response)"); proc.kill(); return
    send("notifications/initialized", {}, notif=True)

    if a.list or not a.call:
        tid = send("tools/list", {})
        res = read_until(tid, deadline)
        tools = (res or {}).get("result", {}).get("tools", [])
        print(f"TOOLS ({len(tools)}):")
        for t in tools:
            print(f"  - {t['name']}: {t.get('description','')[:90]}")
    if a.call:
        tid = send("tools/call", {"name": a.call, "arguments": json.loads(a.args)})
        res = read_until(tid, deadline)
        print(json.dumps(res, indent=2) if res else "CALL: no response")
    proc.kill()

if __name__ == "__main__":
    main()
