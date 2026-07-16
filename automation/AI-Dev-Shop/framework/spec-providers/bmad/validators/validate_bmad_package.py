#!/usr/bin/env python3
"""Validate a BMAD planning package for AI Dev Shop compatibility."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# Standard track artifacts
STANDARD_REQUIRED = ["planning-artifacts/PRD.md"]
STANDARD_EXPECTED = ["planning-artifacts/architecture.md"]
STANDARD_OPTIONAL = [
    "planning-artifacts/product-brief.md",
    "planning-artifacts/ux-spec.md",
    "project-context.md",
]

BMAD_PLACEHOLDERS = [
    "<project-name>",
    "<author-name>",
    "<date>",
    "<role>",
    "<action>",
    "<benefit>",
    "<precondition>",
    "<expected-outcome>",
    "<story-title>",
    "<epic-title>",
    "<decision-title>",
    "<feature-title>",
    "<!-- requirement -->",
    "<!-- constraint -->",
    "<!-- metric -->",
    "<!-- target -->",
    "<!-- how measured -->",
    "<!-- dependency -->",
    "<!-- what -->",
    "<!-- risk -->",
    "<!-- component -->",
    "<!-- what it does -->",
    "<!-- tech -->",
    "<!-- rationale -->",
    "<!-- impact -->",
    "<!-- mitigation -->",
    "<!-- goal -->",
    "<!-- non-goal -->",
    "<!-- covered / pending -->",
    "<!-- approach -->",
]

QUICK_DEV_PLACEHOLDERS = [
    "<feature-title>",
    "<date>",
    "<file-path>",
    "<command>",
    "<!-- 1-2 sentences describing the problem -->",
    "<!-- 1-2 sentences describing the solution approach -->",
    "<!-- scenario -->",
    "<!-- input -->",
    "<!-- output -->",
    "<!-- error handling -->",
    "<!-- action -->",
    "<!-- rationale -->",
    "<!-- success criteria -->",
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def detect_track(output_root: Path) -> str | None:
    """Auto-detect BMAD track from file structure."""
    # Check for quick dev specs first
    quick_dev_specs = list(output_root.glob("spec-*.md"))
    if quick_dev_specs:
        return "quick_dev"

    # Check for standard track
    prd_path = output_root / "planning-artifacts" / "PRD.md"
    if prd_path.exists():
        return "standard_bmm"

    # Check if planning-artifacts exists at all
    if (output_root / "planning-artifacts").exists():
        return "standard_bmm"

    return None


def check_placeholders(text: str, path_label: str, placeholders: list[str], errors: list[str]) -> None:
    for placeholder in placeholders:
        if placeholder in text:
            errors.append(
                f"Template placeholder still present in {path_label}: `{placeholder}`"
            )


def validate_standard_track(output_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    # Check PRD
    prd_path = output_root / "planning-artifacts" / "PRD.md"
    if not prd_path.exists():
        errors.append("Missing required file: planning-artifacts/PRD.md")
    elif prd_path.stat().st_size == 0:
        errors.append("planning-artifacts/PRD.md exists but is empty")
    else:
        prd_text = read_text(prd_path)

        # Check for key sections
        required_sections = [
            "## Functional Requirements",
            "## User Stories",
            "## Scope",
        ]
        for section in required_sections:
            if section not in prd_text:
                errors.append(f"PRD.md is missing required section: {section}")

        # Check for at least one requirement
        if not re.search(r"^- FR-\d+:", prd_text, re.MULTILINE):
            errors.append("PRD.md has no functional requirements (expected 'FR-01:' format)")

        # Check for at least one user story
        if "As a " not in prd_text:
            errors.append("PRD.md has no user stories (expected 'As a [role]' format)")

        check_placeholders(prd_text, "PRD.md", BMAD_PLACEHOLDERS, errors)

    # Check architecture
    arch_path = output_root / "planning-artifacts" / "architecture.md"
    if not arch_path.exists():
        errors.append("Missing required file: planning-artifacts/architecture.md")
    elif arch_path.stat().st_size == 0:
        errors.append("planning-artifacts/architecture.md exists but is empty")
    else:
        arch_text = read_text(arch_path)
        if "## Technical Decisions" not in arch_text and "## Decisions" not in arch_text:
            errors.append("architecture.md has no Technical Decisions section — required by planning surface gate")
        check_placeholders(arch_text, "architecture.md", BMAD_PLACEHOLDERS, errors)

    # Check epics
    epics_dir = output_root / "planning-artifacts" / "epics"
    if not epics_dir.exists() or not epics_dir.is_dir():
        errors.append("Missing required directory: planning-artifacts/epics/")
    else:
        epic_files = list(epics_dir.glob("*.md"))
        if not epic_files:
            errors.append("No epic files found under planning-artifacts/epics/")
        else:
            for epic_file in epic_files:
                epic_text = read_text(epic_file)
                rel_path = epic_file.relative_to(output_root)

                # Check for stories
                if "As a " not in epic_text:
                    errors.append(f"{rel_path}: no user stories found")

                # Check for per-story acceptance criteria
                # Split on story boundaries and check each story has GWT
                story_blocks = re.split(r"(?=### Story\b|## Story\b|### US-)", epic_text)
                gwt_pattern = re.compile(
                    r"Given\s+.+?,\s*when\s+.+?,\s*then\s+",
                    re.IGNORECASE,
                )
                story_count = 0
                stories_without_gwt = 0
                for block in story_blocks:
                    if re.match(r"###?\s*(Story|US-)", block):
                        story_count += 1
                        if not gwt_pattern.search(block):
                            stories_without_gwt += 1
                if story_count == 0:
                    # Fall back to file-level GWT check if no story markers found
                    if not gwt_pattern.search(epic_text):
                        errors.append(
                            f"{rel_path}: no Given/When/Then acceptance criteria found"
                        )
                elif stories_without_gwt > 0:
                    errors.append(
                        f"{rel_path}: {stories_without_gwt} of {story_count} stories missing Given/When/Then acceptance criteria"
                    )

                check_placeholders(epic_text, str(rel_path), BMAD_PLACEHOLDERS, errors)

    # Check optional files
    for optional_path_str in STANDARD_OPTIONAL:
        optional_path = output_root / optional_path_str
        if optional_path.exists() and optional_path.stat().st_size > 0:
            opt_text = read_text(optional_path)
            check_placeholders(opt_text, optional_path_str, BMAD_PLACEHOLDERS, errors)

    return errors, warnings


def validate_quick_dev_track(output_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    spec_files = list(output_root.glob("spec-*.md"))
    if not spec_files:
        errors.append("No quick-dev spec files found (expected 'spec-*.md')")
        return errors, warnings

    for spec_file in spec_files:
        spec_text = read_text(spec_file)
        label = spec_file.name

        # Check required sections
        required_sections = [
            "## Intent",
            "## Boundaries & Constraints",
            "## Tasks & Acceptance",
            "## Verification",
        ]
        for section in required_sections:
            if section not in spec_text:
                errors.append(f"{label} is missing required section: {section}")

        # Check for acceptance criteria
        gwt_pattern = re.compile(
            r"Given\s+.+?,\s*when\s+.+?,\s*then\s+",
            re.IGNORECASE,
        )
        if not gwt_pattern.search(spec_text):
            errors.append(f"{label}: no Given/When/Then acceptance criteria found")

        # Check for at least one task
        checkbox_pattern = re.compile(r"^- \[[ x]\]", re.MULTILINE)
        if not checkbox_pattern.search(spec_text):
            errors.append(f"{label}: no checkbox tasks found (expected '- [ ]' format)")

        # Check Intent section has content
        intent_match = re.search(r"## Intent\s*\n(.*?)(?=\n##|\Z)", spec_text, re.DOTALL)
        if intent_match:
            intent_content = intent_match.group(1).strip()
            if not intent_content or "Problem:" not in intent_content:
                errors.append(f"{label}: Intent section is missing Problem statement")

        check_placeholders(spec_text, label, QUICK_DEV_PLACEHOLDERS, errors)

    return errors, warnings


def validate(output_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not output_root.exists():
        return [f"Output folder does not exist: {output_root}"], warnings
    if not output_root.is_dir():
        return [f"Output path is not a directory: {output_root}"], warnings

    track = detect_track(output_root)
    if track is None:
        return [
            f"Cannot detect BMAD track in {output_root}. "
            "Expected either planning-artifacts/PRD.md (standard) or spec-*.md (quick dev)."
        ], warnings

    if track == "standard_bmm":
        errors, warnings = validate_standard_track(output_root)
    else:
        errors, warnings = validate_quick_dev_track(output_root)

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate a BMAD planning package for AI Dev Shop compatibility."
    )
    parser.add_argument("output_dir", help="Path to the BMAD output folder")
    args = parser.parse_args()

    output_root = Path(args.output_dir).expanduser().resolve()
    errors, warnings = validate(output_root)

    track = detect_track(output_root)
    track_label = track or "unknown"

    print("BMAD Planning Package Validator")
    print("-------------------------------")
    print(f"Output root: {output_root}")
    print(f"Detected track: {track_label}")

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    if errors:
        print("VIOLATION:")
        for error in errors:
            print(f"  - {error}")
        print("FIX:")
        print(
            "  Repair the planning package, rerun this validator, and do not hand off "
            "to `/plan` until it exits cleanly."
        )
        return 1

    print(f"PASS: BMAD {track_label} package passed mechanical validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
