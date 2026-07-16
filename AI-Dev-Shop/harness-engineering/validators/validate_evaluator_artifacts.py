#!/usr/bin/env python3
from __future__ import annotations
import os

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOST_ROOT = ROOT.parent
REPO_WORKSPACE_ROOT = ROOT / "project-knowledge-template"


def resolve_workspace_root() -> Path:
    for key in ("ADS_MEMORY_ROOT", "ADS_PROJECT_KNOWLEDGE_ROOT", "ADS_WORKSPACE_ROOT"):
        raw = os.environ.get(key)
        if raw:
            return Path(raw).expanduser().resolve()
    sibling = HOST_ROOT / "ADS-memory"
    if sibling.exists():
        return sibling
    return REPO_WORKSPACE_ROOT


def display_path(path: Path) -> str:
    for base in (HOST_ROOT, ROOT):
        try:
            return path.relative_to(base).as_posix()
        except ValueError:
            continue
    return path.as_posix()


WORKSPACE_ROOT = resolve_workspace_root()
WORKSPACE_LABEL = display_path(WORKSPACE_ROOT)
PIPELINE_DIR = WORKSPACE_ROOT / "reports/pipeline"
CONTINUITY_DIR = WORKSPACE_ROOT / "reports/continuity"
META_RE = re.compile(r"^- ([A-Za-z][A-Za-z0-9 /_-]*):\s*(.+)$")

LEDGER_ALLOWED_MODES = {"not-needed", "optional", "required"}
CONTRACT_ALLOWED_MODES = {"optional", "required"}
REPORT_ALLOWED_RESULTS = {"pass", "revise", "blocked"}
CONTRACT_REQUIRED_HEADINGS = [
    "## Slice",
    "## Non-Goals",
    "## Completion Criteria",
    "## Runtime Surfaces To Exercise",
    "## Blocking Thresholds",
    "## Required Artifacts",
    "## Scoring Rubric",
    "## Generator Response Rule",
]
REPORT_REQUIRED_HEADINGS = [
    "## Scope Check",
    "## Findings By Severity",
    "### Blockers",
    "### Required Changes",
    "### Optional Improvements",
    "## Blocking Outcome",
    "## Strengths",
    "## Next Action For Generator",
]


@dataclass(frozen=True)
class Violation:
    path: Path
    message: str
    fix: str


def repo_relative(path: Path) -> str:
    for base in (HOST_ROOT, ROOT):
        try:
            return path.relative_to(base).as_posix()
        except ValueError:
            continue
    return path.as_posix()


def normalized_key(raw_key: str) -> str:
    return raw_key.strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_")


def parse_metadata(path: Path) -> tuple[dict[str, str], set[str]]:
    metadata: dict[str, str] = {}
    duplicates: set[str] = set()
    text = path.read_text(encoding="utf-8")
    started = False
    for line in text.splitlines():
        if line.startswith("# "):
            started = True
            continue
        if not started:
            continue
        if line.startswith("## "):
            break
        match = META_RE.match(line)
        if not match:
            continue
        key = normalized_key(match.group(1))
        if key in metadata:
            duplicates.add(key)
        metadata[key] = match.group(2).strip()
    return metadata, duplicates


def has_heading(text: str, heading: str) -> bool:
    return re.search(rf"^{re.escape(heading)}\s*$", text, flags=re.MULTILINE) is not None


def is_retained_evaluator_dir(path: Path) -> bool:
    try:
        rel = path.relative_to(WORKSPACE_ROOT).parts
    except ValueError:
        return False
    return len(rel) == 3 and rel[0] == "reports" and rel[1] in {"pipeline", "continuity"}


def progress_ledgers() -> list[Path]:
    return sorted(PIPELINE_DIR.glob("*/progress-ledger.md")) + sorted(CONTINUITY_DIR.glob("*/progress-ledger.md"))


def retained_contracts() -> list[Path]:
    return sorted(PIPELINE_DIR.glob("*/evaluator-contract-*.md")) + sorted(
        CONTINUITY_DIR.glob("*/evaluator-contract-*.md")
    )


def retained_reports() -> list[Path]:
    return sorted(PIPELINE_DIR.glob("*/evaluator-report-*.md")) + sorted(
        CONTINUITY_DIR.glob("*/evaluator-report-*.md")
    )


