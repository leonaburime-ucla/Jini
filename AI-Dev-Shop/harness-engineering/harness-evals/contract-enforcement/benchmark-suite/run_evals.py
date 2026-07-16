#!/usr/bin/env python3
"""Run contract enforcement evals with structured JSON output and deterministic grading."""
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
    "SEED-CT-01": {"contract_state": "missing", "severity": "escalation", "action": "escalate_to_user"},
    "SEED-CT-02": {"contract_state": "missing", "severity": "advisory", "action": "proceed_with_warning"},
    "SEED-CT-03": {"contract_state": "active", "severity": "hard_blocker", "action": "block_handoff"},
    "SEED-CT-04": {"contract_state": "active", "severity": "advisory", "action": "grandfather"},
    "SEED-CT-05": {"contract_state": "active", "severity": "hard_blocker", "action": "block_require_fix"},
    "SEED-CT-06": {"contract_state": "active", "severity": "advisory", "action": "proceed_with_waiver"},
    "SEED-CT-07": {"contract_state": "stale", "severity": "escalation", "action": "escalate_stale"},
    "SEED-CT-08": {"contract_state": "partial", "severity": "advisory", "action": "enforce_filled_only"},
}

EVAL_NAMES: dict[int, str] = {
    1: "eval-1-greenfield-missing-computational",
    2: "eval-2-brownfield-all-missing",
    3: "eval-3-blocking-lint-fails",
    4: "eval-4-advisory-arch-untouched",
    5: "eval-5-blocking-arch-modified",
    6: "eval-6-priority-rule-conflict",
    7: "eval-7-stale-contract-escalation",
    8: "eval-8-partial-contract-brownfield",
}

VALID_CONTRACT_STATES = {"active", "partial", "missing", "stale"}
VALID_SEVERITIES = {"hard_blocker", "escalation", "advisory"}
VALID_ACTIONS = {
    "escalate_to_user", "proceed_with_warning", "block_handoff",
    "grandfather", "block_require_fix", "proceed_with_waiver",
    "escalate_stale", "enforce_filled_only",
}

