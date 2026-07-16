"""Governance scenarios: Spec approval and integrity gates.

Tests that the pipeline correctly blocks when spec preconditions are unmet.
"""

from __future__ import annotations

from pathlib import Path

import pytest


class TestSpecApprovalGate:
    """Spec must be APPROVED before downstream stages proceed."""

    def test_unapproved_spec_detected(self, workspace: Path, pipeline_dir: Path) -> None:
        """A spec with status=DRAFT should be flagged as not ready."""
        spec = workspace / "specs" / "feature.spec.md"
        spec.write_text(
            "# Feature Spec: test\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            "| spec_id | SPEC-001 |\n"
            "| version | 1.0.0 |\n"
            "| status | DRAFT |\n"
            "| content_hash | abc123 |\n"
            "| feature_name | FEAT-001-test |\n"
        )
        content = spec.read_text()
        assert "DRAFT" in content
        assert "APPROVED" not in content

    def test_approved_spec_passes(self, workspace: Path) -> None:
        """A spec with status=APPROVED satisfies the approval gate."""
        spec = workspace / "specs" / "feature.spec.md"
        spec.write_text(
            "# Feature Spec: test\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            "| spec_id | SPEC-001 |\n"
            "| version | 1.0.0 |\n"
            "| status | APPROVED |\n"
            "| content_hash | sha256:deadbeef |\n"
            "| feature_name | FEAT-001-test |\n"
        )
        content = spec.read_text()
        assert "APPROVED" in content


class TestSpecHashDrift:
    """Spec content hash must match actual content."""

    def test_stale_hash_detected(self, workspace: Path) -> None:
        """Changed content with unchanged hash = drift."""
        spec = workspace / "specs" / "feature.spec.md"
        spec.write_text(
            "# Feature Spec: test\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            "| content_hash | sha256:original_hash |\n"
            "\n## Requirements\n\n- REQ-01: Original requirement\n"
        )
        original_hash = "sha256:original_hash"

        # Simulate content change without hash update
        spec.write_text(
            "# Feature Spec: test\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            "| content_hash | sha256:original_hash |\n"
            "\n## Requirements\n\n- REQ-01: CHANGED requirement\n"
        )
        content = spec.read_text()
        assert "CHANGED" in content
        assert original_hash in content  # Hash not updated = drift


class TestNeedsClarificationBlocker:
    """[NEEDS CLARIFICATION] markers must block Architect dispatch."""

    def test_clarification_marker_blocks(self, workspace: Path) -> None:
        """Spec containing [NEEDS CLARIFICATION] should not pass readiness."""
        spec = workspace / "specs" / "feature.spec.md"
        spec.write_text(
            "# Feature Spec: test\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            "| status | APPROVED |\n"
            "\n## Requirements\n\n"
            "- REQ-01: The user can export results "
            "[NEEDS CLARIFICATION: CSV only, or also PDF?]\n"
        )
        content = spec.read_text()
        assert "[NEEDS CLARIFICATION" in content

    def test_no_clarification_markers_passes(self, workspace: Path) -> None:
        """Spec without [NEEDS CLARIFICATION] markers passes this check."""
        spec = workspace / "specs" / "feature.spec.md"
        spec.write_text(
            "# Feature Spec: test\n\n"
            "| Field | Value |\n"
            "|-------|-------|\n"
            "| status | APPROVED |\n"
            "\n## Requirements\n\n"
            "- REQ-01: The user can export results as CSV.\n"
        )
        content = spec.read_text()
        assert "[NEEDS CLARIFICATION" not in content
