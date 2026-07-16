#!/usr/bin/env python3
import argparse
import csv
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from adapters import AdapterConfig, make_adapter
from graders import grade_cell as grade_solution
from preflight import dirty_edit_gate, envelope_gate, index_sentinel_gate

SUITE_DIR = Path(__file__).resolve().parent
DEFAULT_FIXTURE = "fixtures/tier2-medium"
DEFAULT_BACKENDS = "rg-control,cm-mcp-full,oracle-context"
DEFAULT_STATES = "clean,dirty"
DEFAULT_QUERIES = "Q2,Q3,Q5,Q7,Q8,Q9,Q14"
SUPPORTED_BACKENDS = {"rg-control", "cm-mcp-full", "oracle-context", "graphify", "codegraph", "crg-full", "ua-tree", "serena-lsp"}
SUPPORTED_STATES = {"clean", "dirty"}
CLAUDE_BIN = "/Users/la/.npm-global/bin/claude"

RESULT_COLUMNS = [
    "query_id",
    "state",
    "backend",
    "grade",
    "stale_cause",
    "f1",
    "precision",
    "recall",
    "tool_calls",
    "tokens_in",
    "tokens_out",
    "executor_ms",
    "retrieval_ms",
]


def parse_list(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def resolve_path(path_value: str) -> Path:
    path = Path(path_value)
    return path if path.is_absolute() else (SUITE_DIR / path).resolve()


def run_checked(cmd: List[str], cwd: Path, timeout: int = 120) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(
            f"Command failed ({' '.join(cmd)}):\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )
    return proc


def parse_json_stdout(stdout: str) -> Any:
    text = stdout.strip()
    if not text:
        raise ValueError("empty stdout")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    for line in reversed(text.splitlines()):
        line = line.strip()
        if line.startswith("{") or line.startswith("["):
            return json.loads(line)

    raise ValueError("no JSON object found")


def load_queries(selected_ids: List[str]) -> List[Dict[str, str]]:
    with (SUITE_DIR / "queries.json").open("r", encoding="utf-8") as handle:
        all_queries = {query["query_id"]: query for query in json.load(handle)}

    missing = [query_id for query_id in selected_ids if query_id not in all_queries]
    if missing:
        raise ValueError(f"Unknown query ids: {', '.join(missing)}")

    return [all_queries[query_id] for query_id in selected_ids]


def apply_state(fixture_path: Path, state: str) -> None:
    run_checked(["bash", "setup-clean.sh"], cwd=fixture_path, timeout=120)
    if state == "dirty":
        run_checked(["bash", "setup-dirty.sh"], cwd=fixture_path, timeout=120)


def new_adapter(backend: str, fixture_path: Path):
    return make_adapter(
        backend,
        AdapterConfig(fixture_path=fixture_path, max_results=20, max_tokens=8000),
    )


def run_preflight(fixture_path: Path, backends: List[str]) -> None:
    results: List[Dict[str, Any]] = []

    for backend in backends:
        adapter = new_adapter(backend, fixture_path)
        try:
            result = envelope_gate(adapter)
            result["gate"] = "envelope"
            results.append(result)
        except Exception as exc:
            results.append(
                {
                    "gate": "envelope",
                    "passed": False,
                    "backend_name": backend,
                    "details": {},
                    "error": str(exc),
                }
            )
        finally:
            try:
                adapter.cleanup()
            except Exception:
                pass

        if backend == "cm-mcp-full":
            adapter = new_adapter(backend, fixture_path)
            try:
                result = index_sentinel_gate(adapter)
                result["gate"] = "index-sentinel"
                results.append(result)
            except Exception as exc:
                results.append(
                    {
                        "gate": "index-sentinel",
                        "passed": False,
                        "backend_name": backend,
                        "details": {},
                        "error": str(exc),
                    }
                )
            finally:
                try:
                    adapter.cleanup()
                except Exception:
                    pass

            adapter = new_adapter(backend, fixture_path)
            try:
                result = dirty_edit_gate(adapter, fixture_path)
                result["gate"] = "dirty-edit"
                results.append(result)
            except Exception as exc:
                results.append(
                    {
                        "gate": "dirty-edit",
                        "passed": False,
                        "backend_name": backend,
                        "details": {},
                        "error": str(exc),
                    }
                )
            finally:
                try:
                    adapter.cleanup()
                except Exception:
                    pass

    failures = []
    for result in results:
        status = "PASS" if result.get("passed") else "FAIL"
        print(f"[preflight] {status} {result.get('backend_name')} {result.get('gate')}")
        if not result.get("passed"):
            failures.append(result)

    if failures:
        print("\nPreflight failures:")
        for failure in failures:
            print(json.dumps(failure, indent=2))
        raise RuntimeError("preflight failed")


def format_search_results(response: Dict[str, Any]) -> str:
    chunks = []
    for item in response.get("results", []):
        chunks.append(
            f"--- {item.get('file', '')}:{item.get('line_start', 0)} ---\n"
            f"{item.get('content', '')}"
        )
    return "\n\n".join(chunks) if chunks else "(no results)"


def build_executor_prompt(query_text: str, response: Dict[str, Any]) -> str:
    count = response.get("metadata", {}).get("result_count", len(response.get("results", [])))
    evidence = format_search_results(response)

    return "\n".join(
        [
            "You are a code analysis agent. Answer based ONLY on these search results.",
            "",
            "## Question",
            query_text,
            "",
            f"## Search Results ({count} matches)",
            evidence,
            "",
            "## Instructions",
            "- For file lists: return a JSON array of file paths",
            '- For yes/no: return {"answer": true/false, "evidence": ["explanation"]}',
            '- For values: return {"answer": "value", "locations": ["file:line"]}',
            "",
            "Respond with ONLY the JSON answer.",
        ]
    )


def claude_text(payload: Any, raw: str) -> Any:
    if not isinstance(payload, dict):
        return payload

    if "result" in payload:
        return payload["result"]

    content = payload.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        if parts:
            return "\n".join(parts)

    if "message" in payload:
        return payload["message"]

    return raw


def extract_json_answer(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str):
        return value

    text = value.strip()
    if not text:
        return text

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char not in "[{":
            continue
        try:
            parsed, _ = decoder.raw_decode(text[index:])
            return parsed
        except json.JSONDecodeError:
            continue

    return text


def run_executor(query_text: str, response: Dict[str, Any]) -> Dict[str, Any]:
    started = time.monotonic()
    prompt = build_executor_prompt(query_text, response)

    try:
        proc = subprocess.run(
            [CLAUDE_BIN, "-p", "--output-format", "json", prompt],
            cwd=str(SUITE_DIR),
            text=True,
            capture_output=True,
            timeout=int(os.environ.get("RETRIEVAL_EVAL_EXECUTOR_TIMEOUT", "60")),
        )
    except subprocess.TimeoutExpired as exc:
        return {
            "solution": {"error": "executor_timeout", "message": f"Timed out after {exc.timeout}s"},
            "tool_calls": 1,
            "tokens_input": 0,
            "tokens_output": 0,
            "executor_task_ms": int((time.monotonic() - started) * 1000),
        }
    except OSError as exc:
        return {
            "solution": {"error": "executor_failed", "message": str(exc)[:500]},
            "tool_calls": 1,
            "tokens_input": 0,
            "tokens_output": 0,
            "executor_task_ms": int((time.monotonic() - started) * 1000),
        }

    if proc.returncode != 0:
        return {
            "solution": {
                "error": "executor_failed",
                "stdout": proc.stdout[-2000:],
                "stderr": proc.stderr[-4000:],
            },
            "tool_calls": 1,
            "tokens_input": 0,
            "tokens_output": 0,
            "executor_task_ms": int((time.monotonic() - started) * 1000),
        }

    try:
        payload = parse_json_stdout(proc.stdout)
        text = claude_text(payload, proc.stdout)
        solution = extract_json_answer(text)
        usage = payload.get("usage", {}) if isinstance(payload, dict) else {}
        tokens_input = int(usage.get("input_tokens") or 0)
        tokens_output = int(usage.get("output_tokens") or 0)
    except Exception as exc:
        solution = {
            "error": "executor_bad_json",
            "message": str(exc),
            "stdout": proc.stdout[-4000:],
        }
        tokens_input = 0
        tokens_output = 0

    return {
        "solution": solution,
        "tool_calls": 1,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "executor_task_ms": int((time.monotonic() - started) * 1000),
    }


def run_cell(query: Dict[str, str], state: str, backend: str, fixture_path: Path) -> Dict[str, Any]:
    adapter = new_adapter(backend, fixture_path)
    retrieval_ms = 0
    cold_index_ms = 0
    search_results: List[Dict[str, Any]] = []

    cell_started = time.monotonic()

    try:
        prepare_result = adapter.prepare()
        cold_index_ms = int(prepare_result.get("cold_index_ms") or 0)

        tagged_query = f"[{query['query_id']}] [state:{state}] {query['query_text']}"
        retrieval_started = time.monotonic()
        response = adapter.search(tagged_query, query["query_class"])
        retrieval_ms = int((time.monotonic() - retrieval_started) * 1000)

        search_results.append(
            {
                "query": query["query_text"],
                "query_class": query["query_class"],
                "response": response,
                "retrieval_ms": retrieval_ms,
            }
        )

        executor = run_executor(query["query_text"], response)
        executor["executor_task_ms"] = int((time.monotonic() - cell_started) * 1000)
        executor["retrieval_ms"] = retrieval_ms
        executor["cold_index_ms"] = cold_index_ms
        executor["search_results"] = search_results
        return executor

    except Exception as exc:
        return {
            "solution": {"error": "executor_error", "message": str(exc)},
            "tool_calls": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "executor_task_ms": int((time.monotonic() - cell_started) * 1000),
            "retrieval_ms": retrieval_ms,
            "cold_index_ms": cold_index_ms,
            "search_results": search_results,
        }
    finally:
        try:
            adapter.cleanup()
        except Exception:
            pass


def fmt_float(value: Any) -> str:
    try:
        return f"{float(value):.4f}"
    except Exception:
        return "0.0000"


def fmt_int(value: Any) -> str:
    try:
        return str(int(value))
    except Exception:
        return "0"


def make_row(
    query_id: str,
    state: str,
    backend: str,
    cell: Dict[str, Any],
    grade: Dict[str, Any],
) -> Dict[str, str]:
    return {
        "query_id": query_id,
        "state": state,
        "backend": backend,
        "grade": str(grade.get("grade", "FAIL")),
        "stale_cause": str(grade.get("stale_cause", "not-applicable")),
        "f1": fmt_float(grade.get("f1", 0)),
        "precision": fmt_float(grade.get("precision", 0)),
        "recall": fmt_float(grade.get("recall", 0)),
        "tool_calls": fmt_int(cell.get("tool_calls", 0)),
        "tokens_in": fmt_int(cell.get("tokens_input", 0)),
        "tokens_out": fmt_int(cell.get("tokens_output", 0)),
        "executor_ms": fmt_int(cell.get("executor_task_ms", 0)),
        "retrieval_ms": fmt_int(cell.get("retrieval_ms", 0)),
    }


def print_summary(rows: List[Dict[str, str]], query_order: List[str], backends: List[str]) -> None:
    print("\nDelta vs rg-control (average F1 across selected states)")
    columns = ["query_id", "rg_f1"] + [f"{backend}_delta" for backend in backends if backend != "rg-control"]
    widths = {column: max(len(column), 12) for column in columns}

    print("  ".join(column.ljust(widths[column]) for column in columns))
    print("  ".join("-" * widths[column] for column in columns))

    for query_id in query_order:
        by_backend: Dict[str, List[float]] = {backend: [] for backend in backends}
        for row in rows:
            if row["query_id"] == query_id:
                by_backend[row["backend"]].append(float(row["f1"]))

        averages = {
            backend: (sum(values) / len(values) if values else None)
            for backend, values in by_backend.items()
        }
        rg = averages.get("rg-control")

        line = {"query_id": query_id, "rg_f1": "n/a" if rg is None else f"{rg:.2f}"}
        for backend in backends:
            if backend == "rg-control":
                continue
            value = averages.get(backend)
            key = f"{backend}_delta"
            if value is None or rg is None:
                line[key] = "n/a"
            else:
                line[key] = f"{value - rg:+.2f}"

        print("  ".join(line.get(column, "n/a").ljust(widths[column]) for column in columns))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the retrieval eval benchmark suite.")
    parser.add_argument("--fixture-path", default=DEFAULT_FIXTURE)
    parser.add_argument("--backends", default=DEFAULT_BACKENDS)
    parser.add_argument("--states", default=DEFAULT_STATES)
    parser.add_argument("--queries", default=DEFAULT_QUERIES)
    parser.add_argument("--skip-preflight", action="store_true")
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--output", default="run-results.tsv")
    args = parser.parse_args()

    fixture_path = resolve_path(args.fixture_path)
    output_path = resolve_path(args.output)
    backends = parse_list(args.backends)
    states = parse_list(args.states)
    query_ids = parse_list(args.queries)

    bad_backends = [backend for backend in backends if backend not in SUPPORTED_BACKENDS]
    if bad_backends:
        raise ValueError(f"Unsupported backends: {', '.join(bad_backends)}")

    bad_states = [state for state in states if state not in SUPPORTED_STATES]
    if bad_states:
        raise ValueError(f"Unsupported states: {', '.join(bad_states)}")

    queries = load_queries(query_ids)

    if not args.skip_preflight:
        apply_state(fixture_path, "clean")
        run_preflight(fixture_path, backends)
        if args.preflight_only:
            return 0
    elif args.preflight_only:
        print("Preflight skipped by --skip-preflight.")
        return 0

    rows: List[Dict[str, str]] = []
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with output_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=RESULT_COLUMNS, delimiter="\t")
            writer.writeheader()

            for state in states:
                for query in queries:
                    for backend in backends:
                        print(f"[run] {query['query_id']} state={state} backend={backend}")
                        apply_state(fixture_path, state)
                        cell = run_cell(query, state, backend, fixture_path)
                        grade = grade_solution(query["query_id"], state, cell.get("solution"))
                        row = make_row(query["query_id"], state, backend, cell, grade)
                        writer.writerow(row)
                        handle.flush()
                        rows.append(row)
    finally:
        try:
            apply_state(fixture_path, "clean")
        except Exception as exc:
            print(f"[warn] failed to restore clean state: {exc}", file=sys.stderr)

    print(f"\nWrote {output_path}")
    print_summary(rows, query_ids, backends)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
