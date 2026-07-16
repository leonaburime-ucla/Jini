#!/usr/bin/env python3
"""
PostToolUse(Bash) enforcement hook for the Web Escalation Gate.

Detects when the SAME external command/binary fails repeatedly within a session and
injects a reminder telling the agent to STOP guessing and search the web + upstream
docs/issues before retrying (the "getting unstuck" operating rule in AGENTS.md).

Design notes:
- Keys failure counts on the external BINARY, not the full command line. In the agy
  incident the flags changed on every attempt, so a whole-command match would have
  missed it; the real signal was "agy keeps failing".
- Fails open: any parse/IO error exits 0 silently and never disrupts the tool flow.
- After nudging for a binary, its counter resets so the reminder doesn't spam.

This is a first-pass harness control and is flagged in todo.md for a later /audit-work.
"""
import json
import os
import re
import sys
import tempfile
import time

THRESHOLD = 2            # failures of the same binary before nudging
WINDOW_SECONDS = 1800    # only count failures within this rolling window

# Shell builtins / ubiquitous utilities that are never the "stuck" target.
STOPLIST = {
    "cd", "echo", "cat", "ls", "true", "false", "sleep", "kill", "wait", "script",
    "perl", "python", "python3", "head", "tail", "wc", "rm", "mkdir", "cp", "mv",
    "grep", "egrep", "rg", "sed", "awk", "set", "for", "do", "done", "fi", "if",
    "then", "else", "elif", "while", "printf", "export", "source", "env", "test",
    "pgrep", "pkill", "ps", "tee", "sort", "uniq", "cut", "tr", "xargs", "find",
    "touch", "chmod", "basename", "dirname", "date", "which", "command", "time",
    "timeout", "gtimeout", "nohup", "trap", "exec", "eval", "read", "local",
}

# Markers that indicate a command failed (heuristic; audited later).
FAIL_RE = re.compile(
    r"command not found|no such file|permission denied|terminated|timed out|"
    r"\btimeout\b|exit=(?:1[0-9]{2}|[1-9])|exit code (?:[1-9])|fatal:|"
    r"traceback \(most recent call last\)|\berror\b|\bfailed\b|\bcannot\b",
    re.IGNORECASE,
)


def main():
    raw = sys.stdin.read()
    data = json.loads(raw)
    if data.get("tool_name") != "Bash":
        return
    command = (data.get("tool_input") or {}).get("command", "") or ""
    resp = data.get("tool_response")
    haystack_parts = [command]
    if isinstance(resp, dict):
        haystack_parts += [str(resp.get("stdout", "")), str(resp.get("stderr", "")),
                           str(resp.get("output", "")), str(resp.get("error", ""))]
        if resp.get("is_error") or resp.get("interrupted"):
            haystack_parts.append("error")
    else:
        haystack_parts.append(str(resp))
    haystack = "\n".join(haystack_parts)

    if not FAIL_RE.search(haystack):
        return  # looked successful — nothing to track

    # Candidate external binaries: word-like tokens not in the stoplist, not flags/paths.
    tokens = re.findall(r"(?:^|[\s;|&(])([a-zA-Z][a-zA-Z0-9_.-]{1,})", command)
    binaries = []
    for t in tokens:
        tl = t.lower()
        if tl in STOPLIST or tl.startswith("-") or "/" in t or "." in t and not t.isalpha():
            continue
        if tl not in binaries:
            binaries.append(tl)
    if not binaries:
        return

    session_id = data.get("session_id") or "global"
    state_dir = os.path.join(tempfile.gettempdir(), "ads-unstuck")
    os.makedirs(state_dir, exist_ok=True)
    state_path = os.path.join(state_dir, f"{session_id}.json")

    now = time.time()
    try:
        with open(state_path) as fh:
            state = json.load(fh)
    except (IOError, ValueError):
        state = {}

    triggered = None
    for b in binaries:
        entry = state.get(b)
        if not entry or (now - entry.get("first", now)) > WINDOW_SECONDS:
            entry = {"count": 0, "first": now}
        entry["count"] += 1
        entry["last"] = now
        state[b] = entry
        if entry["count"] >= THRESHOLD and triggered is None:
            triggered = b
            state[b] = {"count": 0, "first": now}  # reset after nudging

    # prune stale entries
    state = {k: v for k, v in state.items() if (now - v.get("last", now)) <= WINDOW_SECONDS}
    try:
        with open(state_path, "w") as fh:
            json.dump(state, fh)
    except IOError:
        pass

    if triggered:
        msg = (
            f"WEB ESCALATION GATE: `{triggered}` has now failed {THRESHOLD}+ times this "
            f"session. Per the getting-unstuck operating rule (AGENTS.md), STOP trying new "
            f"invocations. First run a minimal probe to confirm `{triggered}` is healthy in "
            f"isolation, then SEARCH the web + the tool's upstream docs/issue tracker for the "
            f"exact failure signature (`{triggered} <version> <symptom>`) BEFORE another "
            f"attempt. The missing fact is likely a known bug/flag, not something to guess. "
            f"Record the fix in memory once found."
        )
        out = {"hookSpecificOutput": {"hookEventName": "PostToolUse",
                                      "additionalContext": msg}}
        sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # fail open: never disrupt the tool flow
    sys.exit(0)
