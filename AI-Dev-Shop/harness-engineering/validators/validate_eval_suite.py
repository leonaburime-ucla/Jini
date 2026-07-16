#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

BUG_NATURES = {
    "contradiction",
    "omission",
    "boundary_error",
    "semantic_mismatch",
    "severity_misclassification",
    "cosmetic_fix",
    "type_contract_error",
    "missing_test",
    "anti_pattern",
    "hidden_dependency",
    "dead_code",
    "state_leak",
    "invariant_violation",
}

SEED_STRUCTURES = {
    "single",
    "combined",
    "layered",
    "distributed",
    "camouflaged",
    "interference",
}

DIFFICULTIES = {"Easy", "Medium", "Hard"}
DOMAIN_COMPLEXITIES = {"textbook", "production", "staff", "principal", "distinguished"}
STAFF_PLUS_COMPLEXITIES = {"staff", "principal", "distinguished"}
LOW_COMPLEXITIES = {"textbook", "production"}
COMPLEXITY_CATEGORIES = {
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
}
ENGINEERING_CONCEPTS = {
    "distributed-consensus",
    "distributed-state",
    "networking",
    "load-balancing",
    "service-mesh",
    "message-queues",
    "stream-processing",
    "container-orchestration",
    "database-internals",
    "query-optimization",
    "schema-evolution",
    "replication",
    "caching-systems",
    "data-modeling",
    "file-systems",
    "serialization",
    "concurrency-primitives",
    "async-execution",
    "memory-management",
    "cpu-architecture",
    "io-patterns",
    "gc-behavior",
    "thread-safety",
    "backpressure",
    "authn-protocols",
    "authz-models",
    "cryptography",
    "supply-chain",
    "injection-classes",
    "trust-boundaries",
    "secrets-management",
    "numerical-computing",
    "state-machines",
    "invariant-preservation",
    "time-handling",
    "encoding-boundaries",
    "error-propagation",
    "ordering-guarantees",
    "api-evolution",
    "dependency-management",
    "modularity",
    "migration-strategy",
    "multi-tenancy",
    "event-sourcing",
    "observability-design",
    "capacity-planning",
    "test-isolation",
    "property-testing",
    "chaos-engineering",
    "contract-testing",
    "load-testing",
}
REQUIREMENTS = {"required", "optional", "pruned"}
CONTROL_TYPES = {"standard", "positive_control", "negative_control", "regression"}
SEVERITIES = {"Critical", "Required", "Recommended"}
FALSE_POSITIVE_RISKS = {"None", "Low", "Medium", "High"}
RESULTS = {"CAUGHT", "PARTIAL", "MISSED", "FALSE_POSITIVE", "CORRECT_SKIP"}
SEVERITY_CORRECT = {"yes", "no", "na"}
RUN_SCOPES = {"benchmark_full", "targeted_regression"}
SUITE_KINDS = {"benchmark", "targeted_regression"}
EXECUTION_MODES = {"repo_persona_subagent", "repo_persona_host", "external_peer_cli"}
EXECUTION_STATUS = {"completed", "simulated", "aborted", "failed"}
SCOPE_CONFIRMATIONS = {"confirmed", "not_required"}
CONDITIONAL_SKILL_SLUGS = {
    "hexagonal-architecture",
    "observability-implementation",
    "performance-engineering",
    "change-management",
    "api-design",
    "rag-ai-integration",
    "llm-operations",
    "data-engineering",
}

# Negative-control calibration: benchmark suites need NCs >= 15% of standard seeds.
NEGATIVE_CONTROL_RATIO = 0.15

# Per-dimension seed density floors.
PILOT_DIMENSION_FLOOR = 5
BENCHMARK_DIMENSION_FLOOR = 8
SHALLOW_HARD_RATIO = 0.20
CONCEPT_CONCENTRATION_RATIO = 0.50

GENERAL_DEPTH_FLOORS = {
    "textbook_max": 0.10,
    "production_max": 0.10,
    "staff_min": 0.35,
    "principal_min": 0.25,
    "distinguished_min": 0.20,
    "staff_plus_min": 0.80,
}
ARCHITECT_CR_DEPTH_FLOORS = {
    "textbook_max": 0.05,
    "production_max": 0.10,
    "staff_min": 0.30,
    "principal_min": 0.30,
    "distinguished_min": 0.25,
    "staff_plus_min": 0.85,
}
STAFF_PLUS_LEDGER_FIELDS = (
    "production_trigger",
    "deceptive_cues",
    "required_concepts",
    "causal_chain",
    "why_local_review_passes",
    "acceptable_root_cause",
    "unacceptable_shallow_answers",
    "minimum_evidence_chain",
    "domain_expert_note",
)

MATRIX_COLUMNS = {
    "cell_id",
    "agent",
    "agent_dimension",
    "bug_nature",
    "seed_structure",
    "difficulty",
    "requirement",
    "rationale",
    "seed_ids",
}

SEED_COLUMNS = {
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
}

RUN_COLUMNS = {
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
}
MANIFEST_COLUMNS = {
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
}


def parse_csv_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def is_architect_or_code_review(agent: str) -> bool:
    normalized = agent.strip().lower().replace("_", "-").replace(" ", "-")
    return normalized in {"architect", "software-architect", "code-review"}


def depth_floors_for_agents(rows: list[dict[str, str]]) -> dict[str, float]:
    agents = {row.get("agent", "") for row in rows}
    if any(is_architect_or_code_review(agent) for agent in agents):
        return ARCHITECT_CR_DEPTH_FLOORS
    return GENERAL_DEPTH_FLOORS


def ratio(count: int, total: int) -> float:
    return count / total if total else 0.0


def field_variants(field: str) -> tuple[str, str]:
    return field, field.replace("_", " ")


