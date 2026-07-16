#!/usr/bin/env python3
"""Validate an OpenSpec change folder for AI Dev Shop compatibility."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_FILES = ["proposal.md"]

REQUIRED_PROPOSAL_SECTIONS = ["## Why", "## What Changes"]

PROPOSAL_PLACEHOLDERS = [
    "<change-name>",
    "<domain-name>",
    "<existing-domain-name>",
    "<!-- Explain the motivation",
    "<!-- Describe what will change",
    "<!-- Affected code, APIs",
    "<brief description of what this capability covers>",
    "<what requirement is changing>",
]

SPEC_PLACEHOLDERS = [
    "<domain-name>",
    "<!-- requirement name -->",
    "<!-- scenario name -->",
    "<!-- condition or trigger -->",
    "<!-- expected outcome",
    "<!-- requirement description",
    "<!-- Updated requirement description -->",
]

DESIGN_PLACEHOLDERS = [
    "<change-name>",
    "<!-- Background and current state",
    "<!-- goal -->",
    "<!-- non-goal -->",
    "<!-- decision name -->",
    "<!-- What was decided and why -->",
    "<!-- risk or trade-off -->",
]

TASKS_PLACEHOLDERS = [
    "<change-name>",
    "<!-- Task Group Name -->",
    "<!-- Task description",
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def validate(change_root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not change_root.exists():
        return [f"Change folder does not exist: {change_root}"], warnings
    if not change_root.is_dir():
        return [f"Change path is not a directory: {change_root}"], warnings

    # Check required files
    proposal_path = change_root / "proposal.md"
    if not proposal_path.exists():
        errors.append("Missing required file: proposal.md")
    elif proposal_path.stat().st_size == 0:
        errors.append("proposal.md exists but is empty")
    else:
        proposal_text = read_text(proposal_path)

        # Check required sections
        for section in REQUIRED_PROPOSAL_SECTIONS:
            if section not in proposal_text:
                errors.append(f"proposal.md is missing required section: {section}")

        # Check placeholders
        for placeholder in PROPOSAL_PLACEHOLDERS:
            if placeholder in proposal_text:
                errors.append(
                    f"Template placeholder still present in proposal.md: `{placeholder}`"
                )

    # Check delta specs
    specs_dir = change_root / "specs"
    if not specs_dir.exists() or not specs_dir.is_dir():
        errors.append("Missing required directory: specs/")
    else:
        spec_files = list(specs_dir.rglob("spec.md"))
        if not spec_files:
            errors.append("No delta spec files found under specs/")
        else:
            for spec_file in spec_files:
                spec_text = read_text(spec_file)
                rel_path = spec_file.relative_to(change_root)

                # Check for at least one requirement
                if "### Requirement:" not in spec_text:
                    errors.append(
                        f"{rel_path}: no requirements found (expected '### Requirement:')"
                    )

                # Check for at least one scenario per requirement
                req_count = spec_text.count("### Requirement:")
                scenario_count = spec_text.count("#### Scenario:")
                if scenario_count < req_count:
                    errors.append(
                        f"{rel_path}: found {req_count} requirements but only {scenario_count} scenarios "
                        f"— each requirement must have at least one scenario"
                    )

                # Check WHEN/THEN format in scenarios
                scenario_blocks = re.split(r"####\s+Scenario:", spec_text)[1:]
                for i, block in enumerate(scenario_blocks, 1):
                    # Only check up to the next heading
                    block = re.split(r"\n##", block)[0]
                    if "**WHEN**" not in block:
                        errors.append(
                            f"{rel_path}: scenario {i} is missing **WHEN** clause"
                        )
                    if "**THEN**" not in block:
                        errors.append(
                            f"{rel_path}: scenario {i} is missing **THEN** clause"
                        )

                # Check placeholders
                for placeholder in SPEC_PLACEHOLDERS:
                    if placeholder in spec_text:
                        errors.append(
                            f"Template placeholder still present in {rel_path}: `{placeholder}`"
                        )

    # Check domain-capability alignment: proposal capabilities should have matching spec folders
    proposal_path_for_domains = change_root / "proposal.md"
    if proposal_path_for_domains.exists() and specs_dir.exists():
        proposal_text_for_domains = read_text(proposal_path_for_domains)
        # Extract capability names from "### New Capabilities" and "### Modified Capabilities"
        cap_pattern = re.compile(r"^-\s+`(\S+)`", re.MULTILINE)
        declared_caps = set(cap_pattern.findall(proposal_text_for_domains))
        if declared_caps:
            existing_domains = {d.name for d in specs_dir.iterdir() if d.is_dir()}
            missing = declared_caps - existing_domains
            for cap in sorted(missing):
                errors.append(
                    f"Proposal declares capability '{cap}' but no matching specs/{cap}/spec.md exists"
                )

    # Check design.md (required by default spec-driven schema, omit only with justification)
    design_path = change_root / "design.md"
    if not design_path.exists():
        # Check if proposal.md contains explicit justification for omitting design.md
        has_justification = False
        if proposal_path_for_domains.exists():
            prop_text = read_text(proposal_path_for_domains)
            if (re.search(r"design\.md.{0,80}(omit|skip|not needed|not required|no technical)", prop_text, re.IGNORECASE)
                    or re.search(r"(omit|skip|not needed|not required|no technical).{0,80}design\.md", prop_text, re.IGNORECASE)):
                has_justification = True
        if has_justification:
            warnings.append(
                "design.md not found but proposal.md contains explicit justification for omission."
            )
        else:
            errors.append(
                "Missing required file: design.md — the default spec-driven schema requires it. "
                "If intentionally omitted, document the justification in proposal.md."
            )
    elif design_path.stat().st_size > 0:
        design_text = read_text(design_path)
        for placeholder in DESIGN_PLACEHOLDERS:
            if placeholder in design_text:
                errors.append(
                    f"Template placeholder still present in design.md: `{placeholder}`"
                )

    # Check tasks.md
    tasks_path = change_root / "tasks.md"
    if not tasks_path.exists():
        errors.append("Missing required file: tasks.md")
    elif tasks_path.stat().st_size == 0:
        errors.append("tasks.md exists but is empty")
    else:
        tasks_text = read_text(tasks_path)

        # Check for at least one checkbox
        checkbox_pattern = re.compile(r"^- \[[ x]\]", re.MULTILINE)
        checkboxes = checkbox_pattern.findall(tasks_text)
        if not checkboxes:
            errors.append("tasks.md has no checkbox items (expected '- [ ]' format)")

        # Check placeholders
        for placeholder in TASKS_PLACEHOLDERS:
            if placeholder in tasks_text:
                errors.append(
                    f"Template placeholder still present in tasks.md: `{placeholder}`"
                )

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate an OpenSpec change folder for AI Dev Shop compatibility."
    )
    parser.add_argument("change_dir", help="Path to the OpenSpec change folder")
    args = parser.parse_args()

    change_root = Path(args.change_dir).expanduser().resolve()
    errors, warnings = validate(change_root)

    print("OpenSpec Change Folder Validator")
    print("--------------------------------")
    print(f"Change root: {change_root}")

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
            "  Repair the change folder, rerun this validator, and do not hand off "
            "to `/plan` until it exits cleanly."
        )
        return 1

    print("PASS: OpenSpec change folder passed mechanical validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
