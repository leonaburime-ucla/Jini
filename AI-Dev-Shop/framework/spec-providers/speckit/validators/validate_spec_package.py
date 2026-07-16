#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path


VALID_PHASES = {"spec", "preflight"}
VALID_SPEC_MODES = {"greenfield", "brownfield", "reverse_spec", "migration"}

ALWAYS_REQUIRED = [
    "feature.spec.md",
    "traceability.spec.md",
    "spec-manifest.md",
    "spec-dod.md",
]

GENERIC_NA_NOTES = {
    "",
    "-",
    "\u2014",
    "n/a",
    "na",
    "none",
    "not applicable",
}

OPTIONAL = [
    "api.spec.md",
    "state.spec.md",
    "orchestrator.spec.md",
    "ui.spec.md",
    "errors.spec.md",
    "behavior.spec.md",
]

ALL_LOGICAL_FILES = ALWAYS_REQUIRED[:1] + OPTIONAL + ALWAYS_REQUIRED[1:]

EXPECTED_DOD_ITEMS = (
    [f"A-{idx:02d}" for idx in range(1, 11)]
    + [f"B-{idx:02d}" for idx in range(1, 33)]
    + [f"C-{idx:02d}" for idx in range(1, 20)]
    + [f"D-{idx:02d}" for idx in range(1, 11)]
    + [f"E-{idx:02d}" for idx in range(1, 9)]
    + [f"F-{idx:02d}" for idx in range(1, 9)]
    + [f"G-{idx:02d}" for idx in range(1, 9)]
    + ["H-01"]
)

PLACEHOLDER_MARKERS = [
    "SPEC-<NNN>",
    "FEAT-<NNN>-<short-feature-name>",
    "<feature-name>",
    "<short-feature-name>",
    "<semver",
    "<ISO-8601",
    "<one-line purpose>",
    "<one sentence>",
    "<notes>",
    "<precondition>",
    "<action>",
    "<observable outcome>",
    "<actual filename>",
    "<actual feature spec>",
    "<path or symbol>",
    "<path, report, or symbol>",
    "<constraint, integration boundary, or preservation evidence>",
    "<reviewer, timestamp, reason, manual checks, or `N/A`>",
]

BLOCKING_MARKERS = [
    "[NEEDS CLARIFICATION:",
    "[HUMAN DATA REQUEST",
    "[CONTRACT VS IMPLEMENTATION",
    "[DISTRIBUTED TRANSACTION RISK",
    "[OWNERSHIP UNCLEAR]",
]