def ledger_field_present(entry: str, field: str) -> bool:
    for raw_line in entry.splitlines():
        line = raw_line.strip().lower()
        for variant in field_variants(field):
            label = rf"`?{re.escape(variant)}`?"
            if re.match(rf"^(?:[-*+]\s+|\d+\.\s+)?{label}\s*:\s*\S", line):
                return True
            if re.match(rf"^#+\s+{label}(?:\s|$)", line):
                return True
            if re.match(rf"^\|\s*{label}\s*\|\s*\S", line):
                return True
    return False


def load_tsv(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        if reader.fieldnames is None:
            raise ValueError(f"{path} has no header row")
        rows = []
        for raw in reader:
            if None in raw:
                extra_count = len(raw[None] or [])
                raise ValueError(
                    f"{path}:{reader.line_num} has {extra_count} extra field(s) beyond the header row"
                )
            row = {key: (value or "").strip() for key, value in raw.items()}
            if not any(row.values()):
                continue
            rows.append(row)
        return rows, list(reader.fieldnames)


def violation(message: str, fix: str) -> str:
    return f"VIOLATION: {message}\nFIX: {fix}"


def resolve_suite_path(suite_dir: Path, raw_path: str) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate
    return suite_dir / candidate


def resolve_reference_path(suite_dir: Path, raw_ref: str) -> Path:
    raw_path = raw_ref
    if ":" in raw_ref:
        maybe_path, maybe_line = raw_ref.rsplit(":", 1)
        if maybe_line.isdigit():
            raw_path = maybe_path
    return resolve_suite_path(suite_dir, raw_path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_columns(found: list[str], expected: set[str], path: Path) -> list[str]:
    missing = sorted(expected.difference(found))
    if not missing:
        return []
    return [
        violation(
            f"{path} is missing required columns: {', '.join(missing)}",
            f"Add the missing TSV columns to {path}.",
        )
    ]


def validate_matrix(rows: list[dict[str, str]], path: Path) -> tuple[dict[str, dict[str, str]], list[str]]:
    errors: list[str] = []
    cells: dict[str, dict[str, str]] = {}

    for index, row in enumerate(rows, start=2):
        cell_id = row["cell_id"]
        if not cell_id:
            errors.append(
                violation(
                    f"{path}:{index} has an empty cell_id",
                    "Give every coverage row a stable cell_id.",
                )
            )
            continue
        if cell_id in cells:
            errors.append(
                violation(
                    f"{path}:{index} duplicates cell_id '{cell_id}'",
                    "Use unique cell_id values in coverage-matrix.tsv.",
                )
            )
            continue
        if row["bug_nature"] not in BUG_NATURES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown bug_nature '{row['bug_nature']}'",
                    "Use a bug_nature from eval-coverage-model.md.",
                )
            )
        if row["seed_structure"] not in SEED_STRUCTURES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown seed_structure '{row['seed_structure']}'",
                    "Use a seed_structure from eval-coverage-model.md.",
                )
            )
        if row["difficulty"] not in DIFFICULTIES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown difficulty '{row['difficulty']}'",
                    "Use Easy, Medium, or Hard.",
                )
            )
        if row["requirement"] not in REQUIREMENTS:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown requirement '{row['requirement']}'",
                    "Use required, optional, or pruned.",
                )
            )
        if row["requirement"] in {"required", "pruned"} and not row["rationale"]:
            errors.append(
                violation(
                    f"{path}:{index} leaves rationale empty for '{row['requirement']}' cell '{cell_id}'",
                    "Document why the cell is required or why it was pruned.",
                )
            )
        if "architecture_family" in row and not row["architecture_family"]:
            errors.append(
                violation(
                    f"{path}:{index} leaves architecture_family empty for cell '{cell_id}'",
                    "Populate architecture_family for every row once the suite adopts that extension column.",
                )
            )
        cells[cell_id] = row

    return cells, errors


