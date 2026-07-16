"""Regression tests for contract declaration validation."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def load_contract_validator() -> ModuleType:
    validator_path = (
        Path(__file__).resolve().parents[1] / "validators" / "validate_contracts.py"
    )
    spec = importlib.util.spec_from_file_location("validate_contracts", validator_path)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class TestHostDeclarationPlaceholders:
    """Live host declarations need concrete values, not template placeholders."""

    def test_angle_bracket_host_placeholder_is_not_content(self) -> None:
        validator = load_contract_validator()
        text = "- Source root: `<HOST_PROJECT_ROOT>`\n"

        assert not validator.field_has_content(text, "Source root")

    def test_angle_bracket_workspace_placeholder_path_is_not_content(self) -> None:
        validator = load_contract_validator()
        text = "- Artifact root: `<ADS_MEMORY_ROOT>/specs_as_built/`\n"

        assert not validator.field_has_content(text, "Artifact root")

    def test_heading_slot_angle_bracket_placeholder_is_not_content(self) -> None:
        validator = load_contract_validator()
        text = "## Source root\n\n`<HOST_PROJECT_ROOT>`\n"

        assert not validator.field_has_content(text, "Source root")

    def test_concrete_host_path_counts_as_content(self) -> None:
        validator = load_contract_validator()
        text = "- Source root: `/workspace/app`\n"

        assert validator.field_has_content(text, "Source root")

    def test_literal_angle_brackets_can_still_be_content(self) -> None:
        validator = load_contract_validator()
        text = "- Validation rule: `List<str>`\n"

        assert validator.field_has_content(text, "Validation rule")

    def test_strict_host_validation_reports_placeholder_field(self, tmp_path: Path) -> None:
        validator = load_contract_validator()
        host_dir = tmp_path / "contracts"
        host_dir.mkdir()
        (host_dir / "specs-as-built-freshness.md").write_text(
            "# Specs-As-Built Freshness\n\n"
            "- Enforcement: strict\n"
            "- Artifact root: `<ADS_MEMORY_ROOT>/specs_as_built/`\n"
            "- Source root: `<HOST_PROJECT_ROOT>`\n"
            "- Validator: python3 harness-engineering/validators/validate_specs_as_built_freshness.py\n"
            "- Hard Blocking Change Types: source\n"
            "- Advisory Change Types: docs\n",
            encoding="utf-8",
        )

        violations = validator.validate_host_declarations(host_dir, strict_slots=True)
        messages = [violation.message for violation in violations]

        assert "Host declaration field missing or empty: 'Artifact root'" in messages
        assert "Host declaration field missing or empty: 'Source root'" in messages
