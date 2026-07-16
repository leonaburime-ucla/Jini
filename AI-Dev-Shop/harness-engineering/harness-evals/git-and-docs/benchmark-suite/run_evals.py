#!/usr/bin/env python3
"""Run git-strategy and code-documentation evals with structured JSON grading."""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SUITE_DIR = Path(__file__).resolve().parent
ROOT = SUITE_DIR.parents[3]

CLI_DISPATCH: dict[str, list[str]] = {
    "gemini": ["gemini", "-p"],
    "codex": ["codex", "exec", "-s", "read-only"],
    "claude": ["claude", "-p", "--output-format", "text"],
}

EXPECTED: dict[str, dict[str, str]] = {
    "SEED-GD-01": {"action": "create_branch", "branch_name": "feature/305-payment-webhooks", "records_in_pipeline_state": "yes"},
    "SEED-GD-02": {"includes_spec_hash": "yes", "includes_adr": "yes", "includes_test_cert": "yes", "auto_merges": "no"},
    "SEED-GD-03": {"documents_interface": "yes", "documents_side_effects": "yes", "documents_constraints": "yes", "handoff_classification": "documented"},
    "SEED-GD-04": {"adds_docs": "no", "classification": "intentionally_undocumented", "reason": "trivial_obvious"},
    "SEED-GD-05": {"flags_missing_docs": "yes", "severity": "required", "identifies_db_write": "yes", "identifies_queue_publish": "yes"},
    "SEED-GD-06": {"flags_bloat": "yes", "severity": "recommended", "suggests_removal": "yes", "blocks_handoff": "no"},
}

EVAL_NAMES: dict[int, str] = {
    1: "eval-1-branch-at-tdd",
    2: "eval-2-pr-description",
    3: "eval-3-document-public-interface",
    4: "eval-4-no-over-document",
    5: "eval-5-flag-missing-side-effect-docs",
    6: "eval-6-comment-bloat-recommended",
}


@dataclass
class EvalResult:
    seed_id: str
    eval_name: str
    passed: bool
    grading_method: str
    expected: dict[str, str]
    actual: dict[str, str]
    reasoning: str


def build_eval_prompt(eval_dir: Path) -> str:
    brief = (eval_dir / "project-brief.md").read_text(encoding="utf-8")
    git_strategy = (ROOT / "framework" / "workflows" / "git-strategy.md").read_text(encoding="utf-8")
    doc_standards = (ROOT / "harness-engineering" / "quality" / "code-documentation-standards.md").read_text(encoding="utf-8")

    eval_num = int(eval_dir.name.split("-")[1])

    if eval_num <= 2:
        schema = """{
  "action": "<what you do: create_branch, prepare_pr_description, etc.>",
  "branch_name": "<the branch name you create, or n/a>",
  "includes_spec_hash": "<yes/no>",
  "includes_adr": "<yes/no>",
  "includes_test_cert": "<yes/no>",
  "records_in_pipeline_state": "<yes/no>",
  "auto_merges": "<yes/no>",
  "reasoning": "<1-2 sentences>"
}"""
    elif eval_num <= 4:
        schema = """{
  "documents_interface": "<yes/no>",
  "documents_side_effects": "<yes/no>",
  "documents_constraints": "<yes/no>",
  "adds_docs": "<yes/no — whether you add any documentation>",
  "classification": "<documented/intentionally_undocumented/stale_doc_updated>",
  "reason": "<why this classification>",
  "handoff_classification": "<documented/intentionally_undocumented>",
  "reasoning": "<1-2 sentences>"
}"""
    else:
        schema = """{
  "flags_missing_docs": "<yes/no>",
  "flags_bloat": "<yes/no>",
  "severity": "<required/recommended/optional>",
  "identifies_db_write": "<yes/no>",
  "identifies_queue_publish": "<yes/no>",
  "suggests_removal": "<yes/no>",
  "blocks_handoff": "<yes/no>",
  "reasoning": "<1-2 sentences>"
}"""

    return f"""You are an agent in the AI Dev Shop framework. Follow these rules exactly.

## Git Strategy:
```
{git_strategy[:2000]}
```

## Code-Documentation Standards:
```
{doc_standards[:2500]}
```

## Your Task:
{brief}

## IMPORTANT — Response Format:
You MUST respond with ONLY a JSON object. No markdown, no explanation outside the JSON.

```json
{schema}
```

Respond with ONLY the JSON object. Nothing else."""


def dispatch_eval(eval_dir: Path, model: str) -> Optional[str]:
    prompt = build_eval_prompt(eval_dir)
    cmd_prefix = CLI_DISPATCH.get(model)
    if cmd_prefix is None:
        return None
    cmd = cmd_prefix + [prompt]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120,
            input="" if model == "codex" else None,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def extract_json(raw: str) -> Optional[dict[str, str]]:
    text = raw.strip()
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start == -1 or brace_end == -1:
        return None
    try:
        return json.loads(text[brace_start:brace_end + 1])
    except json.JSONDecodeError:
        return None


