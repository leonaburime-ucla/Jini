#!/usr/bin/env python3
"""Regression coverage for eval-suite validator/scorer edge cases.

The fixtures are generated in a temporary directory so the tests exercise the
real validator and scorer scripts without adding large static benchmark trees.
"""

from __future__ import annotations

import csv
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "harness-engineering/validators/validate_eval_suite.py"
SCORER = ROOT / "harness-engineering/quality/scripts/score_eval_suite.py"

MATRIX_FIELDS = [
    "cell_id",
    "agent",
    "agent_dimension",
    "bug_nature",
    "seed_structure",
    "difficulty",
    "requirement",
    "rationale",
    "seed_ids",
]
SEED_FIELDS = [
    "seed_id",
    "eval_name",
    "agent",
    "agent_dimension",
    "skill_source",
    "agent_guard",
    "bug_nature",
    "seed_structure",
    "difficulty",
    "domain_complexity",
    "complexity_category",
    "engineering_concepts",
    "control_type",
    "expected_severity",
    "false_positive_risk",
    "evidence_path",
    "detail_ref",
    "matrix_cell_id",
]
RUN_FIELDS = [
    "run_id",
    "eval_name",
    "run_scope",
    "execution_mode",
    "agent",
    "model_id",
    "model_label",
    "seed_id",
    "result",
    "severity_correct",
    "evidence_path",
    "evidence_excerpt",
    "reviewer_notes",
    "executed_at",
]
MANIFEST_FIELDS = [
    "run_id",
    "eval_name",
    "run_scope",
    "execution_mode",
    "agent",
    "model_id",
    "model_label",
    "execution_status",
    "scope_confirmation",
    "scope_confirmation_notes",
    "started_at",
    "completed_at",
    "artifact_path",
    "artifact_sha256",
    "transcript_path",
    "transcript_sha256",
]

BUG_NATURES = [
    "hidden_dependency",
    "invariant_violation",
    "semantic_mismatch",
    "omission",
]
CONCEPTS = [
    "query-optimization",
    "replication",
    "caching-systems",
    "schema-evolution",
    "authz-models",
    "serialization",
    "service-mesh",
    "multi-tenancy",
    "time-handling",
    "ordering-guarantees",
    "message-queues",
    "numerical-computing",
]
CATEGORIES = [
    "concurrency_composition",
    "distributed_state_divergence",
    "scale_threshold_collapse",
    "retry_amplification",
    "data_loss_window",
    "security_escalation_chain",
    "invariant_erosion",
    "observability_blind_spot",
    "configuration_interaction",
    "temporal_coupling",
    "migration_hazard",
    "resource_exhaustion_leak",
    "consensus_violation",
    "type_system_escape",
]
STAFF_PLUS_FIELDS = [
    "production_trigger",
    "deceptive_cues",
    "required_concepts",
    "causal_chain",
    "why_local_review_passes",
    "acceptable_root_cause",
    "unacceptable_shallow_answers",
    "minimum_evidence_chain",
    "domain_expert_note",
]


class RegressionFailure(AssertionError):
    pass


def classification(index: int) -> tuple[str, str, str, str, str]:
    if index <= 3:
        return "textbook", "na", "single", "Easy", "positive_control"
    if index <= 4:
        return "textbook", "na", "single", "Medium", "positive_control"
    if index <= 8:
        return "production", "na", "combined", "Medium", "standard"
    if index <= 22:
        return "staff", CATEGORIES[(index - 9) % len(CATEGORIES)], "distributed", "Hard", "standard"
    if index <= 32:
        return "principal", CATEGORIES[(index - 9) % len(CATEGORIES)], "layered", "Hard", "regression"
    if index <= 40:
        return "distinguished", CATEGORIES[(index - 9) % len(CATEGORIES)], "camouflaged", "Hard", "standard"
    return "production", "na", "interference", "Hard", "negative_control"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_tsv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


def read_tsv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        return list(reader.fieldnames or []), list(reader)


