"""Regression tests for repo path-reference validation policy."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def load_path_reference_validator() -> ModuleType:
    validator_path = (
        Path(__file__).resolve().parents[1]
        / "validators"
        / "validate_path_references.py"
    )
    spec = importlib.util.spec_from_file_location(
        "validate_path_references", validator_path
    )
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class TestPeerDispatchPathPolicy:
    """Peer-dispatch scratch packets are exempt, but only under that prefix."""

    def test_peer_dispatch_scratch_paths_are_allowed(self) -> None:
        validator = load_path_reference_validator()

        assert validator.check_repo_reference(
            "tmp/peer-dispatch/audit-work/packet.md"
        )

    def test_tmp_paths_outside_peer_dispatch_are_not_allowed(self) -> None:
        validator = load_path_reference_validator()

        assert not validator.check_repo_reference("tmp/other/packet.md")
        assert not validator.check_repo_reference("tmp/peer-dispatches/packet.md")

    def test_missing_normal_repo_paths_are_not_allowed(self) -> None:
        validator = load_path_reference_validator()

        assert not validator.check_repo_reference(
            "framework/not-a-real-path-reference.md"
        )


class TestSpecsPrefixExemption:
    """Workspace-relative specs references are intentionally exempt."""

    def test_specs_prefix_is_allowed(self) -> None:
        validator = load_path_reference_validator()

        assert validator.check_repo_reference("specs/001-csv-export/feature.spec.md")

    def test_nearby_non_specs_prefix_is_not_allowed(self) -> None:
        validator = load_path_reference_validator()

        assert not validator.check_repo_reference(
            "specks/001-csv-export/feature.spec.md"
        )


class TestIntegrationsScanPolicy:
    """Integration docs are scanned, but ignored local checkouts are not."""

    def test_integration_readmes_are_scanned(self) -> None:
        validator = load_path_reference_validator()
        path = validator.ROOT / "integrations" / "codebase-memory-mcp" / "README.md"

        assert validator.should_scan_repo_file(path)

    def test_integration_upstream_markdown_is_not_scanned(self) -> None:
        validator = load_path_reference_validator()
        path = (
            validator.ROOT
            / "integrations"
            / "codebase-memory-mcp"
            / "upstream"
            / "README.md"
        )

        assert not validator.should_scan_repo_file(path)

    def test_integration_bin_markdown_is_not_scanned(self) -> None:
        validator = load_path_reference_validator()
        path = (
            validator.ROOT
            / "integrations"
            / "codebase-memory-mcp"
            / "bin"
            / "README.md"
        )

        assert not validator.should_scan_repo_file(path)

    def test_integration_venv_markdown_is_not_scanned(self) -> None:
        validator = load_path_reference_validator()
        path = validator.ROOT / "integrations" / "graphify" / ".venv" / "README.md"

        assert not validator.should_scan_repo_file(path)

    def test_integration_upstream_skill_markdown_is_scanned(self) -> None:
        validator = load_path_reference_validator()
        path = (
            validator.ROOT
            / "integrations"
            / "graphify"
            / "upstream-skill"
            / "codex"
            / "SKILL.md"
        )

        assert validator.should_scan_repo_file(path)

    def test_ignored_integration_bin_references_are_allowed_when_binary_missing(self) -> None:
        validator = load_path_reference_validator()
        path = "integrations/codebase-memory-mcp/bin/definitely-not-installed"

        assert not (validator.ROOT / path).exists()
        assert validator.check_repo_reference(path)

    def test_missing_non_ignored_integration_references_are_not_allowed(self) -> None:
        validator = load_path_reference_validator()

        assert not validator.check_repo_reference(
            "integrations/codebase-memory-mcp/not-a-real-file.md"
        )

    def test_integration_backtick_references_are_detected(self) -> None:
        validator = load_path_reference_validator()
        line = "`integrations/codebase-memory-mcp/README.md`"

        assert {
            match.group(1) for match in validator.BACKTICK_PATH_RE.finditer(line)
        } == {"integrations/codebase-memory-mcp/README.md"}