def validate_seed_catalog(
    rows: list[dict[str, str]],
    path: Path,
    cells: dict[str, dict[str, str]],
    suite_kind: str,
) -> tuple[set[str], list[str]]:
    errors: list[str] = []
    seed_ids: set[str] = set()
    by_cell: defaultdict[str, list[str]] = defaultdict(list)
    control_counts: Counter[str] = Counter()
    difficulties: set[str] = set()
    structures: set[str] = set()
    domain_counts: Counter[str] = Counter()
    hard_count = 0
    shallow_hard_count = 0
    staff_plus_count = 0
    staff_plus_concepts: Counter[str] = Counter()

    for index, row in enumerate(rows, start=2):
        seed_id = row["seed_id"]
        if not seed_id:
            errors.append(
                violation(
                    f"{path}:{index} has an empty seed_id",
                    "Give every seed a stable seed_id.",
                )
            )
            continue
        if seed_id in seed_ids:
            errors.append(
                violation(
                    f"{path}:{index} duplicates seed_id '{seed_id}'",
                    "Use unique seed_id values in seed-catalog.tsv.",
                )
            )
            continue
        seed_ids.add(seed_id)

        if row["bug_nature"] not in BUG_NATURES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown bug_nature '{row['bug_nature']}'",
                    "Use a bug_nature from eval-coverage-model.md.",
                )
            )
        if row["seed_structure"] not in SEED_STRUCTURES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown seed_structure '{row['seed_structure']}'",
                    "Use a seed_structure from eval-coverage-model.md.",
                )
            )
        if row["difficulty"] not in DIFFICULTIES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown difficulty '{row['difficulty']}'",
                    "Use Easy, Medium, or Hard.",
                )
            )
        domain_complexity = row.get("domain_complexity", "")
        complexity_category = row.get("complexity_category", "")
        concepts = parse_csv_list(row.get("engineering_concepts", ""))

        if domain_complexity not in DOMAIN_COMPLEXITIES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown domain_complexity '{domain_complexity}'",
                    "Use textbook, production, staff, principal, or distinguished.",
                )
            )
        if not concepts:
            errors.append(
                violation(
                    f"{path}:{index} leaves engineering_concepts empty for '{seed_id}'",
                    "Declare at least one engineering concept required to catch the seed.",
                )
            )
        else:
            bad_concepts = sorted(concept for concept in concepts if concept not in ENGINEERING_CONCEPTS)
            if bad_concepts:
                errors.append(
                    violation(
                        f"{path}:{index} uses unknown engineering_concepts value(s): {', '.join(bad_concepts)}",
                        "Use concept codes from eval-coverage-model.md, or add the new concept to the shared taxonomy and validator.",
                    )
                )

        if domain_complexity in STAFF_PLUS_COMPLEXITIES:
            if not complexity_category or complexity_category == "na":
                errors.append(
                    violation(
                        f"{path}:{index} leaves complexity_category unset for staff+ seed '{seed_id}'",
                        "Staff, principal, and distinguished seeds must cite an emergent complexity category.",
                    )
                )
            elif complexity_category not in COMPLEXITY_CATEGORIES:
                errors.append(
                    violation(
                        f"{path}:{index} uses unknown complexity_category '{complexity_category}'",
                        "Use an emergent complexity category from eval-coverage-model.md.",
                    )
                )
        elif domain_complexity in LOW_COMPLEXITIES and complexity_category != "na":
            errors.append(
                violation(
                    f"{path}:{index} uses complexity_category '{complexity_category}' for low-complexity seed '{seed_id}'",
                    "Use complexity_category = na for textbook and production seeds.",
                )
            )

        if row["control_type"] not in CONTROL_TYPES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown control_type '{row['control_type']}'",
                    "Use standard, positive_control, negative_control, or regression.",
                )
            )
        if row["expected_severity"] not in SEVERITIES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown expected_severity '{row['expected_severity']}'",
                    "Use Critical, Required, or Recommended.",
                )
            )
        if row["false_positive_risk"] not in FALSE_POSITIVE_RISKS:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown false_positive_risk '{row['false_positive_risk']}'",
                    "Use None, Low, Medium, or High.",
                )
            )
        matrix_cell_id = row["matrix_cell_id"]
        if matrix_cell_id not in cells:
            errors.append(
                violation(
                    f"{path}:{index} references unknown matrix_cell_id '{matrix_cell_id}'",
                    "Point every seed to a real coverage-matrix.tsv cell.",
                )
            )
        else:
            cell = cells[matrix_cell_id]
            requirement = cell["requirement"]
            if requirement == "pruned":
                errors.append(
                    violation(
                        f"{path}:{index} assigns seed '{seed_id}' to pruned cell '{matrix_cell_id}'",
                        "Move the seed to a required or optional cell, or un-prune the target cell with rationale.",
                    )
                )
            for column in ("agent", "agent_dimension", "bug_nature", "seed_structure", "difficulty"):
                if row[column] != cell[column]:
                    errors.append(
                        violation(
                            f"{path}:{index} does not match coverage cell '{matrix_cell_id}' for column '{column}'",
                            f"Make seed '{seed_id}' agree with the matrix cell or move it to the correct coverage row.",
                        )
                    )
            by_cell[matrix_cell_id].append(seed_id)

        if not row["detail_ref"]:
            errors.append(
                violation(
                    f"{path}:{index} leaves detail_ref empty for '{seed_id}'",
                    "Point each seed at a detailed entry in seed-ledger.md.",
                )
            )
        if not row["evidence_path"]:
            errors.append(
                violation(
                    f"{path}:{index} leaves evidence_path empty for '{seed_id}'",
                    "Record the primary artifact or file:line for each seed.",
                )
            )

        if "architecture_family" in row and not row["architecture_family"]:
            errors.append(
                violation(
                    f"{path}:{index} leaves architecture_family empty for '{seed_id}'",
                    "Populate architecture_family for every seed once the suite adopts that extension column.",
                )
            )
        if "architecture_family" in row and "architecture_family" in cells.get(matrix_cell_id, {}):
            cell_family = cells[matrix_cell_id].get("architecture_family", "")
            seed_family = row.get("architecture_family", "")
            if cell_family and seed_family and cell_family != seed_family:
                errors.append(
                    violation(
                        f"{path}:{index} does not match coverage cell '{matrix_cell_id}' for column 'architecture_family'",
                        f"Make seed '{seed_id}' agree with the matrix cell or move it to the correct coverage row.",
                    )
                )

        for extension_column in ("expected_conditional_skills", "expected_non_activations"):
            if extension_column not in row:
                continue
            bad = sorted(
                skill for skill in parse_csv_list(row.get(extension_column, ""))
                if skill not in CONDITIONAL_SKILL_SLUGS
            )
            if bad:
                errors.append(
                    violation(
                        f"{path}:{index} uses unknown conditional skill slug(s) in '{extension_column}': {', '.join(bad)}",
                        "Use normalized conditional skill slugs from the Architect eval schema extension.",
                    )
                )
        if (
            "expected_conditional_skills" in row
            and "expected_non_activations" in row
        ):
            expected = set(parse_csv_list(row.get("expected_conditional_skills", "")))
            blocked = set(parse_csv_list(row.get("expected_non_activations", "")))
            overlap = sorted(expected & blocked)
            if overlap:
                errors.append(
                    violation(
                        f"{path}:{index} lists the same skill in expected_conditional_skills and expected_non_activations: {', '.join(overlap)}",
                        "A skill cannot be both required and forbidden for the same seed.",
                    )
                )

        control_counts[row["control_type"]] += 1
        if row["control_type"] != "negative_control":
            difficulties.add(row["difficulty"])
            structures.add(row["seed_structure"])
        if domain_complexity in DOMAIN_COMPLEXITIES:
            if domain_complexity == "textbook" and row["control_type"] != "positive_control":
                errors.append(
                    violation(
                        f"{path}:{index} classifies non-positive-control seed '{seed_id}' as textbook",
                        "Textbook seeds are reserved for positive controls and baseline calibration.",
                    )
                )
        if (
            domain_complexity in DOMAIN_COMPLEXITIES
            and row["control_type"] != "negative_control"
        ):
            domain_counts[domain_complexity] += 1
            if row["difficulty"] == "Hard":
                hard_count += 1
                if domain_complexity in LOW_COMPLEXITIES:
                    shallow_hard_count += 1
            if domain_complexity in STAFF_PLUS_COMPLEXITIES:
                staff_plus_count += 1
                for concept in concepts:
                    staff_plus_concepts[concept] += 1

    for cell_id, cell in cells.items():
        if cell["requirement"] == "required" and not by_cell.get(cell_id):
            errors.append(
                violation(
                    f"Required coverage cell '{cell_id}' has no seeds assigned in {path}",
                    "Add at least one seed to every required coverage cell.",
                )
            )

    if suite_kind == "benchmark":
        for required_control in ("positive_control", "negative_control", "regression"):
            if control_counts[required_control] == 0:
                errors.append(
                    violation(
                        f"{path} does not contain any '{required_control}' seeds",
                        "Add the missing control type to the suite.",
                    )
                )
    else:
        if control_counts["regression"] == 0:
            errors.append(
                violation(
                    f"{path} does not contain any 'regression' seeds",
                    "Targeted regression packs must contain at least one regression seed.",
                )
            )

    if suite_kind == "benchmark":
        # Negative-control calibration: NCs >= 15% of standard seeds.
        standard_count = control_counts["standard"]
        nc_count = control_counts["negative_control"]
        required_nc = math.ceil(standard_count * NEGATIVE_CONTROL_RATIO) if standard_count > 0 else 1
        if nc_count < required_nc:
            errors.append(
                violation(
                    f"{path} has {nc_count} negative control(s) but needs at least {required_nc} "
                    f"(15% of {standard_count} standard seeds)",
                    "Add more negative controls to meaningfully measure false-positive tendency.",
                )
            )

        # Per-dimension seed density.
        dim_counts: Counter[str] = Counter()
        for row2 in rows:
            if row2.get("control_type", "standard") != "negative_control":
                dim_counts[row2.get("agent_dimension", "unknown")] += 1
        thin_dims = [d for d, c in dim_counts.items() if c < BENCHMARK_DIMENSION_FLOOR]
        if thin_dims:
            errors.append(
                violation(
                    f"{path} has dimensions below the benchmark density floor "
                    f"({BENCHMARK_DIMENSION_FLOOR} seeds): {', '.join(sorted(thin_dims))}",
                    "Add seeds to thin dimensions or document in coverage-matrix.tsv rationale why fewer suffice.",
                )
            )

    return seed_ids, errors


