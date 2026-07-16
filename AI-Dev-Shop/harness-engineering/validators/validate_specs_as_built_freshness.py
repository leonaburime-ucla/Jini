#!/usr/bin/env python3
"""Validate specs_as_built source-scope freshness metadata.

The validator is intentionally no-op safe for projects that have not adopted
specs_as_built yet. Once artifacts declare `artifact_type: specs_as_built` or a
component `_meta.yaml` declares `source_scope`, the validator checks whether the
declared source fingerprint still matches the current source files.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
PLACEHOLDER_PREFIXES = ("<", "TODO", "TBD", "todo", "tbd")
REQUIRED_COMPONENT_CONTRACTS = (
    "api.yaml",
    "data.yaml",
    "errors.yaml",
    "side-effects.yaml",
    "functions.yaml",
)
ALLOWED_STATUS_VALUES = frozenset({"generated", "hybrid", "stale", "rewriting"})


@dataclass(frozen=True)
class Finding:
    severity: str
    path: Path
    code: str
    message: str


def default_knowledge_root() -> Path:
    env = os.environ.get("ADS_MEMORY_ROOT") or os.environ.get("ADS_PROJECT_KNOWLEDGE_ROOT") or os.environ.get("ADS_WORKSPACE_ROOT")
    if env:
        return Path(env).expanduser().resolve()

    # Prefer the current workspace name; fall back to the legacy name for
    # un-migrated checkouts. `ADS-memory` local is the default when none exist.
    for name in ("ADS-memory", "ADS-project-knowledge"):
        local = ROOT / name
        if local.exists():
            return local
        sibling = ROOT.parent / name
        if sibling.exists():
            return sibling

    return ROOT / "ADS-memory"


def default_source_root(knowledge_root: Path) -> Path:
    env = os.environ.get("HOST_PROJECT_ROOT")
    if env:
        return Path(env).expanduser().resolve()

    if knowledge_root.parent != ROOT and (knowledge_root.parent / ".git").exists():
        return knowledge_root.parent

    return ROOT


def parse_scalar(value: str) -> str:
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def parse_simple_yaml(text: str) -> dict[str, object]:
    """Parse the small YAML subset used by specs_as_built metadata."""
    data: dict[str, object] = {}
    current_list_key: str | None = None

    for raw_line in text.splitlines():
        if raw_line.strip() in {"---", "..."}:
            continue
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if raw_line.startswith((" ", "\t")) and current_list_key:
            stripped = raw_line.strip()
            if stripped.startswith("- "):
                values = data.setdefault(current_list_key, [])
                if isinstance(values, list):
                    values.append(parse_scalar(stripped[2:]))
            continue

        current_list_key = None
        if ":" not in raw_line:
            continue
        key, value = raw_line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value == "":
            data[key] = []
            current_list_key = key
        elif value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            if not inner:
                data[key] = []
            else:
                data[key] = [parse_scalar(part.strip()) for part in inner.split(",")]
        else:
            data[key] = parse_scalar(value)
    return data


def extract_frontmatter(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    return parse_simple_yaml(text[4:end])


def read_metadata(path: Path) -> dict[str, object]:
    if path.name == "_meta.yaml":
        return parse_simple_yaml(path.read_text(encoding="utf-8"))
    if path.suffix.lower() in {".md", ".markdown"}:
        return extract_frontmatter(path)
    return {}


def is_placeholder(value: str) -> bool:
    return not value or value.startswith(PLACEHOLDER_PREFIXES) or "<" in value or ">" in value


def iter_metadata_files(artifact_root: Path) -> Iterable[Path]:
    for path in sorted(artifact_root.rglob("*")):
        if not path.is_file():
            continue
        if path.name == "_meta.yaml" or path.suffix.lower() in {".md", ".markdown"}:
            yield path


def source_scope_from(metadata: dict[str, object]) -> list[str]:
    raw = metadata.get("source_scope")
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [str(item) for item in raw if isinstance(item, str)]
    return []


def resolve_scope(source_root: Path, patterns: list[str]) -> tuple[list[Path], list[str]]:
    files: set[Path] = set()
    unmatched: list[str] = []

    for pattern in patterns:
        if is_placeholder(pattern):
            continue
        matches = [p for p in source_root.glob(pattern) if p.is_file()]
        if not matches:
            direct = (source_root / pattern).resolve()
            if direct.is_file():
                matches = [direct]
        if not matches:
            unmatched.append(pattern)
        for match in matches:
            files.add(match.resolve())

    return sorted(files), unmatched


def fingerprint_files(source_root: Path, files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        try:
            rel = path.relative_to(source_root)
        except ValueError:
            rel = Path(path.name)
        digest.update(str(rel).encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return "sha256:" + digest.hexdigest()


def validate_generation_manifest(artifact_root: Path) -> list[Finding]:
    findings: list[Finding] = []
    path = artifact_root / "_meta" / "generation-manifest.yaml"
    if not path.exists():
        findings.append(Finding(
            "WARN", path, "MISSING_GENERATION_MANIFEST",
            "generation manifest is missing",
        ))
        return findings

    metadata = parse_simple_yaml(path.read_text(encoding="utf-8"))
    if not metadata.get("version"):
        findings.append(Finding(
            "WARN", path, "MISSING_MANIFEST_VERSION",
            "generation manifest has no version",
        ))
    artifacts = metadata.get("artifacts")
    if artifacts is not None and not isinstance(artifacts, list):
        findings.append(Finding(
            "WARN", path, "INVALID_MANIFEST_ARTIFACTS",
            "generation manifest artifacts field must be a list",
        ))
    return findings


def validate_component_structure(artifact_root: Path) -> list[Finding]:
    findings: list[Finding] = []
    components_dir = artifact_root / "components"
    if not components_dir.exists():
        return findings

    for component_dir in sorted(p for p in components_dir.iterdir() if p.is_dir()):
        if not any(component_dir.iterdir()):
            continue
        required_paths = (
            component_dir / "README.md",
            component_dir / "contracts",
            component_dir / "_meta.yaml",
        )
        for required in required_paths:
            if not required.exists():
                findings.append(Finding(
                    "WARN", component_dir, "INCOMPLETE_COMPONENT_STRUCTURE",
                    f"component is missing {required.name}",
                ))

        contracts_dir = component_dir / "contracts"
        if contracts_dir.exists():
            for name in REQUIRED_COMPONENT_CONTRACTS:
                if not (contracts_dir / name).exists():
                    findings.append(Finding(
                        "WARN", contracts_dir, "MISSING_COMPONENT_CONTRACT",
                        f"component contracts missing {name}",
                    ))
    return findings


def validate_metadata_file(path: Path, source_root: Path) -> list[Finding]:
    findings: list[Finding] = []
    metadata = read_metadata(path)
    if not metadata:
        return findings

    artifact_type = str(metadata.get("artifact_type", "")).strip()
    scope = source_scope_from(metadata)
    status = str(metadata.get("status", "")).strip().lower()
    if artifact_type and artifact_type != "specs_as_built":
        return findings
    if not artifact_type and not scope and path.name != "_meta.yaml":
        return findings

    if status and status not in ALLOWED_STATUS_VALUES:
        findings.append(Finding(
            "WARN", path, "INVALID_STATUS_VALUE",
            f"status '{status}' is not one of: {', '.join(sorted(ALLOWED_STATUS_VALUES))}",
        ))

    if path.name == "_meta.yaml" and not scope:
        findings.append(Finding(
            "WARN", path, "MISSING_SOURCE_SCOPE",
            "component metadata has no source_scope; freshness cannot be checked yet",
        ))
        return findings

    if not scope:
        findings.append(Finding(
            "WARN", path, "MISSING_SOURCE_SCOPE",
            "specs_as_built artifact has no source_scope; freshness cannot be checked yet",
        ))
        return findings

    files, unmatched = resolve_scope(source_root, scope)
    for pattern in unmatched:
        findings.append(Finding(
            "WARN" if status == "rewriting" else "ERROR", path, "SOURCE_SCOPE_NO_MATCH",
            f"source_scope pattern matched no files: {pattern}",
        ))

    if not files:
        return findings

    actual = fingerprint_files(source_root, files)
    declared = str(metadata.get("source_fingerprint", "")).strip()

    if not declared or is_placeholder(declared):
        findings.append(Finding(
            "WARN", path, "MISSING_SOURCE_FINGERPRINT",
            f"computed current fingerprint {actual}, but source_fingerprint is missing",
        ))
        return findings

    if declared != actual and status not in {"stale", "rewriting"}:
        findings.append(Finding(
            "ERROR", path, "STALE_SOURCE_FINGERPRINT",
            f"declared {declared}, current {actual}; regenerate artifact or mark status: stale with waiver",
        ))
    elif declared != actual and status in {"stale", "rewriting"}:
        findings.append(Finding(
            "WARN", path, "KNOWN_STALE_SOURCE_FINGERPRINT",
            f"artifact is marked {status}; declared {declared}, current {actual}",
        ))

    if not metadata.get("last_verified_commit"):
        findings.append(Finding(
            "WARN", path, "MISSING_LAST_VERIFIED_COMMIT",
            "last_verified_commit is missing",
        ))
    if not metadata.get("last_verified_at"):
        findings.append(Finding(
            "WARN", path, "MISSING_LAST_VERIFIED_AT",
            "last_verified_at is missing",
        ))
    if not metadata.get("reverse_spec_run"):
        findings.append(Finding(
            "WARN", path, "MISSING_REVERSE_SPEC_RUN",
            "reverse_spec_run is missing",
        ))

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--knowledge-root", type=Path, default=default_knowledge_root())
    parser.add_argument("--source-root", type=Path, default=None)
    parser.add_argument("--strict", action="store_true", help="Treat warnings as failures.")
    args = parser.parse_args()

    knowledge_root = args.knowledge_root.expanduser().resolve()
    source_root = (args.source_root.expanduser().resolve() if args.source_root else default_source_root(knowledge_root))
    artifact_root = knowledge_root / "specs_as_built"

    if not artifact_root.exists():
        print(f"Specs-as-built freshness: not active; missing {artifact_root}")
        return 0

    findings: list[Finding] = []
    findings.extend(validate_generation_manifest(artifact_root))
    findings.extend(validate_component_structure(artifact_root))
    metadata_files = list(iter_metadata_files(artifact_root))
    for path in metadata_files:
        findings.extend(validate_metadata_file(path, source_root))

    errors = [f for f in findings if f.severity == "ERROR"]
    warnings = [f for f in findings if f.severity == "WARN"]

    for finding in findings:
        rel = finding.path
        try:
            rel = finding.path.relative_to(ROOT)
        except ValueError:
            pass
        print(f"{finding.severity}: [{finding.code}] {rel} — {finding.message}")

    if errors or (args.strict and warnings):
        print(
            f"Specs-as-built freshness validation failed: {len(errors)} error(s), {len(warnings)} warning(s).",
            file=sys.stderr,
        )
        return 1

    print(
        f"Specs-as-built freshness validation passed: {len(metadata_files)} candidate metadata file(s), {len(warnings)} warning(s)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