def grade_structured(seed_id: str, parsed: dict[str, str]) -> EvalResult:
    expected = EXPECTED[seed_id]
    eval_num = int(seed_id.split("-")[-1])

    all_match = True
    for key, exp_val in expected.items():
        actual_val = str(parsed.get(key, "")).lower().strip()
        exp_lower = exp_val.lower().strip()
        if actual_val != exp_lower:
            # Allow partial matches for branch name
            if key == "branch_name" and exp_lower in actual_val:
                continue
            # Reason field: check if key concepts are present, not exact match
            if key == "reason":
                concepts = exp_lower.replace("_", " ").split()
                if any(c in actual_val for c in concepts):
                    continue
            all_match = False

    return EvalResult(
        seed_id=seed_id,
        eval_name=EVAL_NAMES.get(eval_num, f"eval-{eval_num}"),
        passed=all_match,
        grading_method="structured",
        expected=expected,
        actual={k: str(parsed.get(k, "MISSING")).lower() for k in expected},
        reasoning=parsed.get("reasoning", ""),
    )


def run_suite(model: str, deadline: float) -> list[EvalResult]:
    results: list[EvalResult] = []
    eval_dirs = sorted(SUITE_DIR.glob("eval-*/"))

    print(f"  [{model}] Running {len(eval_dirs)} evals...")

    for eval_dir in eval_dirs:
        if time.time() > deadline:
            print(f"    TIMEOUT — run budget exceeded, skipping remaining evals")
            break

        eval_num = eval_dir.name.split("-")[1]
        seed_id = f"SEED-GD-{eval_num.zfill(2)}"

        if seed_id not in EXPECTED:
            continue
        if not (eval_dir / "project-brief.md").exists():
            continue

        print(f"    {seed_id}...", end=" ", flush=True)
        response = dispatch_eval(eval_dir, model=model)

        if response is None:
            print("FAIL (no response)")
            results.append(EvalResult(
                seed_id=seed_id, eval_name=EVAL_NAMES.get(int(seed_id.split("-")[-1]), ""),
                passed=False, grading_method="no_response",
                expected=EXPECTED[seed_id], actual={}, reasoning="No response",
            ))
            continue

        parsed = extract_json(response)
        if parsed is not None:
            result = grade_structured(seed_id, parsed)
        else:
            result = EvalResult(
                seed_id=seed_id, eval_name=EVAL_NAMES.get(int(seed_id.split("-")[-1]), ""),
                passed=False, grading_method="fallback_json_parse_failed",
                expected=EXPECTED[seed_id], actual={"raw": response[:150]}, reasoning="JSON parse failed",
            )

        if result.passed:
            print("PASS")
        else:
            mismatches = []
            for k in result.expected:
                exp = result.expected.get(k, "?")
                act = result.actual.get(k, "?")
                if exp.lower() != act.lower():
                    mismatches.append(f"{k}: expected={exp} got={act}")
            print(f"FAIL — {'; '.join(mismatches[:3]) if mismatches else 'see TSV'}")
        results.append(result)
        time.sleep(1)

    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", default="gemini,codex")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    models = [m.strip() for m in args.models.split(",")]
    all_results: dict[str, list[EvalResult]] = {}
    deadline = time.time() + args.timeout

    print(f"Git & Docs Eval Suite — models: {', '.join(models)} (timeout: {args.timeout}s)")
    print()

    for model in models:
        if time.time() > deadline:
            print(f"  [{model}] SKIPPED — total run budget exceeded")
            continue
        all_results[model] = run_suite(model, deadline)
        passed = sum(1 for r in all_results[model] if r.passed)
        total = len(all_results[model])
        print(f"  [{model}] Results: {passed}/{total} passed")
        print()

    output_path = SUITE_DIR / "run-results.tsv"
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["model", "seed_id", "eval_name", "result", "grading_method", "expected", "actual", "reasoning"])
        for model, results in all_results.items():
            for r in results:
                writer.writerow([
                    model, r.seed_id, r.eval_name,
                    "PASS" if r.passed else "FAIL",
                    r.grading_method,
                    json.dumps(r.expected),
                    json.dumps(r.actual),
                    r.reasoning[:200],
                ])

    print(f"Results written to: {output_path}")
    print()
    print("Summary:")
    print(f"{'Model':<10} {'Passed':<8} {'Failed':<8} {'Total':<8} {'Structured':<12} {'Fallback':<10}")
    print("-" * 56)
    any_fail = False
    for model, results in all_results.items():
        passed = sum(1 for r in results if r.passed)
        failed = len(results) - passed
        structured = sum(1 for r in results if r.grading_method == "structured")
        fallback = sum(1 for r in results if "fallback" in r.grading_method)
        print(f"{model:<10} {passed:<8} {failed:<8} {len(results):<8} {structured:<12} {fallback:<10}")
        if failed > 0:
            any_fail = True

    return 1 if any_fail else 0


if __name__ == "__main__":
    sys.exit(main())