ACTION_EQUIVALENTS: dict[str, set[str]] = {
    "block_handoff": {"block_handoff", "block_require_fix"},
    "block_require_fix": {"block_require_fix", "block_handoff"},
    "proceed_with_waiver": {"proceed_with_waiver", "proceed_with_warning"},
    "proceed_with_warning": {"proceed_with_warning", "proceed_with_waiver"},
    "escalate_to_user": {"escalate_to_user", "escalate_stale"},
    "escalate_stale": {"escalate_stale", "escalate_to_user"},
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
    seed_files: list[str] = []
    seed_state = eval_dir / "seed-state"
    if seed_state.exists():
        for f in sorted(seed_state.rglob("*")):
            if f.is_file() and f.name != ".gitkeep":
                rel = f.relative_to(seed_state)
                content = f.read_text(encoding="utf-8", errors="replace")
                seed_files.append(f"### {rel}\n```\n{content}\n```")

    contracts_context = (ROOT / "framework" / "contracts" / "enforcement.md").read_text(encoding="utf-8")

    return f"""You are a Coordinator/Programmer agent in the AI Dev Shop framework. Follow the contract enforcement rules exactly.

## Contract Enforcement Rules:
```
{contracts_context}
```

## Scenario:
{brief}

## Project Files:
{"".join(seed_files)}

## IMPORTANT — Response Format:
You MUST respond with ONLY a JSON object. No markdown, no explanation outside the JSON.

```json
{{
  "contract_state": "<one of: active, partial, missing, stale>",
  "severity": "<one of: hard_blocker, escalation, advisory>",
  "action": "<one of: escalate_to_user, proceed_with_warning, block_handoff, grandfather, block_require_fix, proceed_with_waiver, escalate_stale, enforce_filled_only>",
  "reasoning": "<1-2 sentences explaining why, citing the enforcement rule>"
}}
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
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"({type(e).__name__})", end=" ", file=sys.stderr)
    return None


def extract_json(raw: str) -> Optional[dict[str, str]]:
    """Extract JSON from response, handling markdown code blocks."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        start = next((i for i, l in enumerate(lines) if l.strip().startswith("{")), 0)
        end = next((i for i in range(len(lines) - 1, -1, -1) if "}" in lines[i]), len(lines) - 1)
        text = "\n".join(lines[start:end + 1])
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start == -1 or brace_end == -1:
        return None
    try:
        return json.loads(text[brace_start:brace_end + 1])
    except json.JSONDecodeError:
        return None


def grade_structured(seed_id: str, parsed: dict[str, str]) -> EvalResult:
    """Grade based on field matching with equivalence classes for actions."""
    expected = EXPECTED[seed_id]
    eval_num = int(seed_id.split("-")[-1])

    actual_state = parsed.get("contract_state", "").lower()
    actual_severity = parsed.get("severity", "").lower()
    actual_action = parsed.get("action", "").lower()

    state_match = actual_state == expected["contract_state"]
    # partial is acceptable when active is expected (contract has gaps but exists)
    if not state_match and expected["contract_state"] == "active" and actual_state == "partial":
        state_match = True

    severity_match = actual_severity == expected["severity"]
    acceptable_actions = ACTION_EQUIVALENTS.get(expected["action"], {expected["action"]})
    action_match = actual_action in acceptable_actions

    passed = state_match and severity_match and action_match

    return EvalResult(
        seed_id=seed_id,
        eval_name=EVAL_NAMES.get(eval_num, f"eval-{eval_num}"),
        passed=passed,
        grading_method="structured",
        expected=expected,
        actual={
            "contract_state": parsed.get("contract_state", "MISSING"),
            "severity": parsed.get("severity", "MISSING"),
            "action": parsed.get("action", "MISSING"),
        },
        reasoning=parsed.get("reasoning", ""),
    )


def grade_fallback(seed_id: str, raw: str) -> EvalResult:
    """Fallback keyword grading when JSON parsing fails."""
    expected = EXPECTED[seed_id]
    eval_num = int(seed_id.split("-")[-1])
    lower = raw.lower()

    state_match = expected["contract_state"] in lower
    severity_match = expected["severity"].replace("_", " ") in lower or expected["severity"] in lower
    action_keywords = {
        "escalate_to_user": ["escalat", "ask user"],
        "proceed_with_warning": ["advisory", "proceed", "warning"],
        "block_handoff": ["block", "cannot hand"],
        "grandfather": ["grandfather", "untouched", "out of scope"],
        "block_require_fix": ["block", "forbidden", "violation"],
        "proceed_with_waiver": ["waiver", "proceed", "fix"],
        "escalate_stale": ["stale", "escalat", "outdated"],
        "enforce_filled_only": ["gap", "partial", "only enforce"],
    }
    action_match = any(kw in lower for kw in action_keywords.get(expected["action"], []))

    passed = state_match and severity_match and action_match

    return EvalResult(
        seed_id=seed_id,
        eval_name=EVAL_NAMES.get(eval_num, f"eval-{eval_num}"),
        passed=passed,
        grading_method="fallback_keyword",
        expected=expected,
        actual={"raw_excerpt": raw[:150]},
        reasoning="JSON parse failed — used keyword fallback",
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
        seed_id = f"SEED-CT-{eval_num.zfill(2)}"

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
                expected=EXPECTED[seed_id], actual={}, reasoning="No response from peer CLI",
            ))
            continue

        parsed = extract_json(response)
        if parsed is not None:
            result = grade_structured(seed_id, parsed)
        else:
            result = grade_fallback(seed_id, response)

        status = "PASS" if result.passed else "FAIL"
        method_tag = f" [{result.grading_method}]" if result.grading_method == "fallback_keyword" else ""
        if result.passed:
            print(f"{status}{method_tag}")
        else:
            mismatches = []
            for k in ("contract_state", "severity", "action"):
                exp = result.expected.get(k, "?")
                act = result.actual.get(k, "?")
                if exp != act:
                    mismatches.append(f"{k}: expected={exp} got={act}")
            print(f"{status}{method_tag} — {'; '.join(mismatches) if mismatches else 'see TSV'}")
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

    print(f"Contract Enforcement Eval Suite — models: {', '.join(models)} (timeout: {args.timeout}s)")
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

    # Summary
    print("Summary:")
    print(f"{'Model':<10} {'Passed':<8} {'Failed':<8} {'Total':<8} {'Structured':<12} {'Fallback':<10}")
    print("-" * 56)
    any_fail = False
    for model, results in all_results.items():
        passed = sum(1 for r in results if r.passed)
        failed = len(results) - passed
        structured = sum(1 for r in results if r.grading_method == "structured")
        fallback = sum(1 for r in results if r.grading_method == "fallback_keyword")
        print(f"{model:<10} {passed:<8} {failed:<8} {len(results):<8} {structured:<12} {fallback:<10}")
        if failed > 0:
            any_fail = True

    return 1 if any_fail else 0


if __name__ == "__main__":
    sys.exit(main())
