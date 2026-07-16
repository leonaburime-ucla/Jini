#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
from typing import Any, Dict, List

from adapters import RG_BIN, BaseAdapter


def _run_setup(fixture_path: Path, script: str) -> None:
    proc = subprocess.run(
        ["bash", script],
        cwd=str(fixture_path),
        text=True,
        capture_output=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"{script} failed:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )


def _response_files(response: Dict[str, Any]) -> List[str]:
    return [str(item.get("file", "")) for item in response.get("results", [])]


def dirty_edit_gate(adapter: BaseAdapter, fixture_path: Path) -> Dict[str, Any]:
    fixture_path = Path(fixture_path).resolve()
    result: Dict[str, Any] = {
        "passed": False,
        "backend_name": adapter.name,
        "details": {
            "clean_query_result": [],
            "dirty_query_result_backend": [],
            "dirty_query_result_rg": [],
            "backend_returned_stale": False,
            "rg_returned_fresh": False,
        },
    }

    try:
        _run_setup(fixture_path, "setup-clean.sh")
        adapter.prepare()

        clean_response = adapter.search("Who calls `calculateShippingCost`?", "callers")
        result["details"]["clean_query_result"] = _response_files(clean_response)

        _run_setup(fixture_path, "setup-dirty.sh")

        dirty_backend_response = adapter.search("Who calls `calculateShippingCost`?", "callers")
        result["details"]["dirty_query_result_backend"] = _response_files(dirty_backend_response)

        rg_dirty_files: List[str] = []
        rg_proc = subprocess.run(
            [RG_BIN, "-l", "calculateShippingCost", str(fixture_path / "src")],
            text=True,
            capture_output=True,
            timeout=20,
        )
        if rg_proc.returncode in {0, 1}:
            for line in rg_proc.stdout.splitlines():
                if line.strip():
                    path = line.strip()
                    root = str(fixture_path).rstrip("/") + "/"
                    rg_dirty_files.append(path[len(root) :] if path.startswith(root) else path)
        result["details"]["dirty_query_result_rg"] = rg_dirty_files

        backend_files = result["details"]["dirty_query_result_backend"]
        backend_has_shipping = any("shipping" in item for item in backend_files)
        backend_missing_logistics = not any("logistics" in item for item in backend_files)
        result["details"]["backend_returned_stale"] = (
            backend_has_shipping and backend_missing_logistics
        )
        result["details"]["rg_returned_fresh"] = any("logistics" in item for item in rg_dirty_files)

        result["passed"] = (
            result["details"]["backend_returned_stale"]
            and result["details"]["rg_returned_fresh"]
        )

        if not result["passed"] and not result["details"]["backend_returned_stale"]:
            if not backend_files:
                result[
                    "error"
                ] = "Backend returned EMPTY on dirty query; it may have errored or bypassed the stale trap"
            elif any("logistics" in item for item in backend_files):
                result[
                    "error"
                ] = "Backend returned FRESH data on dirty state; it re-read live disk without stale-index behavior"

    except Exception as exc:
        result["error"] = f"Gate execution error: {exc}"
    finally:
        try:
            _run_setup(fixture_path, "setup-clean.sh")
        except Exception:
            pass

    return result


def index_sentinel_gate(adapter: BaseAdapter) -> Dict[str, Any]:
    required_edge_types = ["CALLS", "IMPORTS"]
    sentinel_query = "Does `OrderService` have a circular dependency with `InventoryService`?"

    result: Dict[str, Any] = {
        "passed": False,
        "backend_name": adapter.name,
        "details": {
            "manifest_node_count": 0,
            "manifest_edge_types": [],
            "manifest_index_mode": "",
            "sentinel_query": sentinel_query,
            "sentinel_result_count": 0,
            "required_edge_types": required_edge_types,
            "missing_edge_types": [],
        },
    }

    try:
        prepare_result = adapter.prepare()
        manifest = prepare_result.get("manifest", {})
        edge_types = manifest.get("edge_types", [])

        result["details"]["manifest_node_count"] = int(manifest.get("node_count") or 0)
        result["details"]["manifest_edge_types"] = edge_types
        result["details"]["manifest_index_mode"] = str(manifest.get("index_mode") or "")

        missing = [edge for edge in required_edge_types if edge not in edge_types]
        result["details"]["missing_edge_types"] = missing
        if missing:
            result["error"] = (
                "Missing required edge types: "
                + ", ".join(missing)
                + '. Index mode may be "fast".'
            )
            return result

        response = adapter.search(sentinel_query, "architecture")
        count = int(response.get("metadata", {}).get("result_count") or len(response.get("results", [])))
        result["details"]["sentinel_result_count"] = count

        if count <= 0:
            result[
                "error"
            ] = "Sentinel query returned 0 results despite reporting CALLS and IMPORTS edges."
            return result

        result["passed"] = True
    except Exception as exc:
        result["error"] = f"Sentinel gate error: {exc}"

    return result


def envelope_gate(adapter: BaseAdapter) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "passed": False,
        "backend_name": adapter.name,
        "details": {
            "has_results_array": False,
            "has_status_field": False,
            "has_metadata": False,
            "results_conform": False,
            "no_identity_leak": False,
        },
    }

    try:
        adapter.prepare()
        response = adapter.search("Find `OrderService`", "symbol_lookup")

        result["details"]["has_results_array"] = isinstance(response.get("results"), list)
        result["details"]["has_status_field"] = response.get("status") in {
            "ok",
            "unsupported",
            "error",
        }

        metadata = response.get("metadata")
        result["details"]["has_metadata"] = (
            isinstance(metadata, dict)
            and isinstance(metadata.get("result_count"), int)
            and isinstance(metadata.get("truncated"), bool)
            and isinstance(metadata.get("query_class"), str)
        )

        results = response.get("results", [])
        result["details"]["results_conform"] = all(
            isinstance(item, dict)
            and isinstance(item.get("file"), str)
            and isinstance(item.get("line_start"), int)
            and isinstance(item.get("line_end"), int)
            and isinstance(item.get("content"), str)
            for item in results
        )

        serialized = json.dumps(response).lower()
        identity_leaks = [
            "codebase-memory",
            "cm-mcp",
            "ripgrep",
            "oracle",
            "codegraph",
            "serena",
            "graphify",
            "understand-anything",
        ]
        result["details"]["no_identity_leak"] = not any(
            leak in serialized for leak in identity_leaks
        )

        result["passed"] = all(result["details"].values())
    except Exception as exc:
        result["error"] = f"Envelope gate error: {exc}"

    return result
