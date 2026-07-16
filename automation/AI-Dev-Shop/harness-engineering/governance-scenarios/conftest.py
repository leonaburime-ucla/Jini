"""Shared fixtures for governance scenario tests.

These tests verify pipeline governance invariants by creating realistic
file-system state and asserting expected behavior.

NOTE: Current tests validate governance logic patterns (glob matching,
status filtering, exception counting, placeholder detection) using
direct assertions. They do NOT yet call the real validator scripts
because those validators don't accept a configurable workspace root.
TODO: Refactor validators to accept ADS_WORKSPACE_ROOT env var, then
upgrade these tests to invoke real validators via run_validator().
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest


@pytest.fixture
def toolkit_root() -> Path:
    """Return the real toolkit root for running validators against."""
    return Path(__file__).resolve().parent.parent.parent


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """Create a temporary ADS-memory workspace with minimal structure."""
    gov = tmp_path / "governance"
    gov.mkdir()
    (gov / "constitution.md").write_text("# Constitution\n\nPlaceholder.\n")

    adrs = gov / "adrs"
    adrs.mkdir()
    (adrs / "ADR-INDEX.md").write_text(
        "# Governance ADR Index\n\n"
        "| ID | Title | Enforcement | Scope Globs | Status | File |\n"
        "|---|---|---|---|---|---|\n"
    )

    (tmp_path / "specs").mkdir()
    (tmp_path / "reports").mkdir()
    (tmp_path / "reports" / "pipeline").mkdir()
    (tmp_path / "memory").mkdir()

    return tmp_path


@pytest.fixture
def pipeline_dir(workspace: Path) -> Path:
    """Create a pipeline feature directory."""
    d = workspace / "reports" / "pipeline" / "001-test-feature"
    d.mkdir(parents=True, exist_ok=True)
    return d


def run_validator(
    toolkit_root: Path, validator_name: str, env_overrides: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    """Run a specific validator script and return the result."""
    script = toolkit_root / "harness-engineering" / "validators" / validator_name
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        ["python3", str(script)],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(toolkit_root),
    )
