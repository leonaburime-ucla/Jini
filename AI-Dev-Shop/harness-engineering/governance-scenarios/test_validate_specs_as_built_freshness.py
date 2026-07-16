"""Regression tests for specs-as-built freshness validation."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def load_freshness_validator() -> ModuleType:
    validator_path = (
        Path(__file__).resolve().parents[1]
        / "validators"
        / "validate_specs_as_built_freshness.py"
    )
    spec = importlib.util.spec_from_file_location(
        "validate_specs_as_built_freshness", validator_path
    )
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_artifact(
    path: Path,
    *,
    status: str,
    source_fingerprint: str,
) -> None:
    path.write_text(
        "---\n"
        "artifact_type: specs_as_built\n"
        f"status: {status}\n"
        "source_scope:\n"
        "  - src/app.py\n"
        f"source_fingerprint: {source_fingerprint}\n"
        "last_verified_commit: abc123\n"
        "last_verified_at: 2026-06-25T00:00:00Z\n"
        "reverse_spec_run: reverse-spec-001\n"
        "---\n"
        "# Artifact\n",
        encoding="utf-8",
    )


class TestSpecsAsBuiltStatusValidation:
    """Status metadata must stay inside the documented enum."""

    def test_invalid_status_value_is_reported(self, tmp_path: Path) -> None:
        validator = load_freshness_validator()
        source_root = tmp_path / "source"
        source_file = source_root / "src" / "app.py"
        source_file.parent.mkdir(parents=True)
        source_file.write_text("print('hello')\n", encoding="utf-8")
        fingerprint = validator.fingerprint_files(source_root, [source_file])
        artifact = tmp_path / "artifact.md"
        write_artifact(artifact, status="generated-but-stale", source_fingerprint=fingerprint)

        findings = validator.validate_metadata_file(artifact, source_root)

        assert any(finding.code == "INVALID_STATUS_VALUE" for finding in findings)

    def test_allowed_status_values_do_not_report_invalid_status(self, tmp_path: Path) -> None:
        validator = load_freshness_validator()
        source_root = tmp_path / "source"
        source_file = source_root / "src" / "app.py"
        source_file.parent.mkdir(parents=True)
        source_file.write_text("print('hello')\n", encoding="utf-8")
        fingerprint = validator.fingerprint_files(source_root, [source_file])

        for status in validator.ALLOWED_STATUS_VALUES:
            artifact = tmp_path / f"{status}.md"
            write_artifact(artifact, status=status, source_fingerprint=fingerprint)
            findings = validator.validate_metadata_file(artifact, source_root)

            assert all(finding.code != "INVALID_STATUS_VALUE" for finding in findings)

    def test_absent_status_does_not_report_invalid_status(self, tmp_path: Path) -> None:
        validator = load_freshness_validator()
        source_root = tmp_path / "source"
        source_file = source_root / "src" / "app.py"
        source_file.parent.mkdir(parents=True)
        source_file.write_text("print('hello')\n", encoding="utf-8")
        fingerprint = validator.fingerprint_files(source_root, [source_file])
        artifact = tmp_path / "artifact.md"
        artifact.write_text(
            "---\n"
            "artifact_type: specs_as_built\n"
            "source_scope:\n"
            "  - src/app.py\n"
            f"source_fingerprint: {fingerprint}\n"
            "last_verified_commit: abc123\n"
            "last_verified_at: 2026-06-25T00:00:00Z\n"
            "reverse_spec_run: reverse-spec-001\n"
            "---\n"
            "# Artifact\n",
            encoding="utf-8",
        )

        findings = validator.validate_metadata_file(artifact, source_root)

        assert all(finding.code != "INVALID_STATUS_VALUE" for finding in findings)