def create_suite(suite: Path) -> None:
    (suite / "depth-eval").mkdir(parents=True)
    (suite / "artifacts").mkdir()
    (suite / "transcripts").mkdir()
    (suite / "depth-eval/project-brief.md").write_text("# Depth Eval\n", encoding="utf-8")
    (suite / "controls.md").write_text(
        "# Controls\n\nPositive, negative, and regression controls are represented in seed-catalog.tsv.\n",
        encoding="utf-8",
    )

    matrix_rows: list[dict[str, str]] = []
    seed_rows: list[dict[str, str]] = []
    ledger_lines = ["# Seed Ledger", ""]

    for index in range(1, 55):
        seed_id = f"SEED-DEPTH-{index:02d}"
        dimension_id = ((index - 1) % 3) + 1
        dimension = f"{dimension_id}. Depth Dimension {dimension_id}"
        domain, category, structure, difficulty, control = classification(index)
        bug_nature = BUG_NATURES[(index - 1) % len(BUG_NATURES)]
        concept = CONCEPTS[(index - 1) % len(CONCEPTS)]
        cell_id = f"CELL-DEPTH-{index:02d}"

        matrix_rows.append(
            {
                "cell_id": cell_id,
                "agent": "database",
                "agent_dimension": dimension,
                "bug_nature": bug_nature,
                "seed_structure": structure,
                "difficulty": difficulty,
                "requirement": "required",
                "rationale": f"Required depth coverage for {seed_id}",
                "seed_ids": seed_id,
            }
        )
        seed_rows.append(
            {
                "seed_id": seed_id,
                "eval_name": "depth-eval",
                "agent": "database",
                "agent_dimension": dimension,
                "skill_source": "agent_persona",
                "agent_guard": "strict_depth_gate",
                "bug_nature": bug_nature,
                "seed_structure": structure,
                "difficulty": difficulty,
                "domain_complexity": domain,
                "complexity_category": category,
                "engineering_concepts": concept,
                "control_type": control,
                "expected_severity": "Required",
                "false_positive_risk": "Low" if control == "negative_control" else "None",
                "evidence_path": "depth-eval/project-brief.md",
                "detail_ref": f"seed-ledger.md#{seed_id.lower()}",
                "matrix_cell_id": cell_id,
            }
        )

        ledger_lines.extend([f"## {seed_id}", ""])
        if domain in {"staff", "principal", "distinguished"} and control != "negative_control":
            for field in STAFF_PLUS_FIELDS:
                ledger_lines.append(f"- {field}: valid {field} detail for {seed_id}")
        else:
            ledger_lines.append("- baseline_note: low-complexity or negative-control seed")
        ledger_lines.append("")

    write_tsv(suite / "coverage-matrix.tsv", MATRIX_FIELDS, matrix_rows)
    write_tsv(suite / "seed-catalog.tsv", SEED_FIELDS, seed_rows)
    (suite / "seed-ledger.md").write_text("\n".join(ledger_lines), encoding="utf-8")

    for run_index in range(1, 4):
        (suite / "artifacts" / f"run-{run_index}-output.md").write_text(
            f"# Run {run_index} Output\n\nAll seeded findings handled.\n",
            encoding="utf-8",
        )
        (suite / "transcripts" / f"run-{run_index}-transcript.md").write_text(
            f"# Run {run_index} Transcript\n\nSynthetic transcript.\n",
            encoding="utf-8",
        )

    manifest_rows = []
    run_rows = []
    for run_index in range(1, 4):
        run_id = f"run-depth-{run_index}"
        artifact = Path("artifacts") / f"run-{run_index}-output.md"
        transcript = Path("transcripts") / f"run-{run_index}-transcript.md"
        manifest_rows.append(
            {
                "run_id": run_id,
                "eval_name": "depth-eval",
                "run_scope": "benchmark_full",
                "execution_mode": "repo_persona_subagent",
                "agent": "database",
                "model_id": "synthetic-depth-validator",
                "model_label": "Synthetic Depth Validator",
                "execution_status": "completed",
                "scope_confirmation": "confirmed",
                "scope_confirmation_notes": "Synthetic 54-seed validation suite for depth-gate harness checks.",
                "started_at": f"2026-05-11T21:4{run_index}:00Z",
                "completed_at": f"2026-05-11T21:4{run_index}:30Z",
                "artifact_path": str(artifact),
                "artifact_sha256": sha256(suite / artifact),
                "transcript_path": str(transcript),
                "transcript_sha256": sha256(suite / transcript),
            }
        )
        for seed in seed_rows:
            is_negative_control = seed["control_type"] == "negative_control"
            run_rows.append(
                {
                    "run_id": run_id,
                    "eval_name": "depth-eval",
                    "run_scope": "benchmark_full",
                    "execution_mode": "repo_persona_subagent",
                    "agent": "database",
                    "model_id": "synthetic-depth-validator",
                    "model_label": "Synthetic Depth Validator",
                    "seed_id": seed["seed_id"],
                    "result": "CORRECT_SKIP" if is_negative_control else "CAUGHT",
                    "severity_correct": "na" if is_negative_control else "yes",
                    "evidence_path": str(artifact),
                    "evidence_excerpt": (
                        "Correctly skipped seeded non-bug."
                        if is_negative_control
                        else "Caught seeded issue with root cause."
                    ),
                    "reviewer_notes": "Synthetic validation row.",
                    "executed_at": f"2026-05-11T21:4{run_index}:30Z",
                }
            )
    write_tsv(suite / "run-manifest.tsv", MANIFEST_FIELDS, manifest_rows)
    write_tsv(suite / "run-results.tsv", RUN_FIELDS, run_rows)