def find_by_suffix(root: Path, suffix: str) -> list[Path]:
    return sorted(
        p
        for p in root.glob("*.md")
        if p.is_file() and p.name.endswith(suffix)
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_table_markup(value: str) -> str:
    return re.sub(r"[*_`]", "", value).strip()


def extract_table_value(text: str, key: str) -> str | None:
    pattern = re.compile(rf"^\|\s*{re.escape(key)}\s*\|\s*(.*?)\s*\|$", re.MULTILINE)
    match = pattern.search(text)
    return match.group(1).strip() if match else None


def find_manifest_row_status(manifest_text: str, logical_name: str) -> str | None:
    pattern = re.compile(
        rf"^\|\s*`{re.escape(logical_name)}`\s*\|\s*([A-Z]+)\s*\|",
        re.MULTILINE,
    )
    match = pattern.search(manifest_text)
    return match.group(1).strip() if match else None


def canonical_feature_content(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")

    header_idx = next(
        (idx for idx, line in enumerate(lines) if line.strip() == "## Header Metadata"),
        None,
    )
    if header_idx is None:
        return "\n".join(line.rstrip() for line in lines).strip() + "\n"

    table_start = next(
        (
            idx
            for idx in range(header_idx + 1, len(lines))
            if lines[idx].lstrip().startswith("|")
        ),
        None,
    )
    if table_start is None:
        return "\n".join(line.rstrip() for line in lines).strip() + "\n"

    table_end = table_start
    while table_end < len(lines) and lines[table_end].lstrip().startswith("|"):
        table_end += 1
    if table_end < len(lines) and lines[table_end].strip() == "":
        table_end += 1

    body_lines = [line.rstrip() for line in lines[:header_idx] + lines[table_end:]]
    while body_lines and body_lines[0] == "":
        body_lines.pop(0)
    while body_lines and body_lines[-1] == "":
        body_lines.pop()
    return "\n".join(body_lines) + "\n"


def compute_feature_hash(text: str) -> str:
    digest = hashlib.sha256(canonical_feature_content(text).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def parse_dod_statuses(text: str) -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for line in text.splitlines():
        if not re.match(r"^\|\s*[*_`]*[A-H]-\d+[*_`]*\s*\|", line):
            continue
        parts = [part.strip() for part in line.split("|")[1:-1]]
        if len(parts) < 4:
            continue
        rows.append((
            strip_table_markup(parts[0]),
            strip_table_markup(parts[2]).upper(),
            parts[3],
        ))
    return rows


def parse_signoff_rows(text: str) -> dict[str, list[str]]:
    rows: dict[str, list[str]] = {}
    in_signoff = False
    for line in text.splitlines():
        if line.strip() == "## Sign-Off Block":
            in_signoff = True
            continue
        if in_signoff and line.startswith("## "):
            break
        if not in_signoff or not line.lstrip().startswith("|"):
            continue
        parts = [part.strip() for part in line.split("|")[1:-1]]
        if not parts:
            continue
        role_key = strip_table_markup(parts[0])
        if role_key in {"Role", "---"} or set(role_key) == {"-"}:
            continue
        rows[role_key] = parts[1:]
    return rows


def has_concrete_na_notes(notes: str) -> bool:
    normalized = strip_table_markup(notes).strip().lower()
    if normalized in GENERIC_NA_NOTES:
        return False
    return len(re.findall(r"[a-z0-9]+", normalized)) >= 4


def is_filled(value: str) -> bool:
    stripped = value.strip()
    if not stripped:
        return False
    if stripped.lower() in {"tbd", "todo", "n/a", "na", "none"}:
        return False
    if stripped in {"-", "\u2014"}:
        return False
    if stripped.startswith("<") and stripped.endswith(">"):
        return False
    return True


def is_iso8601_utc(value: str) -> bool:
    return bool(
        re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})",
            value.strip(),
        )
    )


def collect_feature_ids(feature_text: str, pattern: str) -> list[str]:
    return re.findall(pattern, feature_text, flags=re.MULTILINE)


def update_table_value(text: str, key: str, value: str) -> tuple[str, bool]:
    pattern = re.compile(
        rf"(^\|\s*{re.escape(key)}\s*\|\s*)(.*?)(\s*\|$)",
        re.MULTILINE,
    )

    def replace(match: re.Match[str]) -> str:
        return f"{match.group(1)}{value}{match.group(3)}"

    updated, count = pattern.subn(replace, text, count=1)
    return updated, count == 1


def update_feature_hash(spec_root: Path, write: bool) -> tuple[list[str], str | None]:
    if not spec_root.exists():
        return [f"Spec folder does not exist: {spec_root}"], None
    if not spec_root.is_dir():
        return [f"Spec path is not a directory: {spec_root}"], None

    feature_matches = find_by_suffix(spec_root, "feature.spec.md")
    if not feature_matches:
        return ["Missing required file matching '*feature.spec.md'"], None
    if len(feature_matches) > 1:
        return [
            "Expected exactly one file matching '*feature.spec.md', found "
            f"{len(feature_matches)}: "
            + ", ".join(str(p.name) for p in feature_matches)
        ], None

    feature_path = feature_matches[0]
    feature_text = read_text(feature_path)
    feature_hash = compute_feature_hash(feature_text)
    updated_text, found = update_table_value(feature_text, "content_hash", feature_hash)
    if not found:
        return [f"{feature_path.name}: missing content_hash metadata row"], feature_hash
    if write and updated_text != feature_text:
        feature_path.write_text(updated_text, encoding="utf-8")
    return [], feature_hash


