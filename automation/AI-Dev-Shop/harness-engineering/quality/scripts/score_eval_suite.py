#!/usr/bin/env python3
"""Score a seeded eval suite and emit aggregate metrics.

Reads seed-catalog.tsv and run-results.tsv, computes per-seed, per-dimension,
per-bug-nature, per-structure, per-difficulty, per-domain-complexity, and
per-engineering-concept breakdowns, false-positive rate, severity accuracy,
cross-dimension stability, and emits a computed status label.

Usage:
    python3 harness-engineering/quality/scripts/score_eval_suite.py <suite-dir>
    python3 harness-engineering/quality/scripts/score_eval_suite.py <suite-dir> \
        --baseline-results <previous-run-results.tsv>
    python3 harness-engineering/quality/scripts/score_eval_suite.py <suite-dir> \
        --output <report-path.md>
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

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
CATALOG_COLUMNS = {
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
SCORE_MAP = {
    "CAUGHT": 1.0,
    "PARTIAL": 0.5,
    "MISSED": 0.0,
    "FALSE_POSITIVE": 0.0,
    "CORRECT_SKIP": 1.0,
}
CONDITIONAL_SKILL_SLUGS = [
    "hexagonal-architecture",
    "observability-implementation",
    "performance-engineering",
    "change-management",
    "api-design",
    "rag-ai-integration",
    "llm-operations",
    "data-engineering",
]
DOMAIN_COMPLEXITY_ORDER = ["textbook", "production", "staff", "principal", "distinguished"]
STAFF_PLUS_COMPLEXITIES = {"staff", "principal", "distinguished"}
LOW_COMPLEXITIES = {"textbook", "production"}
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

STABILITY_THRESHOLD = 0.3  # drop > this flags a stability regression

# Minimum negative-control ratio for benchmark suites.
NEGATIVE_CONTROL_RATIO = 0.15

# Per-dimension seed density floors.
PILOT_DIMENSION_FLOOR = 5
BENCHMARK_DIMENSION_FLOOR = 8


# ---------------------------------------------------------------------------
# TSV loading (shared with validate_eval_suite.py)
# ---------------------------------------------------------------------------

def load_tsv(path: Path) -> list[dict[str, str]]:
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
            row = {k: (v or "").strip() for k, v in raw.items()}
            if any(row.values()):
                rows.append(row)
        return rows


def parse_csv_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def is_architect_or_code_review(agent: str) -> bool:
    normalized = agent.strip().lower().replace("_", "-").replace(" ", "-")
    return normalized in {"architect", "software-architect", "code-review"}


def depth_floors_for_catalog(catalog: list[dict[str, str]]) -> dict[str, float]:
    agents = {row.get("agent", "") for row in catalog}
    if any(is_architect_or_code_review(agent) for agent in agents):
        return ARCHITECT_CR_DEPTH_FLOORS
    return GENERAL_DEPTH_FLOORS


def ratio(count: int, total: int) -> float:
    return count / total if total else 0.0


def require_columns(found: list[str], expected: set[str], label: str) -> list[str]:
    missing = sorted(expected.difference(found))
    if not missing:
        return []
    return [f"{label} is missing required columns: {', '.join(missing)}"]


def resolve_suite_path(suite_dir: Path, raw_path: str) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate
    return suite_dir / candidate


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_tsv_with_fields(path: Path) -> tuple[list[dict[str, str]], list[str]]:
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
            row = {k: (v or "").strip() for k, v in raw.items()}
            if any(row.values()):
                rows.append(row)
        return rows, list(reader.fieldnames)


def validate_scoring_inputs(
    suite_dir: Path,
    catalog_fields: list[str],
    run_fields: list[str],
    manifest_fields: list[str],
    results: list[dict[str, str]],
    manifest_rows: list[dict[str, str]],
    seed_index: dict[str, dict[str, str]],
) -> list[str]:
    errors: list[str] = []
    errors.extend(require_columns(catalog_fields, CATALOG_COLUMNS, "seed-catalog.tsv"))
    errors.extend(require_columns(run_fields, RUN_COLUMNS, "run-results.tsv"))
    errors.extend(require_columns(manifest_fields, MANIFEST_COLUMNS, "run-manifest.tsv"))
    if errors:
        return errors

    manifests = {
        (row["run_id"], row["eval_name"]): row
        for row in manifest_rows
    }
    scored_seed_counts: Counter[str] = Counter()
    scored_evals: defaultdict[str, set[str]] = defaultdict(set)
    for row in results:
        key = (row.get("run_id", ""), row.get("eval_name", ""))
        manifest = manifests.get(key)
        seed_id = row.get("seed_id", "")
        seed_meta = seed_index.get(seed_id, {})
        result = row.get("result", "")
        severity_correct = row.get("severity_correct", "")
        scored_seed_counts[row.get("run_id", "")] += 1
        scored_evals[row.get("run_id", "")].add(row.get("eval_name", ""))
        if not seed_meta:
            errors.append(f"run-results.tsv references unknown seed_id '{seed_id}'")
        elif seed_meta.get("control_type") == "negative_control":
            if result not in {"CORRECT_SKIP", "FALSE_POSITIVE"}:
                errors.append(
                    f"negative control seed '{seed_id}' must use CORRECT_SKIP or FALSE_POSITIVE, not '{result}'"
                )
            if severity_correct != "na":
                errors.append(
                    f"negative control seed '{seed_id}' must use severity_correct=na"
                )
        else:
            if result in {"CORRECT_SKIP", "FALSE_POSITIVE"}:
                errors.append(
                    f"non-negative-control seed '{seed_id}' cannot use result '{result}'"
                )
            if result in {"CAUGHT", "PARTIAL"} and severity_correct not in {"yes", "no"}:
                errors.append(
                    f"flagged seed '{seed_id}' must use severity_correct yes/no"
                )
            if result == "MISSED" and severity_correct != "na":
                errors.append(
                    f"missed seed '{seed_id}' must use severity_correct=na"
                )
        if manifest is None:
            errors.append(
                f"run-results.tsv row for run '{key[0]}' / eval '{key[1]}' "
                "has no matching run-manifest.tsv row"
            )
            continue
        if manifest.get("execution_status") != "completed":
            errors.append(
                f"run '{key[0]}' / eval '{key[1]}' is scored but manifest "
                f"status is '{manifest.get('execution_status', '')}', not completed"
            )
        for column in ("run_scope", "execution_mode", "agent", "model_id", "model_label"):
            if row.get(column, "") != manifest.get(column, ""):
                errors.append(
                    f"run '{key[0]}' / eval '{key[1]}' disagrees with manifest "
                    f"for '{column}'"
                )
        for path_field, hash_field in (
            ("artifact_path", "artifact_sha256"),
            ("transcript_path", "transcript_sha256"),
        ):
            rel_path = manifest.get(path_field, "")
            expected_hash = manifest.get(hash_field, "")
            if not rel_path or not expected_hash:
                errors.append(
                    f"run-manifest.tsv row for run '{key[0]}' / eval '{key[1]}' "
                    f"must populate '{path_field}' and '{hash_field}'"
                )
                continue
            artifact_path = resolve_suite_path(suite_dir, rel_path)
            if not artifact_path.exists():
                errors.append(
                    f"Manifest artifact does not exist for run '{key[0]}' / eval "
                    f"'{key[1]}': {artifact_path}"
                )
                continue
            actual_hash = sha256_file(artifact_path)
            if actual_hash != expected_hash:
                errors.append(
                    f"Manifest hash mismatch for run '{key[0]}' / eval '{key[1]}' "
                    f"field '{path_field}'"
                )
    for run_id, seed_count in scored_seed_counts.items():
        eval_count = len(scored_evals[run_id])
        if seed_count <= 10 and eval_count <= 1:
            continue
        for (manifest_run_id, _), manifest in manifests.items():
            if manifest_run_id != run_id:
                continue
            if manifest.get("scope_confirmation") != "confirmed":
                errors.append(
                    f"run '{run_id}' exceeds the workload-confirmation threshold "
                    f"({seed_count} seeds across {eval_count} evals) but the manifest "
                    f"records scope_confirmation='{manifest.get('scope_confirmation', '')}'"
                )
    return errors


# ---------------------------------------------------------------------------
# Core scoring
# ---------------------------------------------------------------------------

def score_row(row: dict[str, str], meta: dict[str, str]) -> float:
    result = row.get("result", "")
    if meta.get("control_type") == "negative_control":
        if result in {"CORRECT_SKIP", "MISSED"}:
            return 1.0
        if result in {"FALSE_POSITIVE", "CAUGHT", "PARTIAL"}:
            return 0.0
    return SCORE_MAP.get(result, 0.0)


def collect_run_ids_by_scope(
    results: list[dict[str, str]],
    run_scope: str,
) -> set[str]:
    """Return unique run IDs for one execution scope."""
    return {row["run_id"] for row in results if row.get("run_scope") == run_scope}


def compute_per_seed_catch_rate(
    results: list[dict[str, str]],
    seed_index: dict[str, dict[str, str]],
) -> dict[str, dict[str, object]]:
    """Return {seed_id: {runs, caught, partial, missed, fp, catch_rate, scores}}."""
    by_seed: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
    for row in results:
        by_seed[row["seed_id"]].append(row)

    out: dict[str, dict[str, object]] = {}
    for seed_id, rows in sorted(by_seed.items()):
        meta = seed_index.get(seed_id, {})
        scores = [score_row(r, meta) for r in rows]
        counts = Counter(r["result"] for r in rows)
        sev_correct = sum(1 for r in rows if r["severity_correct"] == "yes")
        sev_applicable = sum(1 for r in rows if r["severity_correct"] in ("yes", "no"))
        out[seed_id] = {
            "runs": len(rows),
            "caught": counts.get("CAUGHT", 0),
            "partial": counts.get("PARTIAL", 0),
            "missed": counts.get("MISSED", 0),
            "false_positive": counts.get("FALSE_POSITIVE", 0),
            "correct_skip": counts.get("CORRECT_SKIP", 0),
            "catch_rate": sum(scores) / len(scores) if scores else 0.0,
            "severity_accuracy": (sev_correct / sev_applicable) if sev_applicable else None,
            "scores": scores,
        }
    return out


def build_seed_index(catalog: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    return {row["seed_id"]: row for row in catalog}


def group_catch_rates(
    seed_rates: dict[str, dict[str, object]],
    seed_index: dict[str, dict[str, str]],
    group_key: str,
) -> dict[str, dict[str, float]]:
    """Group catch rates by a seed-catalog column (agent_dimension, bug_nature, etc.)."""
    groups: defaultdict[str, list[float]] = defaultdict(list)
    for seed_id, stats in seed_rates.items():
        meta = seed_index.get(seed_id)
        if not meta or meta.get("control_type") == "negative_control":
            continue
        groups[meta.get(group_key, "unknown")].append(stats["catch_rate"])

    out = {}
    for key, rates in sorted(groups.items()):
        out[key] = {
            "mean_catch_rate": sum(rates) / len(rates) if rates else 0.0,
            "seed_count": len(rates),
        }
    return out


def group_multi_value_catch_rates(
    seed_rates: dict[str, dict[str, object]],
    seed_index: dict[str, dict[str, str]],
    group_key: str,
) -> dict[str, dict[str, float]]:
    groups: defaultdict[str, list[float]] = defaultdict(list)
    for seed_id, stats in seed_rates.items():
        meta = seed_index.get(seed_id)
        if not meta or meta.get("control_type") == "negative_control":
            continue
        values = parse_csv_list(meta.get(group_key, ""))
        for value in values:
            groups[value].append(stats["catch_rate"])

    out = {}
    for key, rates in sorted(groups.items()):
        out[key] = {
            "mean_catch_rate": sum(rates) / len(rates) if rates else 0.0,
            "seed_count": len(rates),
        }
    return out


def compute_depth_metrics(
    catalog: list[dict[str, str]],
    seed_rates: dict[str, dict[str, object]] | None = None,
) -> dict[str, object]:
    depth_catalog = [
        row for row in catalog
        if row.get("control_type") != "negative_control"
    ]
    tier_counts: Counter[str] = Counter(row.get("domain_complexity", "unknown") for row in depth_catalog)
    total = len(depth_catalog)
    staff_plus_count = sum(tier_counts[tier] for tier in STAFF_PLUS_COMPLEXITIES)
    hard_seeds = [row for row in depth_catalog if row.get("difficulty") == "Hard"]
    shallow_hard = [
        row for row in hard_seeds
        if row.get("domain_complexity") in LOW_COMPLEXITIES
    ]

    staff_plus_concepts: Counter[str] = Counter()
    concepts_by_tier: defaultdict[str, set[str]] = defaultdict(set)
    concept_matrix: defaultdict[str, dict[str, list[float]]] = defaultdict(
        lambda: {tier: [] for tier in DOMAIN_COMPLEXITY_ORDER}
    )

    for row in depth_catalog:
        tier = row.get("domain_complexity", "unknown")
        concepts = parse_csv_list(row.get("engineering_concepts", ""))
        seed_id = row.get("seed_id", "")
        catch_rate = None
        if (
            seed_rates
            and seed_id in seed_rates
            and row.get("control_type") != "negative_control"
        ):
            catch_rate = seed_rates[seed_id]["catch_rate"]
        for concept in concepts:
            concepts_by_tier[tier].add(concept)
            if tier in DOMAIN_COMPLEXITY_ORDER and catch_rate is not None:
                concept_matrix[concept][tier].append(catch_rate)
            if tier in STAFF_PLUS_COMPLEXITIES:
                staff_plus_concepts[concept] += 1

    max_staff_plus_concept = staff_plus_concepts.most_common(1)[0] if staff_plus_concepts else ("", 0)
    floors = depth_floors_for_catalog(catalog)
    staff_plus_ratio = ratio(staff_plus_count, total)
    shallow_hard_ratio = ratio(len(shallow_hard), len(hard_seeds))
    concept_concentration = ratio(max_staff_plus_concept[1], staff_plus_count)
    depth_ok = (
        ratio(tier_counts["textbook"], total) <= floors["textbook_max"]
        and ratio(tier_counts["production"], total) <= floors["production_max"]
        and ratio(tier_counts["staff"], total) >= floors["staff_min"]
        and ratio(tier_counts["principal"], total) >= floors["principal_min"]
        and ratio(tier_counts["distinguished"], total) >= floors["distinguished_min"]
        and staff_plus_ratio >= floors["staff_plus_min"]
        and shallow_hard_ratio <= SHALLOW_HARD_RATIO
        and concept_concentration <= CONCEPT_CONCENTRATION_RATIO
    )

    return {
        "tier_counts": tier_counts,
        "total": total,
        "catalog_total": len(catalog),
        "negative_control_count": len(catalog) - total,
        "staff_plus_count": staff_plus_count,
        "staff_plus_ratio": staff_plus_ratio,
        "hard_count": len(hard_seeds),
        "shallow_hard_count": len(shallow_hard),
        "shallow_hard_ratio": shallow_hard_ratio,
        "staff_plus_concepts": staff_plus_concepts,
        "max_staff_plus_concept": max_staff_plus_concept,
        "concept_concentration": concept_concentration,
        "concepts_by_tier": concepts_by_tier,
        "concept_matrix": concept_matrix,
        "floors": floors,
        "depth_ok": depth_ok,
    }


def compute_false_positive_rate(
    seed_rates: dict[str, dict[str, object]],
    seed_index: dict[str, dict[str, str]],
) -> dict[str, object]:
    """FP rate from negative controls: how often the agent flagged a non-bug."""
    nc_seeds = [
        sid for sid, meta in seed_index.items()
        if meta.get("control_type") == "negative_control"
    ]
    if not nc_seeds:
        return {"negative_controls": 0, "fp_rate": None, "detail": "no negative controls in suite"}

    total_runs = 0
    total_fps = 0
    for sid in nc_seeds:
        stats = seed_rates.get(sid)
        if not stats:
            continue
        total_runs += stats["runs"]
        total_fps += (
            stats["caught"]
            + stats["partial"]
            + stats["false_positive"]
        )

    fp_rate = total_fps / total_runs if total_runs else 0.0
    return {
        "negative_controls": len(nc_seeds),
        "total_nc_runs": total_runs,
        "false_positives": total_fps,
        "fp_rate": fp_rate,
    }


def compute_severity_accuracy(
    seed_rates: dict[str, dict[str, object]],
    seed_index: dict[str, dict[str, str]],
) -> dict[str, object]:
    """Severity accuracy across all standard + positive/regression seeds."""
    correct = 0
    applicable = 0
    for sid, stats in seed_rates.items():
        meta = seed_index.get(sid, {})
        if meta.get("control_type") == "negative_control":
            continue
        sa = stats.get("severity_accuracy")
        if sa is not None:
            # Weight by number of applicable runs
            runs = stats["runs"]
            caught_or_partial = stats["caught"] + stats["partial"]
            if caught_or_partial > 0:
                correct += round(sa * caught_or_partial)
                applicable += caught_or_partial

    return {
        "severity_accuracy": correct / applicable if applicable else None,
        "applicable_findings": applicable,
    }


def compute_conditional_skill_catalog_coverage(
    catalog: list[dict[str, str]],
) -> dict[str, dict[str, int]]:
    coverage = {
        skill: {"expected": 0, "blocked": 0}
        for skill in CONDITIONAL_SKILL_SLUGS
    }
    for row in catalog:
        for skill in parse_csv_list(row.get("expected_conditional_skills", "")):
            if skill in coverage:
                coverage[skill]["expected"] += 1
        for skill in parse_csv_list(row.get("expected_non_activations", "")):
            if skill in coverage:
                coverage[skill]["blocked"] += 1
    return coverage


def compute_conditional_skill_observed_metrics(
    results: list[dict[str, str]],
    seed_index: dict[str, dict[str, str]],
) -> dict[str, dict[str, float | int | None]] | None:
    if not results or "observed_conditional_skills" not in results[0]:
        return None

    metrics = {
        skill: {
            "expected_runs": 0,
            "expected_hits": 0,
            "blocked_runs": 0,
            "blocked_violations": 0,
            "activation_recall": None,
            "false_positive_rate": None,
        }
        for skill in CONDITIONAL_SKILL_SLUGS
    }
    any_data = False

    for row in results:
        observed = set(parse_csv_list(row.get("observed_conditional_skills", "")))
        if observed:
            any_data = True
        meta = seed_index.get(row.get("seed_id", ""), {})
        expected = set(parse_csv_list(meta.get("expected_conditional_skills", "")))
        blocked = set(parse_csv_list(meta.get("expected_non_activations", "")))
        for skill in CONDITIONAL_SKILL_SLUGS:
            if skill in expected:
                metrics[skill]["expected_runs"] += 1
                if skill in observed:
                    metrics[skill]["expected_hits"] += 1
            if skill in blocked:
                metrics[skill]["blocked_runs"] += 1
                if skill in observed:
                    metrics[skill]["blocked_violations"] += 1

    if not any_data:
        return None

    for skill, data in metrics.items():
        if data["expected_runs"]:
            data["activation_recall"] = data["expected_hits"] / data["expected_runs"]
        if data["blocked_runs"]:
            data["false_positive_rate"] = data["blocked_violations"] / data["blocked_runs"]
    return metrics


# ---------------------------------------------------------------------------
# Cross-dimension stability (attention-budget metric)
# ---------------------------------------------------------------------------

def compute_stability_deltas(
    current_rates: dict[str, dict[str, object]],
    baseline_rates: dict[str, dict[str, object]],
    seed_index: dict[str, dict[str, str]],
    changed_dimensions: set[str] | None = None,
) -> list[dict[str, object]]:
    """Compare current vs baseline catch rates, flag regressions."""
    regressions = []
    for seed_id in sorted(set(current_rates) & set(baseline_rates)):
        baseline_cr = baseline_rates[seed_id]["catch_rate"]
        current_cr = current_rates[seed_id]["catch_rate"]
        delta = current_cr - baseline_cr

        if delta < -STABILITY_THRESHOLD:
            meta = seed_index.get(seed_id, {})
            dimension = meta.get("agent_dimension", "unknown")
            is_cross_dimension = (
                changed_dimensions is not None
                and dimension not in changed_dimensions
            )
            regressions.append({
                "seed_id": seed_id,
                "dimension": dimension,
                "baseline_catch_rate": baseline_cr,
                "current_catch_rate": current_cr,
                "delta": delta,
                "is_attention_budget_regression": is_cross_dimension,
            })
    return regressions


# ---------------------------------------------------------------------------
# Status label computation
# ---------------------------------------------------------------------------

def compute_status_label(
    catalog: list[dict[str, str]],
    seed_index: dict[str, dict[str, str]],
    results: list[dict[str, str]],
    matrix_path: Path,
    controls_path: Path,
    has_advanced_structures: bool,
    run_count: int,
) -> tuple[str, list[str]]:
    """Compute exploratory/pilot/benchmark/stable_benchmark and reasons."""
    reasons = []
    total_standard = sum(
        1 for s in catalog if s.get("control_type", "standard") == "standard"
    )
    total_seeds = len(catalog)

    has_matrix = matrix_path.exists()
    has_controls = controls_path.exists()

    control_types = {s.get("control_type") for s in catalog}
    has_positive = "positive_control" in control_types
    has_negative = "negative_control" in control_types
    has_regression = "regression" in control_types
    has_all_controls = has_positive and has_negative and has_regression

    capability_seeds = [
        s for s in catalog
        if s.get("control_type", "standard") != "negative_control"
    ]
    difficulties = {s.get("difficulty") for s in capability_seeds}
    has_all_tiers = {"Easy", "Medium", "Hard"}.issubset(difficulties)

    # Easy seeds must be ≤ 5% of total and must all be positive controls
    easy_seeds = [s for s in catalog if s.get("difficulty") == "Easy"]
    easy_ratio_ok = len(easy_seeds) <= math.ceil(total_seeds * 0.05)
    easy_all_controls = all(
        s.get("control_type") in ("positive_control", "negative_control")
        for s in easy_seeds
    )
    easy_policy_ok = easy_ratio_ok and easy_all_controls

    # Check negative control ratio
    nc_count = sum(1 for s in catalog if s.get("control_type") == "negative_control")
    nc_ratio_ok = nc_count >= math.ceil(total_standard * NEGATIVE_CONTROL_RATIO) if total_standard > 0 else False

    # Check per-dimension density
    dim_counts: Counter[str] = Counter()
    for s in catalog:
        if s.get("control_type", "standard") != "negative_control":
            dim_counts[s.get("agent_dimension", "unknown")] += 1

    all_dims_above_benchmark = all(c >= BENCHMARK_DIMENSION_FLOOR for c in dim_counts.values()) if dim_counts else False
    depth_metrics = compute_depth_metrics(catalog)
    depth_ok = bool(depth_metrics["depth_ok"])

    # Determine label
    if not has_matrix or not has_controls:
        label = "exploratory"
        if not has_matrix:
            reasons.append("no coverage-matrix.tsv")
        if not has_controls:
            reasons.append("no controls.md")
    elif total_seeds < 30 or not has_advanced_structures:
        label = "pilot"
        if total_seeds < 30:
            reasons.append(f"only {total_seeds} seeds (need 30+ for pilot minimum)")
        if not has_advanced_structures:
            reasons.append("no advanced seed structures (combined/layered/distributed/camouflaged/interference)")
    elif (
        total_seeds >= 36
        and has_all_controls
        and has_all_tiers
        and has_advanced_structures
        and nc_ratio_ok
        and depth_ok
        and easy_policy_ok
        and run_count >= 3
    ):
        if total_seeds >= 54 and nc_ratio_ok and all_dims_above_benchmark:
            label = "stable benchmark"
            reasons.append("54+ seeds, all controls, all tiers, 3+ runs, NC ratio met, dimension density met, easy ≤5%")
        else:
            label = "benchmark"
            reasons.append("36+ seeds, all controls, all tiers, 3+ runs, NC ratio met")
            if not all_dims_above_benchmark:
                thin_dims = [d for d, c in dim_counts.items() if c < BENCHMARK_DIMENSION_FLOOR]
                reasons.append(f"thin dimensions (< {BENCHMARK_DIMENSION_FLOOR} seeds): {', '.join(thin_dims)}")
    else:
        label = "pilot"
        if not depth_ok:
            reasons.append("domain-complexity depth gates are not satisfied")
        if not has_all_controls:
            missing_controls = []
            if not has_positive:
                missing_controls.append("positive_control")
            if not has_negative:
                missing_controls.append("negative_control")
            if not has_regression:
                missing_controls.append("regression")
            reasons.append(f"missing control types: {', '.join(missing_controls)}")
        if not has_all_tiers:
            reasons.append(f"missing capability difficulty tiers: {', '.join({'Easy', 'Medium', 'Hard'} - difficulties)}")
        if not nc_ratio_ok:
            reasons.append(f"negative-control ratio below 15% ({nc_count} NCs for {total_standard} standard seeds)")
        if not easy_policy_ok:
            if not easy_ratio_ok:
                reasons.append(f"Easy seeds exceed 5% cap ({len(easy_seeds)}/{total_seeds})")
            if not easy_all_controls:
                reasons.append("Easy standard seeds exist — Easy seeds must all be positive/negative controls")
        if run_count < 3:
            reasons.append(f"only {run_count} benchmark_full runs (need 3+ for benchmark)")

    return label, reasons


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def format_pct(value: float | None) -> str:
    if value is None:
        return "N/A"
    return f"{value * 100:.1f}%"


def generate_report(
    suite_dir: Path,
    catalog: list[dict[str, str]],
    results: list[dict[str, str]],
    seed_rates: dict[str, dict[str, object]],
    seed_index: dict[str, dict[str, str]],
    stability_regressions: list[dict[str, object]] | None,
    status_label: str,
    status_reasons: list[str],
) -> str:
    lines = []
    lines.append(f"# Eval Suite Score Report — {suite_dir.name}")
    lines.append("")
    lines.append(f"**Suite:** `{suite_dir}`")
    lines.append(f"**Status Label:** `{status_label}`")
    for reason in status_reasons:
        lines.append(f"  - {reason}")
    lines.append("")

    # Overall score
    standard_rates = []
    for sid, stats in seed_rates.items():
        meta = seed_index.get(sid, {})
        if meta.get("control_type") != "negative_control":
            standard_rates.append(stats["catch_rate"])

    mean_score = sum(standard_rates) / len(standard_rates) if standard_rates else 0.0
    lines.append(f"**Mean Catch Rate (non-NC seeds):** {format_pct(mean_score)}")

    # Run count
    benchmark_run_ids = collect_run_ids_by_scope(results, "benchmark_full")
    targeted_run_ids = collect_run_ids_by_scope(results, "targeted_regression")
    lines.append(f"**Benchmark Full Runs:** {len(benchmark_run_ids)}")
    if targeted_run_ids:
        lines.append(f"**Targeted Regression Runs:** {len(targeted_run_ids)}")
    lines.append(f"**Total Seeds in Catalog:** {len(catalog)}")
    lines.append("")

    # FP rate
    fp = compute_false_positive_rate(seed_rates, seed_index)
    lines.append("## False Positive Rate")
    lines.append("")
    lines.append(f"- Negative controls: {fp['negative_controls']}")
    if fp["fp_rate"] is not None:
        lines.append(f"- FP rate: {format_pct(fp['fp_rate'])} ({fp['false_positives']} FPs across {fp['total_nc_runs']} NC runs)")
    else:
        lines.append(f"- FP rate: N/A ({fp.get('detail', '')})")
    lines.append("")

    # Severity accuracy
    sev = compute_severity_accuracy(seed_rates, seed_index)
    lines.append("## Severity Accuracy")
    lines.append("")
    lines.append(f"- Accuracy: {format_pct(sev['severity_accuracy'])} ({sev['applicable_findings']} applicable findings)")
    lines.append("")

    # Per-seed detail
    lines.append("## Per-Seed Catch Rates")
    lines.append("")
    lines.append("| Seed | Dimension | Bug Nature | Structure | Difficulty | Control | Catch Rate | Runs |")
    lines.append("|------|-----------|-----------|-----------|------------|---------|------------|------|")
    for sid in sorted(seed_rates.keys()):
        stats = seed_rates[sid]
        meta = seed_index.get(sid, {})
        lines.append(
            f"| {sid} "
            f"| {meta.get('agent_dimension', '?')} "
            f"| {meta.get('bug_nature', '?')} "
            f"| {meta.get('seed_structure', '?')} "
            f"| {meta.get('difficulty', '?')} "
            f"| {meta.get('control_type', '?')} "
            f"| {format_pct(stats['catch_rate'])} "
            f"| {stats['runs']} |"
        )
    lines.append("")

    # Breakdowns
    lines.append("_Capability catch-rate breakdowns exclude negative controls; false-positive calibration is reported separately._")
    lines.append("")
    for group_key, title in [
        ("agent_dimension", "Per-Dimension Breakdown"),
        ("bug_nature", "Per-Bug-Nature Breakdown"),
        ("seed_structure", "Per-Structure Breakdown"),
        ("difficulty", "Per-Difficulty Breakdown"),
        ("domain_complexity", "Per-Domain-Complexity Breakdown"),
        ("complexity_category", "Per-Complexity-Category Breakdown"),
    ]:
        grouped = group_catch_rates(seed_rates, seed_index, group_key)
        lines.append(f"## {title}")
        lines.append("")
        lines.append(f"| {group_key} | Seeds | Mean Catch Rate |")
        lines.append("|---|---|---|")
        for key, data in grouped.items():
            lines.append(f"| {key} | {data['seed_count']} | {format_pct(data['mean_catch_rate'])} |")
        lines.append("")

    skill_source_breakdown = group_catch_rates(seed_rates, seed_index, "skill_source")
    lines.append("## Skill Source Catch Rates")
    lines.append("")
    lines.append("| skill_source | Seeds | Mean Catch Rate |")
    lines.append("|---|---:|---:|")
    for key, data in skill_source_breakdown.items():
        lines.append(f"| {key} | {data['seed_count']} | {format_pct(data['mean_catch_rate'])} |")
    lines.append("")

    skill_source_gaps = [
        (key, data)
        for key, data in skill_source_breakdown.items()
        if data["mean_catch_rate"] < 0.5
    ]
    if skill_source_gaps:
        lines.append("## Confirmed Skill Gaps")
        lines.append("")
        lines.append("| skill_source | Seeds | Mean Catch Rate |")
        lines.append("|---|---:|---:|")
        for key, data in sorted(skill_source_gaps, key=lambda item: item[1]["mean_catch_rate"]):
            lines.append(f"| {key} | {data['seed_count']} | {format_pct(data['mean_catch_rate'])} |")
        lines.append("")

    concept_breakdown = group_multi_value_catch_rates(seed_rates, seed_index, "engineering_concepts")
    if concept_breakdown:
        lines.append("## Per-Engineering-Concept Breakdown")
        lines.append("")
        lines.append("| engineering_concept | Seed Mentions | Mean Catch Rate |")
        lines.append("|---|---:|---:|")
        for key, data in concept_breakdown.items():
            lines.append(f"| {key} | {data['seed_count']} | {format_pct(data['mean_catch_rate'])} |")
        lines.append("")

        skill_gaps = [
            (key, data)
            for key, data in concept_breakdown.items()
            if data["mean_catch_rate"] < 0.5
        ]
        if skill_gaps:
            lines.append("## Skill Gap Diagnostics")
            lines.append("")
            lines.append("| Concept | Seed Mentions | Mean Catch Rate |")
            lines.append("|---|---:|---:|")
            for key, data in sorted(skill_gaps, key=lambda item: item[1]["mean_catch_rate"]):
                lines.append(f"| {key} | {data['seed_count']} | {format_pct(data['mean_catch_rate'])} |")
            lines.append("")

    depth_metrics = compute_depth_metrics(catalog, seed_rates)
    lines.append("## Domain Depth Calibration")
    lines.append("")
    lines.append(
        f"_Depth gates count {depth_metrics['total']} non-negative-control seeds; "
        f"{depth_metrics['negative_control_count']} negative controls are measured separately._"
    )
    lines.append("")
    lines.append("| Tier | Seeds | Ratio |")
    lines.append("|---|---:|---:|")
    for tier in DOMAIN_COMPLEXITY_ORDER:
        count = depth_metrics["tier_counts"][tier]
        lines.append(f"| {tier} | {count} | {format_pct(ratio(count, depth_metrics['total']))} |")
    lines.append("")
    lines.append(f"- Staff+ seeds: {depth_metrics['staff_plus_count']} / {depth_metrics['total']} ({format_pct(depth_metrics['staff_plus_ratio'])})")
    lines.append(f"- Shallow-Hard seeds: {depth_metrics['shallow_hard_count']} / {depth_metrics['hard_count']} ({format_pct(depth_metrics['shallow_hard_ratio'])})")
    max_concept, max_count = depth_metrics["max_staff_plus_concept"]
    if max_concept:
        lines.append(f"- Largest staff+ concept concentration: `{max_concept}` with {max_count} / {depth_metrics['staff_plus_count']} ({format_pct(depth_metrics['concept_concentration'])})")
    lines.append(f"- Meets depth gates: {'yes' if depth_metrics['depth_ok'] else '**NO**'}")
    lines.append("")

    if concept_breakdown:
        lines.append("## Concept × Complexity Matrix")
        lines.append("")
        lines.append("| Engineering Concept | " + " | ".join(DOMAIN_COMPLEXITY_ORDER) + " |")
        lines.append("|---" + "|---:" * len(DOMAIN_COMPLEXITY_ORDER) + "|")
        concept_matrix = depth_metrics["concept_matrix"]
        for concept in sorted(concept_matrix):
            cells = []
            for tier in DOMAIN_COMPLEXITY_ORDER:
                rates = concept_matrix[concept][tier]
                if rates:
                    cells.append(f"{len(rates)} @ {format_pct(sum(rates) / len(rates))}")
                else:
                    cells.append("0")
            lines.append(f"| {concept} | " + " | ".join(cells) + " |")
        lines.append("")

        lines.append("### Concept Matrix Flags")
        lines.append("")
        matrix_flags = []
        for concept, data in concept_breakdown.items():
            tier_presence = {
                tier for tier in DOMAIN_COMPLEXITY_ORDER
                if depth_metrics["concept_matrix"].get(concept, {}).get(tier)
            }
            if tier_presence and tier_presence.issubset(LOW_COMPLEXITIES):
                matrix_flags.append(f"`{concept}` appears only at textbook/production complexity.")
        for tier in DOMAIN_COMPLEXITY_ORDER:
            concept_count = len(depth_metrics["concepts_by_tier"].get(tier, set()))
            if concept_count and concept_count < 3:
                matrix_flags.append(f"`{tier}` tier covers only {concept_count} distinct concept(s).")
        if matrix_flags:
            for flag in matrix_flags:
                lines.append(f"- {flag}")
        else:
            lines.append("- No concept matrix flags.")
        lines.append("")

    if any(seed_index.get(sid, {}).get("architecture_family") for sid in seed_rates):
        grouped = group_catch_rates(seed_rates, seed_index, "architecture_family")
        lines.append("## Per-Architecture-Family Breakdown")
        lines.append("")
        lines.append("| architecture_family | Seeds | Mean Catch Rate |")
        lines.append("|---|---|---|")
        for key, data in grouped.items():
            lines.append(f"| {key} | {data['seed_count']} | {format_pct(data['mean_catch_rate'])} |")
        lines.append("")

    skill_catalog = compute_conditional_skill_catalog_coverage(catalog)
    if any(data["expected"] or data["blocked"] for data in skill_catalog.values()):
        lines.append("## Conditional Skill Coverage")
        lines.append("")
        lines.append("| Skill | Expected Activations | Expected Non-Activations |")
        lines.append("|---|---:|---:|")
        for skill, data in skill_catalog.items():
            if data["expected"] or data["blocked"]:
                lines.append(f"| {skill} | {data['expected']} | {data['blocked']} |")
        lines.append("")

        observed_metrics = compute_conditional_skill_observed_metrics(results, seed_index)
        lines.append("## Conditional Skill Observation Metrics")
        lines.append("")
        if observed_metrics is None:
            lines.append("*No observed_conditional_skills data recorded yet — activation accuracy is not measurable from the current run-results.tsv.*")
        else:
            lines.append("| Skill | Expected Runs | Activation Recall | Blocked Runs | False-Positive Rate |")
            lines.append("|---|---:|---:|---:|---:|")
            for skill, data in observed_metrics.items():
                if data["expected_runs"] or data["blocked_runs"]:
                    lines.append(
                        f"| {skill} | {data['expected_runs']} | {format_pct(data['activation_recall'])} | "
                        f"{data['blocked_runs']} | {format_pct(data['false_positive_rate'])} |"
                    )
        lines.append("")

    # Dimension density
    lines.append("## Dimension Density")
    lines.append("")
    dim_counts: Counter[str] = Counter()
    for s in catalog:
        if s.get("control_type", "standard") != "negative_control":
            dim_counts[s.get("agent_dimension", "unknown")] += 1
    lines.append("| Dimension | Seed Count | Meets Pilot (5) | Meets Benchmark (8) |")
    lines.append("|-----------|-----------|-----------------|-------------------|")
    for dim, count in sorted(dim_counts.items()):
        pilot_ok = "yes" if count >= PILOT_DIMENSION_FLOOR else "**NO**"
        bench_ok = "yes" if count >= BENCHMARK_DIMENSION_FLOOR else "**NO**"
        lines.append(f"| {dim} | {count} | {pilot_ok} | {bench_ok} |")
    lines.append("")

    # Negative-control calibration
    nc_count = sum(1 for s in catalog if s.get("control_type") == "negative_control")
    std_count = sum(1 for s in catalog if s.get("control_type", "standard") == "standard")
    required_nc = math.ceil(std_count * NEGATIVE_CONTROL_RATIO) if std_count > 0 else 0
    lines.append("## Negative-Control Calibration")
    lines.append("")
    lines.append(f"- Standard seeds: {std_count}")
    lines.append(f"- Negative controls: {nc_count}")
    lines.append(f"- Required (15%): {required_nc}")
    lines.append(f"- Meets ratio: {'yes' if nc_count >= required_nc else '**NO**'}")
    lines.append("")

    # Stability regressions
    lines.append("## Cross-Dimension Stability")
    lines.append("")
    if stability_regressions is None:
        lines.append("*No baseline provided — stability comparison skipped.*")
        lines.append("Pass `--baseline-results` to enable attention-budget regression detection.")
    elif not stability_regressions:
        lines.append("No stability regressions detected (all seeds within 0.3 of baseline).")
    else:
        attn_budget = [r for r in stability_regressions if r["is_attention_budget_regression"]]
        lines.append(f"**Stability regressions:** {len(stability_regressions)}")
        lines.append(f"**Attention-budget regressions:** {len(attn_budget)}")
        lines.append("")
        lines.append("| Seed | Dimension | Baseline | Current | Delta | Attention-Budget? |")
        lines.append("|------|-----------|----------|---------|-------|-------------------|")
        for reg in stability_regressions:
            lines.append(
                f"| {reg['seed_id']} "
                f"| {reg['dimension']} "
                f"| {format_pct(reg['baseline_catch_rate'])} "
                f"| {format_pct(reg['current_catch_rate'])} "
                f"| {reg['delta']:+.2f} "
                f"| {'**YES**' if reg['is_attention_budget_regression'] else 'no'} |"
            )
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Score a seeded eval suite.")
    parser.add_argument("suite_dir", help="Path to the eval suite root")
    parser.add_argument(
        "--baseline-results",
        help="Path to a previous run-results.tsv for stability comparison",
    )
    parser.add_argument(
        "--changed-dimensions",
        help="Comma-separated list of dimensions that were changed (for attention-budget flagging)",
    )
    parser.add_argument(
        "--output",
        help="Write report to this file instead of stdout",
    )
    args = parser.parse_args()

    suite_dir = Path(args.suite_dir).resolve()
    seed_path = suite_dir / "seed-catalog.tsv"
    results_path = suite_dir / "run-results.tsv"
    manifest_path = suite_dir / "run-manifest.tsv"
    matrix_path = suite_dir / "coverage-matrix.tsv"
    controls_path = suite_dir / "controls.md"

    # Load data
    if not seed_path.exists():
        print(f"ERROR: {seed_path} not found", file=sys.stderr)
        return 1
    if not results_path.exists():
        print(f"ERROR: {results_path} not found", file=sys.stderr)
        return 1
    if not manifest_path.exists():
        print(f"ERROR: {manifest_path} not found", file=sys.stderr)
        return 1

    try:
        catalog, catalog_fields = load_tsv_with_fields(seed_path)
        results, run_fields = load_tsv_with_fields(results_path)
        manifest_rows, manifest_fields = load_tsv_with_fields(manifest_path)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    seed_index = build_seed_index(catalog)
    input_errors = validate_scoring_inputs(
        suite_dir,
        catalog_fields,
        run_fields,
        manifest_fields,
        results,
        manifest_rows,
        seed_index,
    )
    if input_errors:
        for error in input_errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    # Core scoring
    seed_rates = compute_per_seed_catch_rate(results, seed_index)

    # Stability comparison
    stability_regressions = None
    if args.baseline_results:
        baseline_path = Path(args.baseline_results).resolve()
        if not baseline_path.exists():
            print(f"ERROR: baseline {baseline_path} not found", file=sys.stderr)
            return 1
        try:
            baseline_results = load_tsv(baseline_path)
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        baseline_rates = compute_per_seed_catch_rate(baseline_results, seed_index)
        changed_dims = None
        if args.changed_dimensions:
            changed_dims = {d.strip() for d in args.changed_dimensions.split(",")}
        stability_regressions = compute_stability_deltas(
            seed_rates, baseline_rates, seed_index, changed_dims,
        )

    # Status label
    capability_catalog = [
        seed for seed in catalog
        if seed.get("control_type", "standard") != "negative_control"
    ]
    structures = {s.get("seed_structure") for s in capability_catalog}
    has_advanced = bool(
        structures & {"combined", "layered", "distributed", "camouflaged", "interference"}
    )
    # Targeted regressions help diagnostics, but only full benchmark runs should
    # promote the suite's readiness label.
    benchmark_run_ids = collect_run_ids_by_scope(results, "benchmark_full")
    status_label, status_reasons = compute_status_label(
        catalog, seed_index, results, matrix_path, controls_path,
        has_advanced, len(benchmark_run_ids),
    )

    # Report
    report = generate_report(
        suite_dir, catalog, results, seed_rates, seed_index,
        stability_regressions, status_label, status_reasons,
    )

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report, encoding="utf-8")
        print(f"Report written to {out_path}")
    else:
        print(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