def compute_depth_readiness(rows: list[dict[str, str]]) -> tuple[bool, list[str]]:
    domain_counts: Counter[str] = Counter()
    hard_count = 0
    shallow_hard_count = 0
    staff_plus_count = 0
    staff_plus_concepts: Counter[str] = Counter()

    for row in rows:
        domain_complexity = row.get("domain_complexity", "")
        if (
            domain_complexity not in DOMAIN_COMPLEXITIES
            or row.get("control_type") == "negative_control"
        ):
            continue
        domain_counts[domain_complexity] += 1
        if row.get("difficulty") == "Hard":
            hard_count += 1
            if domain_complexity in LOW_COMPLEXITIES:
                shallow_hard_count += 1
        if domain_complexity in STAFF_PLUS_COMPLEXITIES:
            staff_plus_count += 1
            for concept in parse_csv_list(row.get("engineering_concepts", "")):
                if concept in ENGINEERING_CONCEPTS:
                    staff_plus_concepts[concept] += 1

    floors = depth_floors_for_agents(rows)
    total_depth_seeds = sum(domain_counts.values())
    staff_plus_total = sum(domain_counts[tier] for tier in STAFF_PLUS_COMPLEXITIES)
    notes: list[str] = []

    depth_checks = (
        ("textbook", floors["textbook_max"], "at most"),
        ("production", floors["production_max"], "at most"),
        ("staff", floors["staff_min"], "at least"),
        ("principal", floors["principal_min"], "at least"),
        ("distinguished", floors["distinguished_min"], "at least"),
    )
    for tier, threshold, comparator in depth_checks:
        tier_ratio = ratio(domain_counts[tier], total_depth_seeds)
        if comparator == "at most" and tier_ratio > threshold:
            notes.append(
                f"{domain_counts[tier]} depth-eligible {tier} seed(s) "
                f"({tier_ratio:.1%}) exceeds the {threshold:.0%} maximum"
            )
        if comparator == "at least" and tier_ratio < threshold:
            notes.append(
                f"{domain_counts[tier]} depth-eligible {tier} seed(s) "
                f"({tier_ratio:.1%}) is below the {threshold:.0%} minimum"
            )

    staff_plus_ratio = ratio(staff_plus_total, total_depth_seeds)
    if staff_plus_ratio < floors["staff_plus_min"]:
        notes.append(
            f"{staff_plus_total} depth-eligible staff+/principal/distinguished seed(s) "
            f"({staff_plus_ratio:.1%}) is below the {floors['staff_plus_min']:.0%} minimum"
        )

    shallow_hard_ratio = ratio(shallow_hard_count, hard_count)
    if hard_count and shallow_hard_ratio > SHALLOW_HARD_RATIO:
        notes.append(
            f"{shallow_hard_count}/{hard_count} depth-eligible Hard seeds "
            f"({shallow_hard_ratio:.1%}) are textbook or production"
        )

    if staff_plus_count and staff_plus_concepts:
        concept, count = staff_plus_concepts.most_common(1)[0]
        concentration = ratio(count, staff_plus_count)
        if concentration > CONCEPT_CONCENTRATION_RATIO:
            notes.append(
                f"{count}/{staff_plus_count} staff+ seed(s) ({concentration:.1%}) "
                f"share engineering concept '{concept}'"
            )
    elif staff_plus_count:
        notes.append("staff+ seeds have no valid engineering_concepts values")

    return not notes, notes


