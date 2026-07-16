#!/usr/bin/env python3
"""Run drift sensor evals with structured JSON output and deterministic grading."""
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
    "SEED-DS-01": {"severity": "blocker", "action": "escalate_immediately", "routing": "security_agent"},
    "SEED-DS-02": {"severity": "advisory", "action": "batch_maintenance", "routing": "maintenance_report"},
    "SEED-DS-03": {"severity": "escalation", "action": "route_to_agent", "routing": "refactor_agent"},
    "SEED-DS-04": {"severity": "advisory", "action": "note_in_handoff", "routing": "handoff_summary"},
    "SEED-DS-05": {"severity": "escalation", "action": "flag_critical_path", "routing": "code_review_programmer"},
    "SEED-DS-06": {"severity": "advisory", "action": "warn_programmer", "routing": "programmer_handoff"},
}

EVAL_NAMES: dict[int, str] = {
    1: "eval-1-critical-vuln-escalation",
    2: "eval-2-routine-outdated-advisory",
    3: "eval-3-dead-code-threshold-breach",
    4: "eval-4-small-coverage-drop-advisory",
    5: "eval-5-large-coverage-drop-escalation",
    6: "eval-6-new-dead-code-pr-advisory",
}

SEVERITY_EQUIVALENTS: dict[str, set[str]] = {
    "blocker": {"blocker", "hard_blocker", "critical"},
    "escalation": {"escalation", "escalate", "warning"},
    "advisory": {"advisory", "informational", "low"},
}

ACTION_EQUIVALENTS: dict[str, set[str]] = {
    "escalate_immediately": {"escalate_immediately", "escalate", "escalate_to_user", "immediate_escalation"},
    "batch_maintenance": {"batch_maintenance", "batch", "log_maintenance", "maintenance_report", "proceed_with_warning"},
    "route_to_agent": {"route_to_agent", "route_refactor", "dispatch_refactor", "escalate_to_refactor"},
    "note_in_handoff": {"note_in_handoff", "advisory_note", "warn_programmer", "note_handoff", "proceed_with_warning"},
    "flag_critical_path": {"flag_critical_path", "escalate", "escalate_coverage", "route_to_agent", "flag_and_escalate", "escalate_immediately"},
    "warn_programmer": {"warn_programmer", "advisory_note", "note_in_handoff", "advisory_warn"},
}

ROUTING_EQUIVALENTS: dict[str, set[str]] = {
    "security_agent": {"security_agent", "security", "devops"},
    "maintenance_report": {"maintenance_report", "maintenance", "tech_debt_tracker", "batch", "none"},
    "refactor_agent": {"refactor_agent", "refactor", "maintenance"},
    "handoff_summary": {"handoff_summary", "handoff", "programmer", "code_review", "none"},
    "code_review_programmer": {"code_review_programmer", "code_review", "programmer", "tdd", "tdd_agent"},
    "programmer_handoff": {"programmer_handoff", "programmer", "handoff", "handoff_summary"},
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
    sensors_readme = (ROOT / "harness-engineering" / "sensors" / "README.md").read_text(encoding="utf-8")

    return f"""You are the Observer agent in the AI Dev Shop framework. You read drift sensor artifacts and classify/route findings.

## Sensor Catalog:
```
{sensors_readme}
```

## Sensor Artifact to Process:
{brief}

## IMPORTANT — Response Format:
You MUST respond with ONLY a JSON object. No markdown, no explanation outside the JSON.

```json
{{
  "severity": "<one of: blocker, escalation, advisory>",
  "action": "<one of: escalate_immediately, batch_maintenance, route_to_agent, note_in_handoff, flag_critical_path, warn_programmer>",
  "routing": "<one of: security_agent, maintenance_report, refactor_agent, handoff_summary, code_review_programmer, programmer_handoff, none>",
  "reasoning": "<1-2 sentences explaining why>"
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

    actual_severity = parsed.get("severity", "").lower().replace(" ", "_")
    actual_action = parsed.get("action", "").lower().replace(" ", "_")
    actual_routing = parsed.get("routing", "").lower().replace(" ", "_")

    sev_ok = actual_severity in SEVERITY_EQUIVALENTS.get(expected["severity"], {expected["severity"]})
    act_ok = actual_action in ACTION_EQUIVALENTS.get(expected["action"], {expected["action"]})
    route_ok = actual_routing in ROUTING_EQUIVALENTS.get(expected["routing"], {expected["routing"]})

    passed = sev_ok and act_ok and route_ok

    return EvalResult(
        seed_id=seed_id,
        eval_name=EVAL_NAMES.get(eval_num, f"eval-{eval_num}"),
        passed=passed,
        grading_method="structured",
        expected=expected,
        actual={"severity": actual_severity, "action": actual_action, "routing": actual_routing},
        reasoning=parsed.get("reasoning", ""),
    )


def grade_fallback(seed_id: str, raw: str) -> EvalResult:
    expected = EXPECTED[seed_id]
    eval_num = int(seed_id.split("-")[-1])
    return EvalResult(
        seed_id=seed_id,
        eval_name=EVAL_NAMES.get(eval_num, f"eval-{eval_num}"),
        passed=False,
        grading_method="fallback_json_parse_failed",
        expected=expected,
        actual={"raw_excerpt": raw[:150]},
        reasoning="JSON parse failed",
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
        seed_id = f"SEED-DS-{eval_num.zfill(2)}"

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

        if result.passed:
            print("PASS")
        else:
            mismatches = []
            for k in ("severity", "action", "routing"):
                exp = result.expected.get(k, "?")
                act = result.actual.get(k, "?")
                if act not in (SEVERITY_EQUIVALENTS if k == "severity" else ACTION_EQUIVALENTS if k == "action" else ROUTING_EQUIVALENTS).get(exp, {exp}):
                    mismatches.append(f"{k}: expected={exp} got={act}")
            print(f"FAIL — {'; '.join(mismatches) if mismatches else 'see TSV'}")
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

    print(f"Drift Sensor Eval Suite — models: {', '.join(models)} (timeout: {args.timeout}s)")
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
