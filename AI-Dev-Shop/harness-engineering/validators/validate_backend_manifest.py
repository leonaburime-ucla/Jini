#!/usr/bin/env python3
"""Deterministic plumbing check for the codebase-analysis backend manifest and the
guided-install machinery (no network, no LLM, no build).

Asserts:
  1. integrations/backends.manifest.json parses and every backend has the required
     fields; every referenced validator file exists and is executable.
  2. The .gitignore boundary holds: tracked stubs (manifest, candidate READMEs)
     SHIP in a clone, while heavy source (*/upstream/, */bin/) stays ignored.
  3. The codegraph validator's guided-install ladder works on a SIMULATED FRESH
     CLONE: pointed at an absent managed dir it reports overall_status=unavailable
     with a --download recommendation, and creates nothing (no leak).

Run: python3 harness-engineering/validators/validate_backend_manifest.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "integrations/backends.manifest.json"
CODEGRAPH_VALIDATOR = ROOT / "harness-engineering/validators/check_codegraph_capability.sh"

REQUIRED_FIELDS = {"id", "tier", "paradigm", "query_classes", "upstream_url",
                   "requirements", "cost", "managed_dir", "index_location",
                   "status_check"}
VALID_TIERS = {"blessed", "candidate"}

failures: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def git_ignored(rel_path: str) -> bool:
    """True if `git check-ignore` matches (path would be absent from a clone)."""
    res = subprocess.run(["git", "check-ignore", "-q", rel_path], cwd=ROOT)
    return res.returncode == 0


def check_manifest() -> list[dict]:
    if not MANIFEST.exists():
        fail(f"manifest missing: {MANIFEST.relative_to(ROOT)}")
        return []
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"manifest is not valid JSON: {exc}")
        return []

    backends = data.get("backends")
    if not isinstance(backends, list) or not backends:
        fail("manifest has no 'backends' list")
        return []

    # The storage model must be documented (install vs index split is load-bearing).
    storage = data.get("storage")
    if not isinstance(storage, dict) or "installed_backend" not in storage or "index_data" not in storage:
        fail("manifest 'storage' must document installed_backend and index_data locations")

    ids = [b.get("id") for b in backends]
    if len(ids) != len(set(ids)):
        fail(f"duplicate backend ids in manifest: {ids}")

    for b in backends:
        bid = b.get("id", "<unknown>")
        missing = REQUIRED_FIELDS - set(b)
        if missing:
            fail(f"backend '{bid}' missing required fields: {sorted(missing)}")
        if b.get("tier") not in VALID_TIERS:
            fail(f"backend '{bid}' has invalid tier: {b.get('tier')!r}")
        # A non-null validator must point at a real, executable file.
        validator = b.get("validator")
        if validator:
            vpath = ROOT / validator
            if not vpath.exists():
                fail(f"backend '{bid}' validator does not exist: {validator}")
            elif not os.access(vpath, os.X_OK):
                fail(f"backend '{bid}' validator is not executable: {validator}")
    return backends


def check_gitignore_boundary(backends: list[dict]) -> None:
    # Stubs that must SHIP in a clone.
    must_ship = ["integrations/backends.manifest.json",
                 "integrations/codegraph/README.md"]
    for rel in must_ship:
        if not (ROOT / rel).exists():
            fail(f"expected tracked stub is missing on disk: {rel}")
        elif git_ignored(rel):
            fail(f"stub is gitignored (would be absent in a clone): {rel}")

    # Heavy source that must STAY ignored, for every backend with a managed_dir
    # ending in upstream/ (the vendored-source convention).
    for b in backends:
        managed = b.get("managed_dir", "")
        if managed.rstrip("/").endswith("upstream"):
            probe = managed.rstrip("/") + "/package.json"
            if not git_ignored(probe):
                fail(f"heavy source path is NOT ignored (would bloat a clone): {probe}")


def check_fresh_clone_ladder() -> None:
    if not CODEGRAPH_VALIDATOR.exists():
        fail("codegraph validator missing; cannot test guided-install ladder")
        return
    # Simulate a fresh clone: managed dir that does not exist.
    with tempfile.TemporaryDirectory() as tmp:
        absent = Path(tmp) / "codegraph-absent"
        json_out = Path(tmp) / "status.json"
        res = subprocess.run(
            ["bash", str(CODEGRAPH_VALIDATOR),
             "--managed-dir", str(absent), "--json", str(json_out)],
            cwd=ROOT, text=True, capture_output=True,
        )
        if res.returncode != 0:
            fail(f"codegraph validator (read-only) exited {res.returncode}: {res.stderr.strip()}")
            return
        if absent.exists():
            fail("read-only capability check created the managed dir (should never mutate)")
        try:
            status = json.loads(json_out.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            fail(f"validator --json did not produce valid JSON: {exc}")
            return
        if status.get("overall_status") != "unavailable":
            fail(f"absent backend should be 'unavailable', got {status.get('overall_status')!r}")
        rec = (status.get("recommendation") or "").lower()
        if "--download" not in rec:
            fail(f"unavailable backend should recommend guided install (--download); got: {rec!r}")


def main() -> int:
    backends = check_manifest()
    if backends:
        check_gitignore_boundary(backends)
    check_fresh_clone_ladder()

    if failures:
        print("FAIL: backend manifest / guided-install plumbing")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS: backend manifest valid; gitignore boundary holds; "
          "codegraph guided-install ladder reports 'unavailable' on a fresh clone")
    return 0


if __name__ == "__main__":
    sys.exit(main())
