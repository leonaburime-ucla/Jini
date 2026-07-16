"""Governance scenarios: Artifact integrity checks.

Tests that placeholder detection, path reference validation,
and DoD completeness gates work correctly.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest


PLACEHOLDER_PATTERNS = [
    r"<NNN>",
    r"<short-feature-name>",
    r"<feature-name>",
    r"<ISO-8601",
    r"<semver",
    r"<YYYY-MM-DD>",
    r"<human name",
    r"<agent ID",
    r"SPEC-<NNN>",
    r"FEAT-<NNN>",
    r"GOV-ADR-<NNN>",
]


class TestPlaceholderDetection:
    """Unfilled template placeholders in live artifacts must be caught."""

    def test_unfilled_placeholder_detected(self, workspace: Path) -> None:
        """A live artifact with template placeholders should fail validation."""
        live_file = workspace / "reports" / "pipeline" / "001-test-feature" / "adr.md"
        live_file.parent.mkdir(parents=True, exist_ok=True)
        live_file.write_text(
            "# ADR-SPEC-<NNN>: Placeholder Title\n\n"
            "- Status: ACCEPTED\n"
            "- Date: <ISO-8601 UTC>\n"
        )

        content = live_file.read_text()
        found = [p for p in PLACEHOLDER_PATTERNS if p in content]
        assert len(found) > 0, "Should detect unfilled placeholders"

    def test_filled_artifact_passes(self, workspace: Path) -> None:
        """A properly filled artifact should have no template placeholders."""
        live_file = workspace / "reports" / "pipeline" / "001-test-feature" / "adr.md"
        live_file.parent.mkdir(parents=True, exist_ok=True)
        live_file.write_text(
            "# ADR-SPEC-001: Billing Ledger Migration\n\n"
            "- Status: ACCEPTED\n"
            "- Date: 2026-06-03T16:00:00Z\n"
        )

        content = live_file.read_text()
        found = [p for p in PLACEHOLDER_PATTERNS if p in content]
        assert len(found) == 0, "Should have no unfilled placeholders"


class TestPathReferenceIntegrity:
    """Referenced files in governance docs must actually exist."""

    def test_adr_index_references_existing_file(self, workspace: Path) -> None:
        """ADR-INDEX.md file references should point to real files."""
        adrs = workspace / "governance" / "adrs"
        adr_file = adrs / "GOV-ADR-001-no-db-in-templates.md"
        adr_file.write_text("# GOV-ADR-001: No DB in templates\n")

        index = adrs / "ADR-INDEX.md"
        index.write_text(
            "# Governance ADR Index\n\n"
            "| ID | Title | Enforcement | Scope Globs | Status | File |\n"
            "|---|---|---|---|---|---|\n"
            "| GOV-ADR-001 | No DB in templates | DEFAULT | `src/templates/**` | ACCEPTED | `GOV-ADR-001-no-db-in-templates.md` |\n"
        )

        # Extract file references from index
        content = index.read_text()
        file_refs = re.findall(r"`(GOV-ADR-\d+-[^`]+\.md)`", content)
        for ref in file_refs:
            assert (adrs / ref).exists(), f"Referenced file {ref} must exist"

    def test_adr_index_detects_missing_file(self, workspace: Path) -> None:
        """ADR-INDEX.md referencing a non-existent file should be caught."""
        adrs = workspace / "governance" / "adrs"
        index = adrs / "ADR-INDEX.md"
        index.write_text(
            "# Governance ADR Index\n\n"
            "| ID | Title | Enforcement | Scope Globs | Status | File |\n"
            "|---|---|---|---|---|---|\n"
            "| GOV-ADR-001 | Ghost Rule | DEFAULT | `src/**` | ACCEPTED | `GOV-ADR-001-ghost.md` |\n"
        )

        content = index.read_text()
        file_refs = re.findall(r"`(GOV-ADR-\d+-[^`]+\.md)`", content)
        missing = [ref for ref in file_refs if not (adrs / ref).exists()]
        assert len(missing) > 0, "Should detect missing referenced ADR file"


class TestDoDCompleteness:
    """DoD must have all required items filled before passing."""

    def test_incomplete_dod_detected(self, workspace: Path) -> None:
        """A DoD with blank status fields should not pass."""
        dod = workspace / "specs" / "spec-dod.md"
        dod.write_text(
            "# Spec DoD\n\n"
            "| # | Item | Status | Notes |\n"
            "|---|------|--------|-------|\n"
            "| B-01 | spec_id assigned | PASS | |\n"
            "| B-02 | version set | | |\n"  # Blank = incomplete
            "| B-03 | status APPROVED | PASS | |\n"
        )

        content = dod.read_text()
        # Find rows with blank status
        lines = content.strip().split("\n")
        table_lines = [l for l in lines if l.startswith("|") and "---" not in l and "#" not in l]
        incomplete = [l for l in table_lines if "| |" in l or "| | |" in l]
        assert len(incomplete) > 0, "Should detect incomplete DoD items"

    def test_complete_dod_passes(self, workspace: Path) -> None:
        """A DoD with all items filled should pass."""
        dod = workspace / "specs" / "spec-dod.md"
        dod.write_text(
            "# Spec DoD\n\n"
            "| # | Item | Status | Notes |\n"
            "|---|------|--------|-------|\n"
            "| B-01 | spec_id assigned | PASS | |\n"
            "| B-02 | version set | PASS | |\n"
            "| B-03 | status APPROVED | PASS | |\n"
        )

        content = dod.read_text()
        lines = content.strip().split("\n")
        table_lines = [l for l in lines if l.startswith("|") and "---" not in l and "#" not in l]
        # Check all status cells are non-empty
        for line in table_lines:
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= 3:
                assert cells[2] != "", f"Status should be filled: {line}"
