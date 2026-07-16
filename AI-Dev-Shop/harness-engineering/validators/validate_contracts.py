#!/usr/bin/env python3
"""Validate contract file presence, structure, cross-references, and field coverage."""
from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_DIR = ROOT / "framework" / "contracts"
TEMPLATE_HOST_DECLARATIONS_DIR = ROOT / "project-knowledge-template" / "governance" / "contracts"

LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)
CODE_BLOCK_RE = re.compile(r"^```.*?^```", re.MULTILINE | re.DOTALL)

GAP_TOKENS = frozenset(
    {"n/a", "none", "gap", "missing", "needs declaration", "not yet available", "not yet configured"}
)
PLACEHOLDER_TOKENS = frozenset({"todo", "tbd", "unknown", "fixme"})
ANGLE_PLACEHOLDER_RE = re.compile(r"<[A-Z][A-Z0-9_]*>")


@dataclass(frozen=True)
class ContractSpec:
    filename: str
    required_headings: tuple[str, ...]
    required_slots: tuple[str, ...]


FRAMEWORK_SPECS: dict[str, ContractSpec] = {
    "README.md": ContractSpec(
        filename="README.md",
        required_headings=(
            "Host-Project Contracts",
            "Contract Types",
            "Where Contracts Live",
            "Which Stages Consume Contracts",
        ),
        required_slots=(),
    ),
    "computational-controls.md": ContractSpec(
        filename="computational-controls.md",
        required_headings=(
            "Computational Controls Contract",
            "Named Command Slots",
            "lint",
            "typecheck",
            "build",
            "unit_tests",
            "integration_tests",
            "static_analysis",
            "Behavior When Contract Is Missing",
            "Behavior When a Check Fails",
        ),
        required_slots=("lint", "typecheck", "build", "unit_tests", "integration_tests", "static_analysis"),
    ),
    "runtime-validation.md": ContractSpec(
        filename="runtime-validation.md",
        required_headings=(
            "Runtime Validation Contract",
            "Required Fields",
            "boot_command",
            "healthy_signal",
            "critical_path_check",
            "negative_path_check",
            "artifact_capture_path",
            "teardown_command",
            "Outcome Model",
            "Behavior When Contract Is Missing",
        ),
        required_slots=(
            "boot_command",
            "healthy_signal",
            "critical_path_check",
            "negative_path_check",
            "artifact_capture_path",
            "teardown_command",
        ),
    ),
    "architecture-fitness.md": ContractSpec(
        filename="architecture-fitness.md",
        required_headings=(
            "Architecture Fitness Contract",
            "Rule Format",
            "Enforcement Scope",
            "Validator Priority Rule",
            "Behavior When Contract Is Missing",
        ),
        required_slots=(),
    ),
    "specs-as-built-freshness.md": ContractSpec(
        filename="specs-as-built-freshness.md",
        required_headings=(
            "Specs-As-Built Freshness Contract",
            "Host Declaration Location",
            "Required Fields",
            "Artifact Metadata Contract",
            "Behavior When Contract Is Missing",
            "Behavior When Freshness Fails",
            "Stage Gate Behavior",
            "Waiver Protocol",
        ),
        required_slots=(
            "artifact_root",
            "source_root",
            "validator",
            "enforcement",
            "hard_blocking_change_types",
            "advisory_change_types",
        ),
    ),
    "enforcement.md": ContractSpec(
        filename="enforcement.md",
        required_headings=(
            "Contract Enforcement",
            "Contract States",
            "Greenfield vs Brownfield Defaults",
            "Enforcement Tiers",
            "Waiver Protocol",
            "Stage Gate Behavior",
        ),
        required_slots=(),
    ),
}

HOST_DECLARATION_SLOTS: dict[str, tuple[str, ...]] = {
    "specs-as-built-freshness.md": (
        "Enforcement",
        "Artifact root",
        "Source root",
        "Validator",
        "Hard Blocking Change Types",
        "Advisory Change Types",
    ),
}


@dataclass(frozen=True)
class Violation:
    file_path: Path
    line_number: int
    code: str
    message: str


def strip_code_blocks(text: str) -> str:
    return CODE_BLOCK_RE.sub("", text)


def heading_lines(text: str) -> dict[str, int]:
    results: dict[str, int] = {}
    for i, line in enumerate(text.splitlines(), 1):
        m = re.match(r"^#{1,4}\s+(.+)$", line)
        if m:
            results[m.group(1).strip()] = i
    return results


def extract_markdown_links(text: str) -> Iterable[tuple[int, str]]:
    clean = strip_code_blocks(text)
    for i, line in enumerate(clean.splitlines(), 1):
        for m in LINK_RE.finditer(line):
            target = m.group(2)
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            if target.startswith("<"):
                continue
            yield i, target.split("#")[0] if "#" in target else target


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