def copy_suite(src: Path, dest: Path) -> Path:
    shutil.copytree(src, dest)
    return dest


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RegressionFailure(f"Could not find mutation target in {path}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def mutate_extra_field(suite: Path) -> None:
    path = suite / "seed-catalog.tsv"
    lines = path.read_text(encoding="utf-8").splitlines()
    lines[1] = f"{lines[1]}\textra-field"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def mutate_missing_depth_columns(suite: Path) -> None:
    path = suite / "seed-catalog.tsv"
    fields, rows = read_tsv(path)
    keep = [
        field
        for field in fields
        if field not in {"domain_complexity", "complexity_category", "engineering_concepts"}
    ]
    write_tsv(path, keep, [{field: row[field] for field in keep} for row in rows])


def mutate_non_nc_correct_skip(suite: Path) -> None:
    path = suite / "run-results.tsv"
    fields, rows = read_tsv(path)
    for row in rows:
        if row["seed_id"] == "SEED-DEPTH-09":
            row["result"] = "CORRECT_SKIP"
            row["severity_correct"] = "na"
            row["evidence_excerpt"] = "Incorrectly skipped non-negative-control seed."
            break
    write_tsv(path, fields, rows)


def mutate_negative_control_missed(suite: Path) -> None:
    path = suite / "run-results.tsv"
    fields, rows = read_tsv(path)
    for row in rows:
        if row["seed_id"] == "SEED-DEPTH-41":
            row["result"] = "MISSED"
            row["severity_correct"] = "na"
            row["evidence_excerpt"] = ""
            break
    write_tsv(path, fields, rows)


def mutate_pilot_depth(suite: Path) -> None:
    seed_path = suite / "seed-catalog.tsv"
    fields, rows = read_tsv(seed_path)
    for row in rows:
        if row["control_type"] != "negative_control" and row["difficulty"] == "Hard":
            row["difficulty"] = "Medium"
            row["domain_complexity"] = "production"
            row["complexity_category"] = "na"
    write_tsv(seed_path, fields, rows)

    matrix_path = suite / "coverage-matrix.tsv"
    fields, rows = read_tsv(matrix_path)
    for row in rows:
        seed_id = row["seed_ids"]
        if seed_id and int(seed_id.rsplit("-", 1)[1]) <= 40 and row["difficulty"] == "Hard":
            row["difficulty"] = "Medium"
    write_tsv(matrix_path, fields, rows)


def mutate_concept_concentration(suite: Path) -> None:
    path = suite / "seed-catalog.tsv"
    fields, rows = read_tsv(path)
    for row in rows:
        if row["domain_complexity"] in {"staff", "principal", "distinguished"}:
            row["engineering_concepts"] = "query-optimization"
    write_tsv(path, fields, rows)


def mutate_ledger_prose_field(suite: Path) -> None:
    replace_once(
        suite / "seed-ledger.md",
        "- production_trigger: valid production_trigger detail for SEED-DEPTH-09\n",
        "- note: this prose mentions production_trigger but is not the structured field label.\n",
    )


def mutate_ledger_empty_field(suite: Path) -> None:
    replace_once(
        suite / "seed-ledger.md",
        "- production_trigger: valid production_trigger detail for SEED-DEPTH-09\n",
        "- production_trigger:\n",
    )


def mutate_ledger_substring_heading(suite: Path) -> None:
    replace_once(suite / "seed-ledger.md", "## SEED-DEPTH-09\n", "## XSEED-DEPTH-09\n")


def mutate_ledger_table_with_code_fence(suite: Path) -> None:
    path = suite / "seed-ledger.md"
    text = path.read_text(encoding="utf-8")
    start = text.index("## SEED-DEPTH-09")
    end = text.index("## SEED-DEPTH-10")
    table_rows = "\n".join(
        f"| `{field}` | valid table detail |"
        for field in STAFF_PLUS_FIELDS
    )
    replacement = (
        "## SEED-DEPTH-09\n\n"
        "```yaml\n"
        "# not a markdown heading\n"
        "## also not a markdown heading\n"
        "```\n\n"
        "| Field | Value |\n"
        "|---|---|\n"
        f"{table_rows}\n\n"
    )
    path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def combined_output(result: subprocess.CompletedProcess[str]) -> str:
    return f"{result.stdout}\n{result.stderr}"


def expect_success(name: str, args: list[str], expected: str) -> None:
    result = run_command(args)
    output = combined_output(result)
    if result.returncode != 0 or expected not in output:
        raise RegressionFailure(
            f"{name} failed: expected success containing {expected!r}\n"
            f"returncode={result.returncode}\n{output}"
        )
    print(f"OK: {name}")


def expect_failure(name: str, args: list[str], expected: str) -> None:
    result = run_command(args)
    output = combined_output(result)
    if result.returncode == 0 or expected not in output:
        raise RegressionFailure(
            f"{name} failed: expected failure containing {expected!r}\n"
            f"returncode={result.returncode}\n{output}"
        )
    print(f"OK: {name}")


def validator_args(suite: Path) -> list[str]:
    return [
        sys.executable,
        str(VALIDATOR),
        str(suite),
        "--require-run-results",
        "--min-runs",
        "3",
    ]


def scorer_args(suite: Path) -> list[str]:
    return [sys.executable, str(SCORER), str(suite)]


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="eval-suite-regressions-") as tmp:
        tmp_path = Path(tmp)
        base = tmp_path / "valid-depth-suite"
        create_suite(base)

        expect_success("validator accepts valid stable benchmark", validator_args(base), "STATUS LABEL: stable benchmark")
        expect_success("scorer accepts valid stable benchmark", scorer_args(base), "Status Label:** `stable benchmark`")

        cases = [
            (
                "validator rejects TSV overflow",
                mutate_extra_field,
                validator_args,
                "extra field(s) beyond the header row",
            ),
            (
                "scorer rejects TSV overflow",
                mutate_extra_field,
                scorer_args,
                "extra field(s) beyond the header row",
            ),
            (
                "validator rejects missing depth columns",
                mutate_missing_depth_columns,
                validator_args,
                "missing required columns: complexity_category, domain_complexity, engineering_concepts",
            ),
            (
                "scorer rejects missing depth columns",
                mutate_missing_depth_columns,
                scorer_args,
                "missing required columns: complexity_category, domain_complexity, engineering_concepts",
            ),
            (
                "scorer rejects non-NC CORRECT_SKIP",
                mutate_non_nc_correct_skip,
                scorer_args,
                "non-negative-control seed 'SEED-DEPTH-09' cannot use result 'CORRECT_SKIP'",
            ),
            (
                "scorer rejects NC MISSED",
                mutate_negative_control_missed,
                scorer_args,
                "negative control seed 'SEED-DEPTH-41' must use CORRECT_SKIP or FALSE_POSITIVE",
            ),
            (
                "validator rejects prose-only staff+ field mention",
                mutate_ledger_prose_field,
                validator_args,
                "missing field(s): production_trigger",
            ),
            (
                "validator rejects empty staff+ field label",
                mutate_ledger_empty_field,
                validator_args,
                "missing field(s): production_trigger",
            ),
            (
                "validator rejects substring heading match",
                mutate_ledger_substring_heading,
                validator_args,
                "has no staff+ ledger entry containing seed_id 'SEED-DEPTH-09'",
            ),
        ]
        for index, (name, mutate, args_factory, expected) in enumerate(cases, start=1):
            suite = copy_suite(base, tmp_path / f"invalid-{index}")
            mutate(suite)
            expect_failure(name, args_factory(suite), expected)

        pilot = copy_suite(base, tmp_path / "pilot-depth")
        mutate_pilot_depth(pilot)
        expect_success("validator downgrades shallow valid suite to pilot", validator_args(pilot), "STATUS LABEL: pilot")
        expect_success("scorer downgrades shallow valid suite to pilot", scorer_args(pilot), "Status Label:** `pilot`")

        concentrated = copy_suite(base, tmp_path / "concept-concentration")
        mutate_concept_concentration(concentrated)
        expect_success("validator downgrades concept concentration to pilot", validator_args(concentrated), "STATUS LABEL: pilot")
        expect_success("scorer downgrades concept concentration to pilot", scorer_args(concentrated), "Status Label:** `pilot`")

        ledger_table = copy_suite(base, tmp_path / "ledger-table-code-fence")
        mutate_ledger_table_with_code_fence(ledger_table)
        expect_success("validator accepts backticked table ledger fields with fenced headings", validator_args(ledger_table), "STATUS LABEL: stable benchmark")

    print("OK: eval-suite regression suite passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RegressionFailure as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