def has_brownfield_evidence(manifest_text: str) -> bool:
    in_section = False
    for line in manifest_text.splitlines():
        if line.strip() == "## Brownfield / Reverse-Spec References":
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if not in_section or not line.lstrip().startswith("|"):
            continue
        parts = [part.strip() for part in line.split("|")[1:-1]]
        if len(parts) < 3:
            continue
        evidence, evidence_type, reason = parts[:3]
        normalized_type = evidence_type.lower()
        if evidence in {"Evidence / Touchpoint", "---"} or set(evidence) == {"-"}:
            continue
        if evidence.startswith("<") or reason.startswith("<"):
            continue
        if normalized_type in {"n/a", "na"} or evidence.lower().startswith("n/a"):
            continue
        return True
    return False


def validate(spec_root: Path, phase: str = "preflight") -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if phase not in VALID_PHASES:
        return [f"Unknown validation phase: {phase}"], warnings

    if not spec_root.exists():
        return [f"Spec folder does not exist: {spec_root}"], warnings
    if not spec_root.is_dir():
        return [f"Spec path is not a directory: {spec_root}"], warnings

    discovered: dict[str, list[Path]] = {
        logical: find_by_suffix(spec_root, logical) for logical in ALL_LOGICAL_FILES
    }

    for logical in ALWAYS_REQUIRED:
        matches = discovered[logical]
        if not matches:
            errors.append(f"Missing required file matching '*{logical}'")
        elif len(matches) > 1:
            errors.append(
                f"Expected exactly one file matching '*{logical}', found {len(matches)}: "
                + ", ".join(str(p.name) for p in matches)
            )

    for logical in OPTIONAL:
        matches = discovered[logical]
        if len(matches) > 1:
            errors.append(
                f"Expected at most one file matching '*{logical}', found {len(matches)}: "
                + ", ".join(str(p.name) for p in matches)
            )

    manifest_matches = discovered["spec-manifest.md"]
    if manifest_matches:
        manifest_text = read_text(manifest_matches[0])
        for logical in ALL_LOGICAL_FILES:
            status = find_manifest_row_status(manifest_text, logical)
            if status is None:
                errors.append(f"spec-manifest.md is missing applicability row for `{logical}`")
                continue
            actual_exists = bool(discovered[logical])
            if logical in ALWAYS_REQUIRED:
                if status != "PRESENT":
                    errors.append(f"`{logical}` must be marked PRESENT in spec-manifest.md")
                if not actual_exists:
                    errors.append(f"`{logical}` is marked in manifest but file is missing on disk")
            else:
                if actual_exists and status != "PRESENT":
                    errors.append(f"`{logical}` exists on disk but is not marked PRESENT in spec-manifest.md")
                if not actual_exists and status != "OMITTED":
                    errors.append(f"`{logical}` is absent on disk and must be marked OMITTED in spec-manifest.md")
    else:
        manifest_text = ""

    for md_file in sorted(spec_root.glob("*.md")):
        text = read_text(md_file)
        for marker in BLOCKING_MARKERS:
            if marker in text:
                errors.append(f"Unresolved blocking marker `{marker}` in {md_file.name}")
        for marker in PLACEHOLDER_MARKERS:
            if marker in text:
                errors.append(f"Template placeholder `{marker}` still present in {md_file.name}")

    feature_matches = discovered["feature.spec.md"]
    if feature_matches:
        feature_text = read_text(feature_matches[0])
        status = extract_table_value(feature_text, "status")
        if status != "APPROVED":
            errors.append(f"{feature_matches[0].name}: status must be APPROVED, found {status or 'missing'}")

        spec_id = extract_table_value(feature_text, "spec_id")
        if not spec_id or not re.fullmatch(r"SPEC-\d{3,}", spec_id):
            errors.append(f"{feature_matches[0].name}: invalid or missing spec_id")

        version = extract_table_value(feature_text, "version")
        if not version or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            errors.append(f"{feature_matches[0].name}: invalid or missing semver version")

        feature_name = extract_table_value(feature_text, "feature_name")
        if not feature_name or not re.fullmatch(r"FEAT-\d{3}-[a-z0-9-]+", feature_name):
            errors.append(f"{feature_matches[0].name}: invalid or missing feature_name")

        spec_mode = extract_table_value(feature_text, "spec_mode")
        if not spec_mode or spec_mode.strip().lower() not in VALID_SPEC_MODES:
            errors.append(
                f"{feature_matches[0].name}: spec_mode must be one of "
                + ", ".join(sorted(VALID_SPEC_MODES))
            )
        elif spec_mode.strip().lower() in {"brownfield", "reverse_spec", "migration"}:
            if not manifest_text or not has_brownfield_evidence(manifest_text):
                errors.append(
                    "spec-manifest.md: Brownfield / Reverse-Spec References must cite "
                    f"at least one concrete evidence row for spec_mode `{spec_mode.strip()}`"
                )

        content_hash = extract_table_value(feature_text, "content_hash")
        if not content_hash or not re.fullmatch(r"sha256:[0-9a-f]{64}", content_hash):
            errors.append(f"{feature_matches[0].name}: invalid or missing content_hash")
        elif content_hash != compute_feature_hash(feature_text):
            errors.append(
                f"{feature_matches[0].name}: content_hash does not match canonical feature content "
                f"(expected {compute_feature_hash(feature_text)}, found {content_hash})"
            )

        owner = extract_table_value(feature_text, "owner")
        if not owner or owner in {"TBD", "<human name or team>"}:
            errors.append(f"{feature_matches[0].name}: owner must be set to a named human or team")

        req_ids = collect_feature_ids(feature_text, r"^- (REQ-\d+):",)
        ac_ids = collect_feature_ids(feature_text, r"^- (AC-\d+)\s+\(REQ-\d+\)")
        inv_ids = collect_feature_ids(feature_text, r"^- (INV-\d+):")
        ec_ids = collect_feature_ids(feature_text, r"^- (EC-\d+):")

        traceability_matches = discovered["traceability.spec.md"]
        if traceability_matches:
            traceability_text = read_text(traceability_matches[0])
            for req_id in req_ids:
                if req_id not in traceability_text:
                    errors.append(f"{traceability_matches[0].name}: missing {req_id} from traceability matrix")
            for ac_id in ac_ids:
                if ac_id not in traceability_text:
                    errors.append(f"{traceability_matches[0].name}: missing {ac_id} from traceability matrix")
            for inv_id in inv_ids:
                if inv_id not in traceability_text:
                    errors.append(f"{traceability_matches[0].name}: missing {inv_id} from invariant traceability")
            for ec_id in ec_ids:
                if ec_id not in traceability_text:
                    errors.append(f"{traceability_matches[0].name}: missing {ec_id} from edge-case traceability")

    dod_matches = discovered["spec-dod.md"]
    if dod_matches:
        dod_text = read_text(dod_matches[0])
        dod_rows = parse_dod_statuses(dod_text)
        if not dod_rows:
            errors.append(f"{dod_matches[0].name}: no checklist rows found")
        row_ids = [item_id for item_id, _status, _notes in dod_rows]
        for item_id in EXPECTED_DOD_ITEMS:
            if item_id not in row_ids:
                errors.append(f"{dod_matches[0].name}: missing required DoD checklist row {item_id}")
        duplicate_ids = sorted({item_id for item_id in row_ids if row_ids.count(item_id) > 1})
        for item_id in duplicate_ids:
            errors.append(f"{dod_matches[0].name}: duplicate DoD checklist row {item_id}")
        for item_id, status, notes in dod_rows:
            if status not in {"PASS", "NA"}:
                errors.append(f"{dod_matches[0].name}: {item_id} must be PASS or NA, found {status or 'blank'}")
            if status == "NA" and not has_concrete_na_notes(notes):
                errors.append(f"{dod_matches[0].name}: {item_id} is NA but lacks a concrete justification in Notes")
        if "Overall DoD Result:** PASS" not in dod_text and "Overall DoD Result: PASS" not in dod_text:
            errors.append(f"{dod_matches[0].name}: overall result must be PASS")

        signoff_rows = parse_signoff_rows(dod_text)
        required_signoffs = ("Spec Agent",) if phase == "spec" else ("Spec Agent", "Coordinator")
        if phase == "spec":
            coordinator_row = signoff_rows.get("Coordinator")
            if coordinator_row and any(is_filled(value) for value in coordinator_row[:3]):
                warnings.append(
                    f"{dod_matches[0].name}: Coordinator sign-off is present during spec-phase validation; "
                    "Coordinator must verify or replace it during Planning Preflight"
                )
        for role in required_signoffs:
            row = signoff_rows.get(role)
            if row is None:
                errors.append(f"{dod_matches[0].name}: Sign-Off Block missing {role} row")
                continue
            if len(row) < 3 or not all(is_filled(value) for value in row[:3]):
                errors.append(f"{dod_matches[0].name}: Sign-Off Block {role} row must include name, date, and signature")
                continue
            if not is_iso8601_utc(row[1]):
                errors.append(f"{dod_matches[0].name}: Sign-Off Block {role} date must be ISO-8601 UTC")

    extra_md = [
        p.name
        for p in sorted(spec_root.glob("*.md"))
        if not any(p.name.endswith(logical) for logical in ALL_LOGICAL_FILES)
    ]
    if extra_md:
        warnings.append(
            "Additional markdown files found in spec package root: " + ", ".join(extra_md)
        )

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate a strict Speckit compatibility spec package."
    )
    parser.add_argument("spec_dir", help="Path to the spec package directory")
    parser.add_argument(
        "--phase",
        choices=sorted(VALID_PHASES),
        default="preflight",
        help=(
            "Validation phase. Use 'spec' for Spec Agent handoff, where only the "
            "Spec Agent sign-off is required. Use 'preflight' before Architect "
            "dispatch, where Coordinator sign-off is also required."
        ),
    )
    parser.add_argument(
        "--update-hash",
        action="store_true",
        help="Rewrite feature.spec.md content_hash using the canonical hash rule before validating.",
    )
    parser.add_argument(
        "--print-hash",
        action="store_true",
        help="Print the canonical feature.spec.md content hash before validation.",
    )
    args = parser.parse_args()

    spec_root = Path(args.spec_dir).expanduser().resolve()
    hash_errors: list[str] = []
    feature_hash: str | None = None
    if args.update_hash or args.print_hash:
        hash_errors, feature_hash = update_feature_hash(spec_root, write=args.update_hash)

    errors, warnings = validate(spec_root, phase=args.phase)
    errors = hash_errors + errors

    print("Speckit Spec Package Validator")
    print("------------------------------")
    print(f"Spec root: {spec_root}")
    print(f"Phase: {args.phase}")
    if feature_hash:
        action = "updated" if args.update_hash else "computed"
        print(f"Feature hash {action}: {feature_hash}")

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    if errors:
        print("VIOLATION:")
        for error in errors:
            print(f"  - {error}")
        print("FIX:")
        print("  Repair the spec package, rerun this validator, and do not hand off to `/plan` until it exits cleanly.")
        return 1

    print("PASS: strict Speckit package passed mechanical validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