def normalize_field_label(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def slot_has_content(text: str, slot_heading: str) -> bool:
    lines = text.splitlines()
    in_slot = False
    for line in lines:
        if re.match(rf"^#{{2,4}}\s+{re.escape(slot_heading)}\s*$", line):
            in_slot = True
            continue
        if in_slot:
            if re.match(r"^#{1,4}\s+", line):
                break
            stripped = line.strip()
            if not stripped or stripped.startswith("<!--"):
                continue
            value = stripped.split(":", 1)[-1].strip() if ":" in stripped else stripped
            value = value.strip("` ")
            if field_value_has_content(value):
                return True
    return False


def field_value_has_content(value: str) -> bool:
    value = value.strip().strip("` ")
    value_lower = value.lower()
    if not value or value_lower in PLACEHOLDER_TOKENS or value_lower in GAP_TOKENS:
        return False
    if ANGLE_PLACEHOLDER_RE.search(value):
        return False
    return True


def field_has_content(text: str, field_label: str) -> bool:
    """Check host declaration fields that may be headings or bullet labels."""
    if slot_has_content(text, field_label):
        return True

    target = normalize_field_label(field_label)
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("<!--"):
            continue
        stripped = stripped.lstrip("-").strip()
        if ":" not in stripped:
            continue
        label, value = stripped.split(":", 1)
        if normalize_field_label(label) != target:
            continue
        return field_value_has_content(value)
    return False


def validate_required_slots(path: Path, spec: ContractSpec) -> list[Violation]:
    violations: list[Violation] = []
    if not path.exists() or not spec.required_slots:
        return violations
    text = path.read_text(encoding="utf-8")
    headings = heading_lines(text)
    heading_names_lower = {h.lower() for h in headings}
    for slot in spec.required_slots:
        if slot.lower() not in heading_names_lower:
            violations.append(Violation(
                file_path=path, line_number=0, code="MISSING_SLOT",
                message=f"Required contract slot not found: '{slot}'",
            ))
        elif not slot_has_content(text, slot):
            violations.append(Violation(
                file_path=path, line_number=headings.get(slot, 0), code="EMPTY_SLOT",
                message=f"Required contract slot has no content: '{slot}'",
            ))
    return violations


def validate_presence(contracts_dir: Path) -> list[Violation]:
    violations: list[Violation] = []
    for name, spec in FRAMEWORK_SPECS.items():
        path = contracts_dir / name
        if not path.exists():
            violations.append(Violation(
                file_path=path, line_number=0, code="MISSING_FILE",
                message=f"Required contract file not found: {name}",
            ))
        elif path.stat().st_size == 0:
            violations.append(Violation(
                file_path=path, line_number=0, code="EMPTY_FILE",
                message=f"Contract file is empty: {name}",
            ))
    return violations


def validate_required_headings(path: Path, spec: ContractSpec) -> list[Violation]:
    violations: list[Violation] = []
    if not path.exists():
        return violations
    text = path.read_text(encoding="utf-8")
    headings = heading_lines(text)
    heading_names_lower = {h.lower() for h in headings}
    for required in spec.required_headings:
        if required.lower() not in heading_names_lower:
            violations.append(Violation(
                file_path=path, line_number=0, code="MISSING_HEADING",
                message=f"Required heading not found: '{required}'",
            ))
    return violations


def validate_links(path: Path, base_dir: Path) -> list[Violation]:
    violations: list[Violation] = []
    if not path.exists():
        return violations
    text = path.read_text(encoding="utf-8")
    for line_num, target in extract_markdown_links(text):
        if not target:
            continue
        resolved = (path.parent / target).resolve()
        if not resolved.exists():
            violations.append(Violation(
                file_path=path, line_number=line_num, code="BROKEN_LINK",
                message=f"Link target not found: '{target}'",
            ))
    return violations


def validate_host_declarations(host_dir: Path, *, strict_slots: bool = False) -> list[Violation]:
    violations: list[Violation] = []
    if not host_dir.exists():
        return violations
    for name in (
        "computational-controls.md",
        "runtime-validation.md",
        "architecture-fitness.md",
        "specs-as-built-freshness.md",
    ):
        path = host_dir / name
        if path.exists():
            text = path.read_text(encoding="utf-8")
            headings = heading_lines(text)
            if not headings:
                violations.append(Violation(
                    file_path=path, line_number=0, code="NO_HEADINGS",
                    message="Host declaration file has no markdown headings",
                ))
            if strict_slots:
                for slot in HOST_DECLARATION_SLOTS.get(name, ()):
                    if not field_has_content(text, slot):
                        violations.append(Violation(
                            file_path=path, line_number=0, code="MISSING_HOST_FIELD",
                            message=f"Host declaration field missing or empty: '{slot}'",
                        ))
    return violations


def scan_all(host_declarations_dir: Path | None = None, *, skip_live_host: bool = False) -> list[Violation]:
    violations: list[Violation] = []
    violations.extend(validate_presence(CONTRACTS_DIR))
    for name, spec in FRAMEWORK_SPECS.items():
        path = CONTRACTS_DIR / name
        violations.extend(validate_required_headings(path, spec))
        violations.extend(validate_required_slots(path, spec))
        violations.extend(validate_links(path, CONTRACTS_DIR))
    violations.extend(validate_host_declarations(TEMPLATE_HOST_DECLARATIONS_DIR))

    if not skip_live_host:
        live_host_dir = host_declarations_dir or default_knowledge_root() / "governance" / "contracts"
        if live_host_dir.resolve() != TEMPLATE_HOST_DECLARATIONS_DIR.resolve():
            violations.extend(validate_host_declarations(live_host_dir, strict_slots=True))
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--host-declarations",
        type=Path,
        default=None,
        help="Validate live host contract declarations at this directory.",
    )
    parser.add_argument(
        "--skip-live-host",
        action="store_true",
        help="Only validate framework contracts and the committed project-knowledge template.",
    )
    args = parser.parse_args()

    violations = scan_all(args.host_declarations, skip_live_host=args.skip_live_host)
    if violations:
        print(f"\n{len(violations)} contract validation issue(s) found:", file=sys.stderr)
        for v in violations:
            loc = f":{v.line_number}" if v.line_number else ""
            print(f"  [{v.code}] {v.file_path}{loc} — {v.message}", file=sys.stderr)
        return 1
    print("All contract files valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