def resolve_repo_path(path_text: str) -> Path | None:
    if not path_text or path_text.lower() == "n/a":
        return None
    candidate = Path(path_text)
    if candidate.is_absolute():
        return None
    if candidate.parts[:1] == (WORKSPACE_ROOT.name,):
        return (WORKSPACE_ROOT.parent / candidate).resolve()
    for base in (HOST_ROOT, ROOT):
        resolved = (base / candidate).resolve()
        if resolved.exists():
            return resolved
    return (HOST_ROOT / candidate).resolve()


def validate_contract(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    text = path.read_text(encoding="utf-8")
    metadata, duplicates = parse_metadata(path)

    if not path.name.startswith("evaluator-contract-"):
        violations.append(
            Violation(
                path,
                "retained evaluator contract does not use the canonical filename prefix",
                f"rename it to evaluator-contract-<slug>.md under {WORKSPACE_LABEL}/reports/pipeline/<feature>/ or {WORKSPACE_LABEL}/reports/continuity/<workstream>/",
            )
        )

    if not is_retained_evaluator_dir(path.parent):
        violations.append(
            Violation(
                path,
                "retained evaluator contract is outside the canonical retained locations",
                f"move it under {WORKSPACE_LABEL}/reports/pipeline/<feature>/ or {WORKSPACE_LABEL}/reports/continuity/<workstream>/",
            )
        )

    for duplicate in sorted(duplicates):
        violations.append(
            Violation(
                path,
                f"retained evaluator contract has duplicate metadata after normalization for key '{duplicate}'",
                "use each metadata field once and avoid alternate spellings that normalize to the same key",
            )
        )

    for key in (
        "contract_slug",
        "workstream",
        "scope_type",
        "generator_owner",
        "evaluator_owner",
        "source_prompt_or_spec",
        "evaluator_mode",
        "artifacts_root",
        "opened_at",
        "last_updated_at",
    ):
        if key not in metadata:
            violations.append(
                Violation(
                    path,
                    f"retained evaluator contract is missing metadata field '{key}'",
                    "fill in the missing metadata using framework/templates/evaluator-contract-template.md",
                )
            )

    if metadata.get("evaluator_mode") and metadata["evaluator_mode"] not in CONTRACT_ALLOWED_MODES:
        violations.append(
            Violation(
                path,
                f"retained evaluator contract has invalid evaluator_mode '{metadata['evaluator_mode']}'",
                "use evaluator_mode: optional or evaluator_mode: required",
            )
        )

    artifacts_root = metadata.get("artifacts_root")
    resolved_artifacts_root = resolve_repo_path(artifacts_root) if artifacts_root else None
    if artifacts_root and resolved_artifacts_root is None:
        violations.append(
            Violation(
                path,
                f"retained evaluator contract has non-repo-relative artifacts_root '{artifacts_root}'",
                f"set Artifacts Root to a repo-relative retained path such as {WORKSPACE_LABEL}/reports/pipeline/<feature>/",
            )
        )
    elif resolved_artifacts_root is not None and not resolved_artifacts_root.exists():
        violations.append(
            Violation(
                path,
                f"retained evaluator contract points to missing artifacts_root '{artifacts_root}'",
                "update Artifacts Root to an existing retained reports directory",
            )
        )

    for heading in CONTRACT_REQUIRED_HEADINGS:
        if not has_heading(text, heading):
            violations.append(
                Violation(
                    path,
                    f"retained evaluator contract is missing section '{heading}'",
                    "add the missing section using framework/templates/evaluator-contract-template.md",
                )
            )

    return violations


def validate_report(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    text = path.read_text(encoding="utf-8")
    metadata, duplicates = parse_metadata(path)

    if not path.name.startswith("evaluator-report-"):
        violations.append(
            Violation(
                path,
                "retained evaluator report does not use the canonical filename prefix",
                "rename it to evaluator-report-<slug>-<YYYY-MM-DD-HHmm>.md",
            )
        )

    if not is_retained_evaluator_dir(path.parent):
        violations.append(
            Violation(
                path,
                "retained evaluator report is outside the canonical retained locations",
                f"move it under {WORKSPACE_LABEL}/reports/pipeline/<feature>/ or {WORKSPACE_LABEL}/reports/continuity/<workstream>/",
            )
        )

    for duplicate in sorted(duplicates):
        violations.append(
            Violation(
                path,
                f"retained evaluator report has duplicate metadata after normalization for key '{duplicate}'",
                "use each metadata field once and avoid alternate spellings that normalize to the same key",
            )
        )

    for key in ("contract", "workstream", "generator", "evaluator", "evaluated_at", "result"):
        if key not in metadata:
            violations.append(
                Violation(
                    path,
                    f"retained evaluator report is missing metadata field '{key}'",
                    "fill in the missing metadata using framework/templates/evaluator-report-template.md",
                )
            )

    if metadata.get("result") and metadata["result"] not in REPORT_ALLOWED_RESULTS:
        violations.append(
            Violation(
                path,
                f"retained evaluator report has invalid result '{metadata['result']}'",
                "use Result: pass, revise, or blocked",
            )
        )

    contract_text = metadata.get("contract")
    contract_path = resolve_repo_path(contract_text) if contract_text else None
    if contract_text and contract_path is None:
        violations.append(
            Violation(
                path,
                f"retained evaluator report has non-repo-relative contract path '{contract_text}'",
                "set Contract to a repo-relative evaluator-contract path",
            )
        )
    elif contract_path is not None and not contract_path.exists():
        violations.append(
            Violation(
                path,
                f"retained evaluator report references missing contract '{contract_text}'",
                "create the contract first or update Contract to the real retained path",
            )
        )
    elif contract_path is not None and contract_path.parent != path.parent:
        violations.append(
            Violation(
                path,
                f"retained evaluator report references contract outside its workstream folder '{contract_text}'",
                "store the retained evaluator report beside its retained evaluator contract in the same reports folder",
            )
        )

    for heading in REPORT_REQUIRED_HEADINGS:
        if not has_heading(text, heading):
            violations.append(
                Violation(
                    path,
                    f"retained evaluator report is missing section '{heading}'",
                    "add the missing section using framework/templates/evaluator-report-template.md",
                )
            )

    return violations


def validate_ledgers() -> list[Violation]:
    violations: list[Violation] = []
    for ledger in progress_ledgers():
        metadata, duplicates = parse_metadata(ledger)
        mode = metadata.get("evaluator_mode")
        contract_text = metadata.get("evaluator_contract")

        for duplicate in sorted(duplicates):
            violations.append(
                Violation(
                    ledger,
                    f"progress-ledger has duplicate metadata after normalization for key '{duplicate}'",
                    "use each ledger metadata field once and avoid alternate spellings that normalize to the same key",
                )
            )

        if mode is None and contract_text and contract_text.lower() != "n/a":
            violations.append(
                Violation(
                    ledger,
                    "progress-ledger records evaluator_contract without evaluator_mode",
                    "add evaluator_mode: optional or evaluator_mode: required to the ledger metadata",
                )
            )
            continue

        if mode is None:
            continue

        if mode not in LEDGER_ALLOWED_MODES:
            violations.append(
                Violation(
                    ledger,
                    f"progress-ledger has invalid evaluator_mode '{mode}'",
                    "use evaluator_mode: not-needed, optional, or required",
                )
            )
            continue

        if mode != "required":
            continue

        if not contract_text or contract_text.lower() == "n/a":
            violations.append(
                Violation(
                    ledger,
                    "progress-ledger marks evaluator_mode: required but does not record evaluator_contract",
                    "set evaluator_contract to the repo-relative retained evaluator-contract path",
                )
            )
            continue

        contract_path = resolve_repo_path(contract_text)
        if contract_path is None:
            violations.append(
                Violation(
                    ledger,
                    f"progress-ledger has non-repo-relative evaluator_contract '{contract_text}'",
                    "set evaluator_contract to a repo-relative path under the same reports workstream folder",
                )
            )
            continue

        if not contract_path.exists():
            violations.append(
                Violation(
                    ledger,
                    f"progress-ledger references missing evaluator contract '{contract_text}'",
                    "create the retained evaluator contract before continuing evaluator-mode work",
                )
            )
            continue

        if contract_path.parent != ledger.parent or not contract_path.name.startswith("evaluator-contract-"):
            violations.append(
                Violation(
                    ledger,
                    f"progress-ledger references non-canonical evaluator contract '{contract_text}'",
                    "keep the retained evaluator contract in the same reports folder as the ledger and name it evaluator-contract-<slug>.md",
                )
            )

    return violations


def main() -> int:
    violations = validate_ledgers()

    contracts = retained_contracts()
    reports = retained_reports()

    for contract in contracts:
        violations.extend(validate_contract(contract))
    for report in reports:
        violations.extend(validate_report(report))

    if violations:
        for violation in violations:
            print(f"VIOLATION: {repo_relative(violation.path)} -> {violation.message}")
            print(f"FIX: {violation.fix}")
        print(f"FAIL: {len(violations)} evaluator artifact violation(s) found.")
        return 1

    print(
        "PASS: evaluator artifact requirements satisfied "
        f"({len(progress_ledgers())} ledgers scanned, {len(contracts)} contract(s), {len(reports)} report(s))."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