def validate_run_manifest(
    rows: list[dict[str, str]],
    path: Path,
    suite_dir: Path,
    require_runs: bool,
) -> tuple[dict[tuple[str, str], dict[str, str]], list[str]]:
    errors: list[str] = []
    manifests: dict[tuple[str, str], dict[str, str]] = {}

    if not rows:
        if require_runs:
            errors.append(
                violation(
                    f"{path} is missing or empty but run results are required",
                    "Persist run-manifest.tsv with one row per eval run before scoring seeds.",
                )
            )
        return manifests, errors

    for index, row in enumerate(rows, start=2):
        run_id = row["run_id"]
        eval_name = row["eval_name"]
        key = (run_id, eval_name)
        if not run_id or not eval_name:
            errors.append(
                violation(
                    f"{path}:{index} must populate both run_id and eval_name",
                    "Give every manifest row a stable run_id and eval_name.",
                )
            )
            continue
        if key in manifests:
            errors.append(
                violation(
                    f"{path}:{index} duplicates manifest row for run '{run_id}' / eval '{eval_name}'",
                    "Keep exactly one manifest row per run_id + eval_name pair.",
                )
            )
            continue

        if row["run_scope"] and row["run_scope"] not in RUN_SCOPES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown run_scope '{row['run_scope']}'",
                    "Use benchmark_full or targeted_regression.",
                )
            )
        if row["execution_mode"] and row["execution_mode"] not in EXECUTION_MODES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown execution_mode '{row['execution_mode']}'",
                    "Use repo_persona_subagent, repo_persona_host, or external_peer_cli.",
                )
            )
        if row["execution_status"] not in EXECUTION_STATUS:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown execution_status '{row['execution_status']}'",
                    "Use completed, simulated, aborted, or failed.",
                )
            )
        if row["scope_confirmation"] not in SCOPE_CONFIRMATIONS:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown scope_confirmation '{row['scope_confirmation']}'",
                    "Use confirmed or not_required.",
                )
            )

        for column in ("run_scope", "execution_mode", "agent", "model_id", "model_label", "started_at"):
            if not row.get(column):
                errors.append(
                    violation(
                        f"{path}:{index} leaves '{column}' empty for run '{run_id}' / eval '{eval_name}'",
                        "Populate manifest metadata for every run.",
                    )
                )

        if row["scope_confirmation"] == "confirmed" and not row["scope_confirmation_notes"]:
            errors.append(
                violation(
                    f"{path}:{index} marks scope_confirmation as confirmed but leaves notes empty",
                    "Record the user-approved scope summary in scope_confirmation_notes.",
                )
            )

        if row["execution_status"] == "completed":
            for column in (
                "completed_at",
                "artifact_path",
                "artifact_sha256",
                "transcript_path",
                "transcript_sha256",
            ):
                if not row.get(column):
                    errors.append(
                        violation(
                            f"{path}:{index} leaves '{column}' empty for completed run '{run_id}' / eval '{eval_name}'",
                            "Completed runs must record artifact + transcript paths and SHA-256 hashes.",
                        )
                    )
            for path_field, hash_field in (
                ("artifact_path", "artifact_sha256"),
                ("transcript_path", "transcript_sha256"),
            ):
                rel_path = row.get(path_field, "")
                expected_hash = row.get(hash_field, "")
                if not rel_path or not expected_hash:
                    continue
                artifact_path = resolve_suite_path(suite_dir, rel_path)
                if not artifact_path.exists():
                    errors.append(
                        violation(
                            f"{path}:{index} references missing file '{artifact_path}' in '{path_field}'",
                            "Point manifest artifact fields at real retained files.",
                        )
                    )
                    continue
                actual_hash = sha256_file(artifact_path)
                if actual_hash != expected_hash:
                    errors.append(
                        violation(
                            f"{path}:{index} hash mismatch for '{path_field}'",
                            "Refresh the stored SHA-256 after the artifact is finalized.",
                        )
                    )

        manifests[key] = row

    return manifests, errors


def extract_seed_ledger_entry(ledger_text: str, seed_id: str) -> str | None:
    heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$")
    seed_pattern = re.compile(
        rf"(?<![A-Za-z0-9_-]){re.escape(seed_id)}(?![A-Za-z0-9_-])"
    )
    fence_pattern = re.compile(r"^\s*(```|~~~)")
    lines = ledger_text.splitlines()

    start_index = None
    heading_level = 0
    in_fence = False
    for index, line in enumerate(lines):
        if fence_pattern.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        heading = heading_pattern.match(line)
        if heading and seed_pattern.search(heading.group(2)):
            start_index = index
            heading_level = len(heading.group(1))
            break

    if start_index is None:
        return None

    end_index = len(lines)
    in_fence = False
    for index in range(start_index + 1, len(lines)):
        line = lines[index]
        if fence_pattern.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        heading = heading_pattern.match(line)
        if heading and len(heading.group(1)) <= heading_level:
            end_index = index
            break

    return "\n".join(lines[start_index:end_index])


def validate_staff_plus_ledger_fields(
    rows: list[dict[str, str]],
    ledger_path: Path,
    suite_kind: str,
) -> list[str]:
    errors: list[str] = []
    if suite_kind != "benchmark":
        return errors
    ledger_text = ledger_path.read_text(encoding="utf-8")

    for row in rows:
        if row.get("domain_complexity") not in STAFF_PLUS_COMPLEXITIES:
            continue
        seed_id = row.get("seed_id", "")
        entry = extract_seed_ledger_entry(ledger_text, seed_id)
        if entry is None:
            errors.append(
                violation(
                    f"{ledger_path} has no staff+ ledger entry containing seed_id '{seed_id}'",
                    "Every staff/principal/distinguished seed must have a structured seed-ledger.md entry.",
                )
            )
            continue
        lowered_entry = entry.lower()
        missing_fields = []
        for field in STAFF_PLUS_LEDGER_FIELDS:
            if not ledger_field_present(lowered_entry, field):
                missing_fields.append(field)
        if missing_fields:
            errors.append(
                violation(
                    f"{ledger_path} entry for staff+ seed '{seed_id}' is missing field(s): {', '.join(missing_fields)}",
                    "Add the required staff+ ledger fields so high-tier complexity is auditable.",
                )
            )
    return errors


def validate_run_results(
    rows: list[dict[str, str]],
    path: Path,
    suite_dir: Path,
    seed_ids: set[str],
    seed_index: dict[str, dict[str, str]],
    manifests: dict[tuple[str, str], dict[str, str]],
    min_runs: int,
    require_runs: bool,
    suite_kind: str,
) -> list[str]:
    errors: list[str] = []

    if not rows:
        if require_runs:
            errors.append(
                violation(
                    f"{path} is missing or empty but run results are required",
                    "Persist run-results.tsv with one row per seed per run.",
                )
            )
        return errors

    runs_by_seed: defaultdict[str, set[str]] = defaultdict(set)
    benchmark_runs_by_seed: defaultdict[str, set[str]] = defaultdict(set)
    targeted_runs_by_seed: defaultdict[str, set[str]] = defaultdict(set)
    seeds_by_benchmark_run: defaultdict[str, set[str]] = defaultdict(set)
    run_scopes_seen: set[str] = set()
    scope_seed_counts: Counter[str] = Counter()
    scope_evals: defaultdict[str, set[str]] = defaultdict(set)
    seen_scores: set[tuple[str, str]] = set()

    for index, row in enumerate(rows, start=2):
        run_id = row["run_id"]
        eval_name = row["eval_name"]
        seed_id = row["seed_id"]
        result = row["result"]
        severity_correct = row["severity_correct"]
        manifest_key = (run_id, eval_name)
        seed_meta = seed_index.get(seed_id, {})
        is_negative_control = seed_meta.get("control_type") == "negative_control"

        if not run_id:
            errors.append(
                violation(
                    f"{path}:{index} has an empty run_id",
                    "Give every scored row a run_id.",
                )
            )
            continue
        if seed_id not in seed_ids:
            errors.append(
                violation(
                    f"{path}:{index} references unknown seed_id '{seed_id}'",
                    "Score only seeds declared in seed-catalog.tsv.",
                )
            )
            continue
        score_key = (run_id, seed_id)
        if score_key in seen_scores:
            errors.append(
                violation(
                    f"{path}:{index} duplicates score for run '{run_id}' seed '{seed_id}'",
                    "Keep exactly one scored row per seed per run.",
                )
            )
            continue
        seen_scores.add(score_key)
        if result not in RESULTS:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown result '{result}'",
                    "Use CAUGHT, PARTIAL, MISSED, FALSE_POSITIVE, or CORRECT_SKIP.",
                )
            )
        if severity_correct not in SEVERITY_CORRECT:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown severity_correct value '{severity_correct}'",
                    "Use yes, no, or na.",
                )
            )

        for column in ("agent", "model_id", "run_scope", "execution_mode"):
            if not row.get(column):
                errors.append(
                    violation(
                        f"{path}:{index} leaves '{column}' empty for run '{run_id}'",
                        f"Populate '{column}' in run-results.tsv.",
                    )
                )

        if not row.get("reviewer_notes"):
            errors.append(
                violation(
                    f"{path}:{index} leaves reviewer_notes empty for run '{run_id}' seed '{seed_id}'",
                    "Record the grading rationale for every scored seed.",
                )
            )
        if not row.get("evidence_path"):
            errors.append(
                violation(
                    f"{path}:{index} leaves evidence_path empty for run '{run_id}' seed '{seed_id}'",
                    "Point each scored seed at the output artifact section or file:line used for grading.",
                )
            )
        else:
            evidence_path = resolve_reference_path(suite_dir, row["evidence_path"])
            if not evidence_path.exists():
                errors.append(
                    violation(
                        f"{path}:{index} references missing evidence file '{evidence_path}'",
                        "Point evidence_path at a real retained artifact or file:line reference.",
                    )
                )
        if result in {"CAUGHT", "PARTIAL", "FALSE_POSITIVE"} and not row.get("evidence_excerpt"):
            errors.append(
                violation(
                    f"{path}:{index} leaves evidence_excerpt empty for '{result}' row on seed '{seed_id}'",
                    "Quote or summarize the exact output fragment that justifies the grade.",
                )
            )

        run_scope = row.get("run_scope", "")
        if run_scope and run_scope not in RUN_SCOPES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown run_scope '{run_scope}'",
                    "Use benchmark_full or targeted_regression.",
                )
            )

        execution_mode = row.get("execution_mode", "")
        if execution_mode and execution_mode not in EXECUTION_MODES:
            errors.append(
                violation(
                    f"{path}:{index} uses unknown execution_mode '{execution_mode}'",
                    "Use repo_persona_subagent, repo_persona_host, or external_peer_cli.",
                )
            )
        if "observed_conditional_skills" in row:
            bad = sorted(
                skill for skill in parse_csv_list(row.get("observed_conditional_skills", ""))
                if skill not in CONDITIONAL_SKILL_SLUGS
            )
            if bad:
                errors.append(
                    violation(
                        f"{path}:{index} uses unknown conditional skill slug(s) in observed_conditional_skills: {', '.join(bad)}",
                        "Use normalized conditional skill slugs from the Architect eval schema extension.",
                    )
                )

        manifest = manifests.get(manifest_key)
        if manifest is None:
            errors.append(
                violation(
                    f"{path}:{index} has no matching run-manifest.tsv row for run '{run_id}' / eval '{eval_name}'",
                    "Create a completed manifest row before scoring seed results.",
                )
            )
        else:
            if manifest.get("execution_status") != "completed":
                errors.append(
                    violation(
                        f"{path}:{index} scores run '{run_id}' / eval '{eval_name}' even though manifest status is '{manifest.get('execution_status', '')}'",
                        "Only completed runs may appear in run-results.tsv.",
                    )
                )
            for column in ("run_scope", "execution_mode", "agent", "model_id", "model_label"):
                if row.get(column, "") != manifest.get(column, ""):
                    errors.append(
                        violation(
                            f"{path}:{index} disagrees with run-manifest.tsv for '{column}' on run '{run_id}' / eval '{eval_name}'",
                            "Copy run metadata from the manifest so provenance stays auditable.",
                        )
                    )

        if is_negative_control:
            if result not in {"CORRECT_SKIP", "FALSE_POSITIVE"}:
                errors.append(
                    violation(
                        f"{path}:{index} uses '{result}' for negative control seed '{seed_id}'",
                        "Negative controls must be scored as CORRECT_SKIP or FALSE_POSITIVE.",
                    )
                )
            if severity_correct != "na":
                errors.append(
                    violation(
                        f"{path}:{index} uses severity_correct '{severity_correct}' for negative control seed '{seed_id}'",
                        "Negative controls must use severity_correct = na.",
                    )
                )
        else:
            if result in {"FALSE_POSITIVE", "CORRECT_SKIP"}:
                errors.append(
                    violation(
                        f"{path}:{index} uses '{result}' for non-negative-control seed '{seed_id}'",
                        "Standard, positive-control, and regression seeds must use CAUGHT, PARTIAL, or MISSED.",
                    )
                )
            if result in {"CAUGHT", "PARTIAL"} and severity_correct not in {"yes", "no"}:
                errors.append(
                    violation(
                        f"{path}:{index} must use severity_correct yes/no when the seed was flagged",
                        "Set severity_correct to yes or no for CAUGHT/PARTIAL rows.",
                    )
                )
            if result == "MISSED" and severity_correct != "na":
                errors.append(
                    violation(
                        f"{path}:{index} must use severity_correct = na for MISSED row on seed '{seed_id}'",
                        "Severity accuracy is only applicable when the agent flagged the seeded issue.",
                    )
                )

        run_scopes_seen.add(run_scope)
        runs_by_seed[seed_id].add(run_id)
        scope_seed_counts[run_id] += 1
        scope_evals[run_id].add(eval_name)
        if run_scope == "benchmark_full":
            benchmark_runs_by_seed[seed_id].add(run_id)
            seeds_by_benchmark_run[run_id].add(seed_id)
        elif run_scope == "targeted_regression":
            targeted_runs_by_seed[seed_id].add(run_id)

    if suite_kind == "benchmark":
        if require_runs and "benchmark_full" not in run_scopes_seen:
            errors.append(
                violation(
                    f"{path} does not contain any benchmark_full runs",
                    "Benchmark suite validation requires at least one benchmark_full run.",
                )
            )
        counted_runs = benchmark_runs_by_seed
        target_seeds = seed_ids
        run_count_fix = f"Persist at least {min_runs} benchmark_full runs per seed before treating the suite as benchmark-grade."
    else:
        if require_runs and "targeted_regression" not in run_scopes_seen:
            errors.append(
                violation(
                    f"{path} does not contain any targeted_regression runs",
                    "Targeted regression suite validation requires at least one targeted_regression run.",
                )
            )
        counted_runs = targeted_runs_by_seed
        target_seeds = {sid for sid, rids in targeted_runs_by_seed.items()}
        run_count_fix = f"Persist at least {min_runs} targeted_regression runs per targeted seed."

    for seed_id in sorted(target_seeds):
        run_count = len(counted_runs.get(seed_id, set()))
        if run_count < min_runs:
            errors.append(
                violation(
                    f"Seed '{seed_id}' only appears in {run_count} qualifying run(s) in {path}",
                    run_count_fix,
                )
            )

    for run_id, run_seeds in sorted(seeds_by_benchmark_run.items()):
        missing = seed_ids - run_seeds
        if missing:
            errors.append(
                violation(
                    f"benchmark_full run '{run_id}' is missing {len(missing)} seed(s): {', '.join(sorted(missing))}",
                    "A benchmark_full run must score every seed in the suite. Complete the run or change run_scope.",
                )
            )

    for run_id, scored_seed_count in sorted(scope_seed_counts.items()):
        eval_count = len(scope_evals[run_id])
        if scored_seed_count <= 10 and eval_count <= 1:
            continue
        scope_manifest_rows = [
            row for (manifest_run_id, _), row in manifests.items()
            if manifest_run_id == run_id
        ]
        for manifest in scope_manifest_rows:
            if manifest.get("scope_confirmation") != "confirmed":
                errors.append(
                    violation(
                        f"run '{run_id}' exceeds the workload-confirmation threshold "
                        f"({scored_seed_count} seeds across {eval_count} evals) but scope_confirmation is "
                        f"'{manifest.get('scope_confirmation', '')}'",
                        "Large runs must pause for user confirmation and record scope_confirmation = confirmed in run-manifest.tsv.",
                    )
                )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a seeded eval suite.")
    parser.add_argument("suite_dir", help="Path to the eval suite root")
    parser.add_argument("--min-runs", type=int, default=0, help="Minimum distinct runs required per seed")
    parser.add_argument(
        "--suite-kind",
        choices=sorted(SUITE_KINDS),
        default="benchmark",
        help="Validation mode: full benchmark suite or targeted regression pack",
    )
    parser.add_argument(
        "--require-run-results",
        action="store_true",
        help="Fail when run-results.tsv is missing or empty",
    )
    args = parser.parse_args()

    suite_dir = Path(args.suite_dir).resolve()
    coverage_path = suite_dir / "coverage-matrix.tsv"
    seed_path = suite_dir / "seed-catalog.tsv"
    ledger_path = suite_dir / "seed-ledger.md"
    controls_path = suite_dir / "controls.md"
    runs_path = suite_dir / "run-results.tsv"
    manifest_path = suite_dir / "run-manifest.tsv"

    errors: list[str] = []

    for required_path in (coverage_path, seed_path, ledger_path, controls_path):
        if not required_path.exists():
            errors.append(
                violation(
                    f"Required suite artifact is missing: {required_path}",
                    "Create the missing suite artifact before using this eval as benchmark infrastructure.",
                )
            )

    if errors:
        print("\n\n".join(errors))
        return 1

    try:
        matrix_rows, matrix_fields = load_tsv(coverage_path)
        seed_rows, seed_fields = load_tsv(seed_path)
        manifest_rows, manifest_fields = load_tsv(manifest_path) if manifest_path.exists() else ([], [])
        run_rows, run_fields = load_tsv(runs_path) if runs_path.exists() else ([], [])
    except ValueError as exc:
        print(
            violation(
                str(exc),
                "Fix the TSV header row and rerun the validator.",
            )
        )
        return 1

    schema_errors: list[str] = []
    schema_errors.extend(require_columns(matrix_fields, MATRIX_COLUMNS, coverage_path))
    schema_errors.extend(require_columns(seed_fields, SEED_COLUMNS, seed_path))
    if manifest_rows or run_rows or args.require_run_results:
        schema_errors.extend(require_columns(manifest_fields, MANIFEST_COLUMNS, manifest_path))
    if run_rows or args.require_run_results:
        schema_errors.extend(require_columns(run_fields, RUN_COLUMNS, runs_path))
    if schema_errors:
        print("\n\n".join(schema_errors))
        return 1

    cells, matrix_errors = validate_matrix(matrix_rows, coverage_path)
    errors.extend(matrix_errors)
    seed_ids, seed_errors = validate_seed_catalog(seed_rows, seed_path, cells, args.suite_kind)
    errors.extend(seed_errors)
    errors.extend(validate_staff_plus_ledger_fields(seed_rows, ledger_path, args.suite_kind))
    seed_index = {row["seed_id"]: row for row in seed_rows}
    manifests, manifest_errors = validate_run_manifest(
        manifest_rows,
        manifest_path,
        suite_dir,
        args.require_run_results or bool(run_rows),
    )
    errors.extend(manifest_errors)
    errors.extend(
        validate_run_results(
            run_rows,
            runs_path,
            suite_dir,
            seed_ids,
            seed_index,
            manifests,
            args.min_runs,
            args.require_run_results,
            args.suite_kind,
        )
    )

    if errors:
        print("\n\n".join(errors))
        return 1

    # Compute and emit status label.
    total_seeds = len(seed_rows)
    total_standard = sum(1 for r in seed_rows if r.get("control_type", "standard") == "standard")
    control_types_found = {r.get("control_type") for r in seed_rows}
    has_positive = "positive_control" in control_types_found
    has_negative = "negative_control" in control_types_found
    has_regression = "regression" in control_types_found
    has_all_controls = has_positive and has_negative and has_regression
    capability_seed_rows = [
        row for row in seed_rows
        if row.get("control_type", "standard") != "negative_control"
    ]
    difficulties_found = {r.get("difficulty") for r in capability_seed_rows}
    has_all_tiers = {"Easy", "Medium", "Hard"}.issubset(difficulties_found)
    structures_found = {r.get("seed_structure") for r in capability_seed_rows}
    has_advanced = bool(
        structures_found & {"combined", "layered", "distributed", "camouflaged", "interference"}
    )
    nc_count = sum(1 for r in seed_rows if r.get("control_type") == "negative_control")
    required_nc = math.ceil(total_standard * NEGATIVE_CONTROL_RATIO) if total_standard > 0 else 0
    nc_ratio_ok = nc_count >= required_nc

    dim_counts: Counter = Counter()
    for r in seed_rows:
        if r.get("control_type", "standard") != "negative_control":
            dim_counts[r.get("agent_dimension", "unknown")] += 1
    all_dims_bench = all(c >= BENCHMARK_DIMENSION_FLOOR for c in dim_counts.values()) if dim_counts else False

    distinct_runs = len(
        {r["run_id"] for r in run_rows if r.get("run_scope") == "benchmark_full"}
    ) if run_rows else 0
    depth_ok, depth_notes = compute_depth_readiness(seed_rows)

    if not coverage_path.exists() or not controls_path.exists():
        label = "exploratory"
    elif total_seeds < 30 or not has_advanced:
        label = "pilot"
    elif (
        total_seeds >= 36
        and has_all_controls
        and has_all_tiers
        and has_advanced
        and nc_ratio_ok
        and depth_ok
        and distinct_runs >= 3
    ):
        if total_seeds >= 54 and nc_ratio_ok and all_dims_bench:
            label = "stable benchmark"
        else:
            label = "benchmark"
    else:
        label = "pilot"

    print(f"OK: eval suite metadata is valid for {suite_dir}")
    print(f"STATUS LABEL: {label}")

    notes = []
    if label == "benchmark":
        thin = [d for d, c in dim_counts.items() if c < BENCHMARK_DIMENSION_FLOOR]
        if thin:
            notes.append(f"  - thin dimensions (< {BENCHMARK_DIMENSION_FLOOR} seeds): {', '.join(sorted(thin))}")
    if label == "pilot":
        if total_seeds < 30:
            notes.append(f"  - only {total_seeds} seeds (need 30+ for pilot)")
        if not has_all_controls:
            missing_ct = []
            if not has_positive:
                missing_ct.append("positive_control")
            if not has_negative:
                missing_ct.append("negative_control")
            if not has_regression:
                missing_ct.append("regression")
            notes.append(f"  - missing control types: {', '.join(missing_ct)}")
        if not has_all_tiers:
            notes.append(f"  - missing capability difficulty tiers: {', '.join(sorted(DIFFICULTIES.difference(difficulties_found)))}")
        if not has_advanced:
            notes.append("  - no advanced capability seed structures (combined/layered/distributed/camouflaged/interference)")
        if not nc_ratio_ok:
            notes.append(f"  - negative-control ratio below 15% ({nc_count} NCs / {total_standard} standard seeds, need {required_nc})")
        if not depth_ok:
            notes.append("  - domain-complexity depth gates are not satisfied")
            for depth_note in depth_notes:
                notes.append(f"    - {depth_note}")
        if distinct_runs < 3:
            notes.append(f"  - only {distinct_runs} benchmark_full runs (need 3+ for benchmark)")
    if notes:
        print("NOTES:")
        for note in notes:
            print(note)

    return 0


if __name__ == "__main__":
    sys.exit(main())
