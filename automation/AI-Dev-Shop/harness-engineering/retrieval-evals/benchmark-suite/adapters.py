#!/usr/bin/env python3
import json
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

SUITE_DIR = Path(__file__).resolve().parent
RG_BIN = "/usr/local/bin/rg"


@dataclass
class AdapterConfig:
    fixture_path: Path
    max_results: int = 20
    max_tokens: int = 8000

    def __post_init__(self) -> None:
        self.fixture_path = Path(self.fixture_path).resolve()


class BaseAdapter:
    name = "base"

    def __init__(self, config: AdapterConfig):
        self.config = config

    def prepare(self) -> Dict[str, Any]:
        raise NotImplementedError

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        raise NotImplementedError

    def cleanup(self) -> None:
        return None

    def normalize_response(
        self,
        results: List[Dict[str, Any]],
        query_class: str,
        truncated: bool = False,
    ) -> Dict[str, Any]:
        limited = results[: self.config.max_results]
        return {
            "results": limited,
            "status": "ok",
            "metadata": {
                "result_count": len(limited),
                "truncated": truncated or len(results) > self.config.max_results,
                "query_class": query_class,
            },
        }

    def unsupported_response(self, query_class: str) -> Dict[str, Any]:
        return {
            "results": [],
            "status": "unsupported",
            "metadata": {"result_count": 0, "truncated": False, "query_class": query_class},
        }

    def error_response(self, query_class: str) -> Dict[str, Any]:
        return {
            "results": [],
            "status": "error",
            "metadata": {"result_count": 0, "truncated": False, "query_class": query_class},
        }


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _relative_to_fixture(path_text: str, fixture_path: Path) -> str:
    text = str(path_text).replace("\\", "/")
    root = str(fixture_path).replace("\\", "/").rstrip("/")

    if text.startswith(root + "/"):
        return text[len(root) + 1 :]

    try:
        path = Path(path_text)
        if path.is_absolute():
            return str(path.resolve().relative_to(fixture_path)).replace("\\", "/")
    except Exception:
        pass

    return text.lstrip("./")


def _parse_json_loose(text: str) -> Any:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("empty JSON output")

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    for line in reversed(raw.splitlines()):
        line = line.strip()
        if not line:
            continue
        if line.startswith("{") or line.startswith("["):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue

    raise ValueError("no JSON object found in output")


def _unwrap_mcp_payload(payload: Any) -> Any:
    if isinstance(payload, dict) and payload.get("error"):
        raise RuntimeError(json.dumps(payload["error"]))

    if isinstance(payload, dict) and payload.get("isError"):
        parts = []
        for item in payload.get("content", []):
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        raise RuntimeError(" ".join(parts) or "MCP tool returned isError")

    if isinstance(payload, dict) and "result" in payload and not any(
        key in payload for key in ("results", "paths", "nodes_indexed", "node_count")
    ):
        return _unwrap_mcp_payload(payload["result"])

    if isinstance(payload, dict) and isinstance(payload.get("structuredContent"), (dict, list)):
        return _unwrap_mcp_payload(payload["structuredContent"])

    if isinstance(payload, dict) and isinstance(payload.get("content"), list):
        parts: List[str] = []
        for item in payload["content"]:
            if isinstance(item, dict):
                if isinstance(item.get("text"), str):
                    parts.append(item["text"])
                elif isinstance(item.get("content"), str):
                    parts.append(item["content"])
            elif isinstance(item, str):
                parts.append(item)

        text = "\n".join(parts).strip()
        if text:
            try:
                return _unwrap_mcp_payload(json.loads(text))
            except json.JSONDecodeError:
                return {"text": text}

    return payload


class RgAdapter(BaseAdapter):
    name = "rg-control"

    def prepare(self) -> Dict[str, Any]:
        return {
            "cold_index_ms": 0,
            "manifest": {
                "node_count": 0,
                "edge_types": [],
                "index_mode": "none",
                "built_at": _now_iso(),
            },
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        patterns = self.extract_patterns(query)
        results: List[Dict[str, Any]] = []
        seen = set()

        for pattern in patterns:
            cmd = [
                RG_BIN,
                "--json",
                "-n",
                "--max-count=50",
                pattern,
                str(self.config.fixture_path / "src"),
                str(self.config.fixture_path / "tests"),
            ]

            try:
                proc = subprocess.run(
                    cmd,
                    text=True,
                    capture_output=True,
                    timeout=10,
                )
            except (OSError, subprocess.TimeoutExpired):
                return self.error_response(query_class)

            if proc.returncode == 1:
                continue
            if proc.returncode != 0:
                return self.error_response(query_class)

            for line in proc.stdout.splitlines():
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if obj.get("type") != "match":
                    continue

                data = obj.get("data", {})
                path_text = data.get("path", {}).get("text", "")
                line_number = int(data.get("line_number") or 0)
                content = data.get("lines", {}).get("text", "").rstrip("\n")
                rel_path = _relative_to_fixture(path_text, self.config.fixture_path)
                key = (rel_path, line_number, content)
                if key in seen:
                    continue
                seen.add(key)

                results.append(
                    {
                        "file": rel_path,
                        "line_start": line_number,
                        "line_end": line_number,
                        "content": content,
                    }
                )

        return self.normalize_response(results, query_class)

    def extract_patterns(self, query: str) -> List[str]:
        cleaned = re.sub(r"\[Q\d+\]|\[state:[^\]]+\]", " ", query)
        symbols = re.findall(r"`([^`]+)`", cleaned)
        if symbols:
            return list(dict.fromkeys(symbols))

        stopwords = {
            "what",
            "where",
            "does",
            "from",
            "that",
            "this",
            "with",
            "find",
            "list",
            "every",
            "return",
            "only",
            "files",
            "file",
            "contain",
            "contains",
            "call",
            "calls",
            "sites",
            "whether",
            "through",
            "which",
            "need",
            "edits",
            "would",
            "break",
            "include",
            "definition",
            "internal",
            "production",
            "tests",
            "handled",
            "request",
            "answer",
            "route",
            "value",
            "location",
            "sets",
            "defaults",
        }
        tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]*|\d+", cleaned)
        significant = [
            token
            for token in tokens
            if len(token) > 3 and token.lower() not in stopwords
        ]
        return significant[:3] or [cleaned.strip()]


class OracleAdapter(BaseAdapter):
    name = "oracle-context"

    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        self.oracle: Dict[str, Dict[str, Any]] = {}

    def prepare(self) -> Dict[str, Any]:
        oracle_path = self._oracle_path()
        self.oracle = {}

        try:
            entries = json.loads(oracle_path.read_text(encoding="utf-8"))
            for entry in entries:
                self.oracle[f"{entry.get('query_id')}:{entry.get('state')}"] = entry
        except Exception:
            self.oracle = {}

        return {
            "cold_index_ms": 0,
            "manifest": {
                "node_count": len(self.oracle),
                "edge_types": ["oracle"],
                "index_mode": "oracle",
                "built_at": _now_iso(),
            },
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        query_id = self._extract_query_id(query)
        state = self._extract_state(query)
        entry = self.oracle.get(f"{query_id}:{state}")
        if not entry:
            return self.error_response(query_class)

        results = []
        for evidence in entry.get("evidence", []):
            results.append(
                {
                    "file": evidence.get("file", ""),
                    "line_start": int(evidence.get("line_start") or 0),
                    "line_end": int(evidence.get("line_end") or evidence.get("line_start") or 0),
                    "content": evidence.get("content", ""),
                    "confidence": 1.0,
                }
            )

        return self.normalize_response(results, query_class)

    def cleanup(self) -> None:
        self.oracle = {}

    def _oracle_path(self) -> Path:
        candidates = [
            self.config.fixture_path.parent.parent / "oracle-evidence.json",
            SUITE_DIR / "oracle-evidence.json",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return candidates[0]

    def _extract_query_id(self, query: str) -> str:
        match = re.search(r"\[Q(\d+)\]", query)
        return f"Q{match.group(1)}" if match else ""

    def _extract_state(self, query: str) -> str:
        match = re.search(r"\[state:(\w+)\]", query)
        return match.group(1) if match else "clean"


class CodebaseMemoryAdapter(BaseAdapter):
    name = "cm-mcp-full"

    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        self.project_name = ""

    def prepare(self) -> Dict[str, Any]:
        started = time.monotonic()
        self.project_name = ""

        try:
            index_result = self._mcp_call(
                "index_repository",
                {
                    "repo_path": str(self.config.fixture_path),
                    "mode": "full",
                },
            )
            self.project_name = str(
                index_result.get("project")
                or index_result.get("project_name")
                or self._project_name_from_path()
            )
            node_count = (
                index_result.get("nodes")
                or index_result.get("nodes_indexed")
                or index_result.get("node_count")
                or 0
            )
            edge_types = index_result.get("edge_types") or [
                "CALLS",
                "IMPORTS",
                "CONTAINS",
                "SIMILARITY",
            ]
            index_mode = index_result.get("mode") or index_result.get("index_mode") or "full"
        except Exception:
            node_count = 0
            edge_types = []
            index_mode = "error"

        return {
            "cold_index_ms": int((time.monotonic() - started) * 1000),
            "manifest": {
                "node_count": int(node_count or 0),
                "edge_types": edge_types,
                "index_mode": index_mode,
                "built_at": _now_iso(),
            },
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        try:
            results: List[Dict[str, Any]] = []
            symbols = re.findall(r"`([^`]+)`", query)

            if symbols and query_class in {
                "callers",
                "dependency_path",
                "change_impact",
            }:
                direction = "inbound" if query_class in {"callers", "change_impact"} else "both"
                trace_result = self._mcp_call(
                    "trace_path",
                    {
                        "project": self.project_name,
                        "function_name": symbols[0],
                        "direction": direction,
                        "mode": "calls",
                        "depth": 3,
                    },
                )
                results = self._parse_trace_result(trace_result)

            if not results:
                search_result = self._mcp_call(
                    "search_graph",
                    {
                        "project": self.project_name,
                        "query": symbols[0] if symbols else query,
                    },
                )
                results = self._parse_search_result(search_result)

            return self.normalize_response(results, query_class)
        except Exception:
            return self.error_response(query_class)

    def cleanup(self) -> None:
        if not self.project_name:
            return
        try:
            self._mcp_call(
                "delete_project",
                {"project": self.project_name},
            )
        except Exception:
            pass

    def _project_name_from_path(self) -> str:
        raw = str(self.config.fixture_path).replace("\\", "/")
        chars: List[str] = []
        prev = ""
        for char in raw:
            value = char if re.match(r"[A-Za-z0-9._]", char) else "-"
            if value == "-" and prev == "-":
                continue
            chars.append(value)
            prev = value
        return "".join(chars).strip("-.")

    def _mcp_call(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if not MCP_PROBE.exists():
            raise FileNotFoundError(str(MCP_PROBE))

        timeout = 180 if method == "index_repository" else 60
        cmd = [
            "python3",
            str(MCP_PROBE),
            "--call",
            method,
            "--args",
            json.dumps(params),
            "--timeout",
            str(timeout),
            "--",
            "codebase-memory-mcp",
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(SUITE_DIR),
            text=True,
            capture_output=True,
            timeout=timeout + 5,
        )
        if proc.returncode != 0:
            raise RuntimeError((proc.stderr or proc.stdout or "mcp_probe failed").strip())
        if not proc.stdout.strip():
            raise RuntimeError("mcp_probe returned no output")

        return _unwrap_mcp_payload(_parse_json_loose(proc.stdout))

    def _resolve_qualified_name(self, qualified_name: str) -> str:
        """Resolve a cm-mcp dotted qualified_name to a fixture-relative file path.

        Format: ``<repo-path-dashed>.<module.path>.<Symbol...>``. The repo prefix
        has no dots, so split on the first dot, then walk the remaining dotted
        segments and return the longest prefix that exists as a source file.
        """
        if "." not in qualified_name:
            return ""
        _, _, remainder = qualified_name.partition(".")
        segments = [seg for seg in remainder.split(".") if seg]
        for count in range(len(segments), 0, -1):
            rel = "/".join(segments[:count])
            for ext in (".ts", ".tsx", ".js", ".json"):
                if (self.config.fixture_path / f"{rel}{ext}").is_file():
                    return f"{rel}{ext}"
        return ""

    def _parse_trace_result(self, result: Any) -> List[Dict[str, Any]]:
        payload = _unwrap_mcp_payload(result)
        if isinstance(payload, dict) and payload.get("results"):
            return self._parse_search_result(payload)

        results: List[Dict[str, Any]] = []
        seen = set()

        # Handle callers/callees format: {callers: [{name, qualified_name, hop}]}
        items = (
            payload.get("callers", [])
            or payload.get("callees", [])
            or payload.get("nodes", [])
            if isinstance(payload, dict) else []
        )
        if items:
            for node in items:
                if not isinstance(node, dict):
                    continue
                qname = node.get("qualified_name", "")
                file_path = (
                    node.get("file_path") or node.get("file") or node.get("path")
                    or node.get("relative_path") or ""
                )
                name = node.get("name") or ""
                rel_path = _relative_to_fixture(file_path, self.config.fixture_path) if file_path else ""
                # cm-mcp trace nodes carry no file_path; the dotted qualified_name
                # encodes it (e.g. <repo>.src.orders.OrderService.OrderService.foo).
                # Resolve it against the fixture so callers map to source files.
                if not rel_path and qname:
                    rel_path = self._resolve_qualified_name(qname)
                key = (rel_path, name)
                if key in seen:
                    continue
                seen.add(key)
                results.append({
                    "file": rel_path,
                    "line_start": int(node.get("line") or node.get("line_start") or 0),
                    "line_end": int(node.get("line_end") or 0),
                    "content": name,
                })
            return results

        # Handle paths format: {paths: [{nodes: [...]}]}
        paths = payload.get("paths", []) if isinstance(payload, dict) else []
        for path in paths:
            nodes = path.get("nodes", path if isinstance(path, list) else [])
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                file_path = node.get("file") or node.get("path") or node.get("relative_path")
                if not file_path:
                    continue
                line = int(node.get("line") or node.get("line_start") or 0)
                content = node.get("content") or node.get("snippet") or node.get("name") or ""
                rel_path = _relative_to_fixture(file_path, self.config.fixture_path)
                key = (rel_path, line, content)
                if key in seen:
                    continue
                seen.add(key)

                item: Dict[str, Any] = {
                    "file": rel_path,
                    "line_start": line,
                    "line_end": int(node.get("line_end") or line),
                    "content": content,
                }
                confidence = node.get("confidence") or node.get("score")
                if confidence is not None:
                    item["confidence"] = confidence
                results.append(item)

        return results

    def _parse_search_result(self, result: Any) -> List[Dict[str, Any]]:
        payload = _unwrap_mcp_payload(result)
        if not isinstance(payload, dict):
            return []

        items = payload.get("results") or payload.get("matches") or []
        results: List[Dict[str, Any]] = []
        seen = set()

        for item in items:
            if not isinstance(item, dict):
                continue
            file_path = (
                item.get("file_path") or item.get("file") or item.get("path") or item.get("relative_path")
            )
            if not file_path:
                continue

            line_start = int(item.get("line") or item.get("line_start") or 0)
            line_end = int(item.get("line_end") or line_start)
            content = item.get("content") or item.get("snippet") or item.get("text") or ""
            rel_path = _relative_to_fixture(file_path, self.config.fixture_path)
            key = (rel_path, line_start, content)
            if key in seen:
                continue
            seen.add(key)

            parsed: Dict[str, Any] = {
                "file": rel_path,
                "line_start": line_start,
                "line_end": line_end,
                "content": content,
            }
            confidence = item.get("score") or item.get("confidence") or item.get("relevanceScore")
            if confidence is not None:
                parsed["confidence"] = confidence
            results.append(parsed)

        return results


GRAPHIFY_BIN = Path("/Users/la/.local/bin/graphify")
CODEGRAPH_SCRIPT = Path(
    "/Users/la/Desktop/Multi-Agent Swarm Foundation/AI-Dev-Shop/integrations/codegraph/upstream/dist/bin/codegraph.js"
)
CRG_BIN = Path("/Users/la/.local/bin/code-review-graph")
UA_DIR = Path(
    "/Users/la/Desktop/Multi-Agent Swarm Foundation/AI-Dev-Shop/integrations/understand-anything"
)
UA_BUILD_SCRIPT = UA_DIR / "build-graph.mjs"
UA_SEARCH_SCRIPT = UA_DIR / "search-graph.mjs"
SERENA_MCP_SERVER = Path(
    "/Users/la/Desktop/Multi-Agent Swarm Foundation/AI-Dev-Shop/integrations/serena/upstream/scripts/mcp_server.py"
)
MCP_PROBE = SUITE_DIR / "tools" / "mcp_probe.py"

_SOURCE_EXTS = (
    "py", "js", "jsx", "ts", "tsx", "mjs", "cjs", "json", "yaml", "yml",
    "toml", "md", "go", "rs", "java", "rb", "php", "cs", "c", "cc", "cpp", "h", "hpp",
)
_SOURCE_EXT_RE = "|".join(_SOURCE_EXTS)


def _tool_missing_manifest(index_mode: str = "missing") -> Dict[str, Any]:
    return {
        "cold_index_ms": 0,
        "manifest": {
            "node_count": 0,
            "edge_types": [],
            "index_mode": index_mode,
            "built_at": _now_iso(),
        },
    }


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(float(str(value)))
    except Exception:
        return default


def _looks_like_source_path(text: str) -> bool:
    return bool(
        re.search(rf"\.({_SOURCE_EXT_RE})(?::\d+)?$", text.strip(), re.IGNORECASE)
        or (
            ("/" in text or "\\" in text)
            and re.search(rf"\.({_SOURCE_EXT_RE})(?::\d+)?", text, re.IGNORECASE)
        )
    )


def _extract_patterns(query: str) -> List[str]:
    cleaned = re.sub(r"\[Q\d+\]|\[state:[^\]]+\]", " ", query)
    quoted = [part.strip() for part in re.findall(r"`([^`]+)`", cleaned) if part.strip()]
    if quoted:
        return list(dict.fromkeys(quoted))

    stopwords = {
        "what", "where", "does", "from", "that", "this", "with", "find", "list",
        "every", "return", "only", "files", "file", "contain", "contains", "call",
        "calls", "sites", "whether", "through", "which", "need", "edits", "would",
        "break", "include", "definition", "internal", "production", "tests", "handled",
        "request", "answer", "route", "value", "location", "sets", "defaults",
        "architecture", "config", "configuration", "dependency", "dependencies",
        "impact", "change", "caller", "callers",
    }
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_./-]*|\d+", cleaned)
    significant = [
        token
        for token in tokens
        if len(token) > 3 and token.lower() not in stopwords
    ]
    return list(dict.fromkeys(significant[:5])) or [cleaned.strip()]


def _extract_symbol(query: str) -> str:
    for pattern in _extract_patterns(query):
        if not _looks_like_source_path(pattern):
            return pattern
    patterns = _extract_patterns(query)
    return patterns[0] if patterns else query.strip()


def _extract_relative_path(query: str, fixture_path: Path) -> str:
    for part in re.findall(r"`([^`]+)`", query):
        text = part.strip()
        if _looks_like_source_path(text):
            return _relative_to_fixture(text, fixture_path)

    path_pattern = rf"((?:\.{{1,2}}/)?(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.({_SOURCE_EXT_RE}))"
    match = re.search(path_pattern, query, re.IGNORECASE)
    if match:
        return _relative_to_fixture(match.group(1), fixture_path)

    return ""


def _manifest_from_graph_json(graph_path: Path, index_mode: str) -> Dict[str, Any]:
    node_count = 0
    edge_types: List[str] = []

    try:
        payload = json.loads(graph_path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            nodes = payload.get("nodes") or payload.get("vertices") or []
            edges = payload.get("edges") or payload.get("links") or []

            if isinstance(nodes, dict):
                node_count = len(nodes)
            elif isinstance(nodes, list):
                node_count = len(nodes)

            seen = set()
            if isinstance(edges, list):
                for edge in edges:
                    if not isinstance(edge, dict):
                        continue
                    edge_type = edge.get("type") or edge.get("kind") or edge.get("label") or edge.get("relation")
                    if edge_type and edge_type not in seen:
                        seen.add(edge_type)
                        edge_types.append(str(edge_type))
    except Exception:
        pass

    return {
        "node_count": int(node_count or 0),
        "edge_types": edge_types,
        "index_mode": index_mode,
        "built_at": _now_iso(),
    }


def _manifest_from_text(text: str, index_mode: str) -> Dict[str, Any]:
    node_count = 0
    edge_types: List[str] = []

    for pattern in (r"(\d+)\s+nodes?", r"nodes?\s*[:=]\s*(\d+)", r"(\d+)\s+symbols?"):
        match = re.search(pattern, text or "", re.IGNORECASE)
        if match:
            node_count = _safe_int(match.group(1))
            break

    edge_match = re.search(r"edge(?:_types| types)?\s*[:=]\s*([A-Za-z0-9_, -]+)", text or "", re.IGNORECASE)
    if edge_match:
        edge_types = [
            part.strip()
            for part in edge_match.group(1).split(",")
            if part.strip()
        ]

    return {
        "node_count": int(node_count or 0),
        "edge_types": edge_types,
        "index_mode": index_mode,
        "built_at": _now_iso(),
    }


def _dedupe_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for item in results:
        key = (
            item.get("file", ""),
            item.get("line_start", 0),
            item.get("line_end", 0),
            item.get("content", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _stringify_content(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    try:
        return json.dumps(value, sort_keys=True)
    except Exception:
        return str(value)


def _result_from_item(
    item: Dict[str, Any],
    fixture_path: Path,
    inherited_file: str = "",
) -> Optional[Dict[str, Any]]:
    location = item.get("location") if isinstance(item.get("location"), dict) else {}
    body_location = item.get("body_location") if isinstance(item.get("body_location"), dict) else {}

    file_path = (
        item.get("file")
        or item.get("path")
        or item.get("relative_path")
        or item.get("file_path")
        or item.get("filePath")
        or item.get("filepath")
        or item.get("filename")
        or location.get("file")
        or location.get("path")
        or location.get("relative_path")
        or inherited_file
    )

    if not file_path:
        return None

    line_start = _safe_int(
        item.get("line")
        or item.get("line_start")
        or item.get("start_line")
        or item.get("lineNumber")
        or location.get("line")
        or location.get("line_start")
        or location.get("start_line")
        or body_location.get("line")
        or body_location.get("line_start")
        or body_location.get("start_line")
        or body_location.get("startLine")
        or 0
    )
    line_end = _safe_int(
        item.get("line_end")
        or item.get("end_line")
        or location.get("line_end")
        or location.get("end_line")
        or body_location.get("line_end")
        or body_location.get("end_line")
        or body_location.get("endLine")
        or line_start
    )

    content = _stringify_content(
        item.get("content")
        or item.get("snippet")
        or item.get("text")
        or item.get("body")
        or item.get("content_around_reference")
        or item.get("summary")
        or item.get("description")
        or item.get("signature")
        or item.get("name_path")
        or item.get("name")
        or item.get("id")
        or ""
    )

    parsed: Dict[str, Any] = {
        "file": _relative_to_fixture(str(file_path), fixture_path),
        "line_start": line_start,
        "line_end": line_end,
        "content": content,
    }

    confidence = item.get("score") or item.get("confidence") or item.get("relevanceScore")
    if confidence is not None:
        parsed["confidence"] = confidence

    return parsed


def _parse_text_results(text: str, fixture_path: Path, limit: int = 200) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    file_re = re.compile(
        rf"((?:[A-Za-z]:)?[A-Za-z0-9_./\\ -]+\.({_SOURCE_EXT_RE}))(?:[:#L ]+(\d+))?",
        re.IGNORECASE,
    )

    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = file_re.search(line)
        if match:
            rel_path = _relative_to_fixture(match.group(1).strip(), fixture_path)
            line_no = _safe_int(match.group(3), 0)
            results.append(
                {
                    "file": rel_path,
                    "line_start": line_no,
                    "line_end": line_no,
                    "content": line,
                }
            )
        else:
            results.append(
                {
                    "file": "",
                    "line_start": 0,
                    "line_end": 0,
                    "content": line,
                }
            )

        if len(results) >= limit:
            break

    return _dedupe_results(results)


def _collect_payload_results(payload: Any, fixture_path: Path, limit: int = 200) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []

    def visit(obj: Any, depth: int = 0, inherited_file: str = "") -> None:
        if len(results) >= limit or depth > 10:
            return

        if isinstance(obj, dict):
            if isinstance(obj.get("text"), str):
                try:
                    nested = json.loads(obj["text"])
                    visit(nested, depth + 1, inherited_file)
                except Exception:
                    results.extend(_parse_text_results(obj["text"], fixture_path, limit - len(results)))
                return

            parsed = _result_from_item(obj, fixture_path, inherited_file)
            if parsed:
                results.append(parsed)

            for key, value in obj.items():
                next_file = inherited_file
                if isinstance(key, str) and _looks_like_source_path(key):
                    next_file = _relative_to_fixture(key, fixture_path)
                if isinstance(value, (dict, list)):
                    visit(value, depth + 1, next_file)

        elif isinstance(obj, list):
            for value in obj:
                visit(value, depth + 1, inherited_file)

    visit(_unwrap_mcp_payload(payload))
    return _dedupe_results(results[:limit])


def _parse_json_or_text_results(stdout: str, stderr: str, fixture_path: Path) -> List[Dict[str, Any]]:
    try:
        payload = _unwrap_mcp_payload(_parse_json_loose(stdout))
        results = _collect_payload_results(payload, fixture_path)
        if results:
            return results
    except Exception:
        pass

    return _parse_text_results(stdout or stderr, fixture_path)


def _mcp_probe_call(tool: str, args: Dict[str, Any], server_cmd: List[str], timeout: int = 60) -> Any:
    if not MCP_PROBE.exists():
        raise FileNotFoundError(str(MCP_PROBE))

    proc = subprocess.run(
        [
            "python3",
            str(MCP_PROBE),
            "--call",
            tool,
            "--args",
            json.dumps(args),
            "--",
            *server_cmd,
        ],
        cwd=str(SUITE_DIR),
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "mcp_probe failed").strip())

    return _unwrap_mcp_payload(_parse_json_loose(proc.stdout))


def _mcp_probe_list(server_cmd: List[str], timeout: int = 60) -> str:
    if not MCP_PROBE.exists():
        raise FileNotFoundError(str(MCP_PROBE))

    proc = subprocess.run(
        ["python3", str(MCP_PROBE), "--list", "--", *server_cmd],
        cwd=str(SUITE_DIR),
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "mcp_probe --list failed").strip())

    return proc.stdout


def _first_symbol_payload(payload: Any, fixture_path: Path) -> Dict[str, str]:
    found: Dict[str, str] = {}

    def visit(obj: Any, inherited_file: str = "") -> None:
        if found:
            return

        if isinstance(obj, dict):
            relative_path = (
                obj.get("relative_path")
                or obj.get("file")
                or obj.get("path")
                or inherited_file
                or ""
            )
            name_path = obj.get("name_path") or obj.get("name") or obj.get("symbol") or ""
            if relative_path and name_path:
                found["relative_path"] = _relative_to_fixture(str(relative_path), fixture_path)
                found["name_path"] = str(name_path)
                return

            for key, value in obj.items():
                next_file = inherited_file
                if isinstance(key, str) and _looks_like_source_path(key):
                    next_file = _relative_to_fixture(key, fixture_path)
                if isinstance(value, (dict, list)):
                    visit(value, next_file)

        elif isinstance(obj, list):
            for value in obj:
                visit(value, inherited_file)

    visit(_unwrap_mcp_payload(payload))
    return found


class GraphifyAdapter(BaseAdapter):
    name = "graphify"

    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        self.graph_path = self.config.fixture_path / "graphify-out" / "graph.json"
        self._node_file_map: Dict[str, str] = {}

    def prepare(self) -> Dict[str, Any]:
        if not GRAPHIFY_BIN.exists():
            return _tool_missing_manifest("tool_missing")

        started = time.monotonic()
        try:
            proc = subprocess.run(
                [str(GRAPHIFY_BIN), "update", str(self.config.fixture_path)],
                text=True,
                capture_output=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired):
            return _tool_missing_manifest("error")

        if proc.returncode != 0 or not self.graph_path.exists():
            return {
                "cold_index_ms": int((time.monotonic() - started) * 1000),
                "manifest": _tool_missing_manifest("error")["manifest"],
            }

        self._build_node_file_map()

        return {
            "cold_index_ms": int((time.monotonic() - started) * 1000),
            "manifest": _manifest_from_graph_json(self.graph_path, "graphify"),
        }

    def _build_node_file_map(self) -> None:
        try:
            graph = json.loads(self.graph_path.read_text(encoding="utf-8"))
            for node in graph.get("nodes", []):
                if not isinstance(node, dict):
                    continue
                node_id = node.get("id") or ""
                label = node.get("label") or node.get("name") or ""
                file_path = node.get("source_file") or node.get("file") or node.get("path") or ""
                if file_path:
                    rel = _relative_to_fixture(file_path, self.config.fixture_path)
                    if node_id:
                        self._node_file_map[node_id] = rel
                    if label and label != node_id:
                        self._node_file_map[label] = rel
        except Exception:
            pass

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        if not GRAPHIFY_BIN.exists() or not self.graph_path.exists():
            return self.error_response(query_class)

        patterns = _extract_patterns(query)
        symbol = _extract_symbol(query)

        if query_class == "dependency_path":
            endpoint = ""
            for pattern in patterns:
                if pattern != symbol and not _looks_like_source_path(pattern):
                    endpoint = pattern
                    break
            if endpoint:
                cmd = [
                    str(GRAPHIFY_BIN), "path", symbol, endpoint,
                    "--graph", str(self.graph_path),
                ]
            else:
                cmd = [
                    str(GRAPHIFY_BIN), "explain", symbol or query,
                    "--graph", str(self.graph_path),
                ]
        else:
            cmd = [
                str(GRAPHIFY_BIN), "explain", symbol or query,
                "--graph", str(self.graph_path),
            ]

        try:
            proc = subprocess.run(
                cmd, text=True, capture_output=True, timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired):
            return self.error_response(query_class)

        if proc.returncode != 0:
            return self.error_response(query_class)

        if query_class in {"callers", "change_impact"}:
            results = self._parse_explain_connections(proc.stdout)
        elif query_class == "dependency_path" and "path" in cmd:
            results = self._parse_path_output(proc.stdout)
        else:
            results = _parse_json_or_text_results(proc.stdout, proc.stderr, self.config.fixture_path)
        return self.normalize_response(results, query_class)

    def _parse_path_output(self, stdout: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        seen = set()
        node_re = re.compile(r"([A-Za-z0-9_./()-]+(?:\.[A-Za-z0-9_]+)?)")
        for line in (stdout or "").splitlines():
            for match in node_re.finditer(line):
                node_name = match.group(1).strip()
                if node_name in ("Shortest", "path", "hops") or len(node_name) < 3:
                    continue
                file_path = self._node_file_map.get(node_name, "")
                if not file_path:
                    lower = node_name.lower()
                    for key, val in self._node_file_map.items():
                        if key.lower() == lower:
                            file_path = val
                            break
                if file_path and file_path not in seen:
                    seen.add(file_path)
                    results.append({
                        "file": file_path,
                        "line_start": 0,
                        "line_end": 0,
                        "content": node_name,
                    })
        return results

    def _parse_explain_connections(self, stdout: str) -> List[Dict[str, Any]]:
        """Parse graphify explain output: extract source file + connected nodes."""
        results: List[Dict[str, Any]] = []
        seen: Set[str] = set()

        source_match = re.search(r"Source:\s+(\S+)", stdout or "")
        source_line = 0
        if source_match:
            src = source_match.group(1)
            line_match = re.search(r"L(\d+)", src)
            if line_match:
                source_line = int(line_match.group(1))
                src = src.split(" ")[0] if " " in src else src
            rel = _relative_to_fixture(src, self.config.fixture_path)
            if rel and rel not in seen:
                seen.add(rel)
                results.append({"file": rel, "line_start": source_line, "line_end": 0, "content": ""})

        conn_re = re.compile(r"(?:<--|-->)\s+(.*?)(?:\s+\[|\s+\(|$)")
        for line in (stdout or "").splitlines():
            m = conn_re.search(line)
            if not m:
                continue
            node_name = m.group(1).strip().lstrip(".")
            if not node_name:
                continue
            node_name_clean = re.sub(r"[()]", "", node_name)
            file_path = (
                self._node_file_map.get(node_name_clean)
                or self._node_file_map.get(node_name)
            )
            if not file_path:
                lower = node_name_clean.lower()
                for key, val in self._node_file_map.items():
                    if key.lower() == lower:
                        file_path = val
                        break
            if file_path and file_path not in seen:
                seen.add(file_path)
                results.append({"file": file_path, "line_start": 0, "line_end": 0, "content": node_name_clean})
        return results


class CodegraphAdapter(BaseAdapter):
    name = "codegraph"

    def prepare(self) -> Dict[str, Any]:
        if not CODEGRAPH_SCRIPT.exists():
            return _tool_missing_manifest("tool_missing")

        started = time.monotonic()
        index_dir = self.config.fixture_path / ".codegraph"

        if not index_dir.exists():
            try:
                proc = subprocess.run(
                    ["node", str(CODEGRAPH_SCRIPT), "init", str(self.config.fixture_path)],
                    text=True,
                    capture_output=True,
                    timeout=60,
                )
            except (OSError, subprocess.TimeoutExpired):
                return _tool_missing_manifest("error")

            if proc.returncode != 0:
                return {
                    "cold_index_ms": int((time.monotonic() - started) * 1000),
                    "manifest": _tool_missing_manifest("error")["manifest"],
                }

        manifest = {
            "node_count": 0,
            "edge_types": ["callers", "callees", "impact", "symbols"],
            "index_mode": "codegraph",
            "built_at": _now_iso(),
        }
        return {
            "cold_index_ms": int((time.monotonic() - started) * 1000),
            "manifest": manifest,
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        if not CODEGRAPH_SCRIPT.exists():
            return self.error_response(query_class)

        symbol = _extract_symbol(query)
        pattern = symbol or query

        if query_class == "callers":
            cmd = ["node", str(CODEGRAPH_SCRIPT), "callers", symbol, "-p", str(self.config.fixture_path), "--json"]
        elif query_class == "change_impact":
            cmd = ["node", str(CODEGRAPH_SCRIPT), "impact", symbol, "-p", str(self.config.fixture_path), "--json"]
        elif query_class == "dependency_path":
            cmd = ["node", str(CODEGRAPH_SCRIPT), "explore", query, "-p", str(self.config.fixture_path), "--json"]
        elif query_class in {"architecture", "config"}:
            cmd = ["node", str(CODEGRAPH_SCRIPT), "query", pattern, "-p", str(self.config.fixture_path), "--json"]
        else:
            return self.unsupported_response(query_class)

        try:
            proc = subprocess.run(
                cmd,
                text=True,
                capture_output=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired):
            return self.error_response(query_class)

        if proc.returncode != 0:
            return self.error_response(query_class)

        results = _parse_json_or_text_results(proc.stdout, proc.stderr, self.config.fixture_path)
        return self.normalize_response(results, query_class)


class CodeReviewGraphAdapter(BaseAdapter):
    name = "crg-full"

    def _server_cmd(self) -> List[str]:
        return [str(CRG_BIN), "serve", "--repo", str(self.config.fixture_path)]

    def prepare(self) -> Dict[str, Any]:
        if not CRG_BIN.exists():
            return _tool_missing_manifest("tool_missing")

        started = time.monotonic()
        try:
            build = subprocess.run(
                [str(CRG_BIN), "build", "--repo", str(self.config.fixture_path)],
                text=True,
                capture_output=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired):
            return _tool_missing_manifest("error")

        status_text = build.stdout + "\n" + build.stderr
        try:
            status = subprocess.run(
                [str(CRG_BIN), "status", "--repo", str(self.config.fixture_path)],
                text=True,
                capture_output=True,
                timeout=60,
            )
            status_text += "\n" + status.stdout + "\n" + status.stderr
        except (OSError, subprocess.TimeoutExpired):
            pass

        index_mode = "code-review-graph" if build.returncode == 0 else "error"
        return {
            "cold_index_ms": int((time.monotonic() - started) * 1000),
            "manifest": _manifest_from_text(status_text, index_mode),
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        if not CRG_BIN.exists() or not MCP_PROBE.exists():
            return self.error_response(query_class)

        symbol = _extract_symbol(query)
        candidates: List[tuple] = []

        if query_class == "callers":
            candidates = [
                ("query_graph_tool", {"pattern": "callers_of", "target": symbol}),
            ]
        elif query_class == "change_impact":
            candidates = [
                ("query_graph_tool", {"pattern": "callers_of", "target": symbol}),
                ("get_impact_radius_tool", {"changed_files": symbol}),
                ("semantic_search_nodes_tool", {"query": symbol, "limit": self.config.max_results}),
            ]
        elif query_class in {"dependency_path", "architecture"}:
            candidates = [
                ("query_graph_tool", {"pattern": "imports_of", "target": symbol}),
                ("semantic_search_nodes_tool", {"query": query, "limit": self.config.max_results}),
            ]
        elif query_class == "config":
            candidates = [
                ("semantic_search_nodes_tool", {"query": query, "limit": self.config.max_results}),
            ]
        else:
            return self.unsupported_response(query_class)

        last_error: Optional[Exception] = None
        for tool, args in candidates:
            try:
                payload = _mcp_probe_call(tool, args, self._server_cmd(), timeout=60)
                results = _collect_payload_results(payload, self.config.fixture_path)
                if results:
                    return self.normalize_response(results, query_class)
            except Exception as exc:
                last_error = exc

        if query_class == "change_impact":
            try:
                proc = subprocess.run(
                    [
                        str(CRG_BIN),
                        "detect-changes",
                        "--repo",
                        str(self.config.fixture_path),
                        "--base",
                        "HEAD~1",
                    ],
                    text=True,
                    capture_output=True,
                    timeout=60,
                )
                if proc.returncode == 0:
                    results = _parse_json_or_text_results(proc.stdout, proc.stderr, self.config.fixture_path)
                    return self.normalize_response(results, query_class)
            except (OSError, subprocess.TimeoutExpired):
                pass

        if last_error:
            return self.error_response(query_class)
        return self.normalize_response([], query_class)


class UnderstandAnythingAdapter(BaseAdapter):
    name = "ua-tree"

    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        self.graph_path = self.config.fixture_path / ".understand-anything" / "knowledge-graph.json"

    def prepare(self) -> Dict[str, Any]:
        if not UA_BUILD_SCRIPT.exists():
            return _tool_missing_manifest("tool_missing")

        started = time.monotonic()
        try:
            proc = subprocess.run(
                ["node", str(UA_BUILD_SCRIPT), str(self.config.fixture_path)],
                text=True,
                capture_output=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired):
            return _tool_missing_manifest("error")

        if proc.returncode != 0 or not self.graph_path.exists():
            return {
                "cold_index_ms": int((time.monotonic() - started) * 1000),
                "manifest": _tool_missing_manifest("error")["manifest"],
            }

        return {
            "cold_index_ms": int((time.monotonic() - started) * 1000),
            "manifest": _manifest_from_graph_json(self.graph_path, "tree-sitter"),
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        if not UA_SEARCH_SCRIPT.exists() or not self.graph_path.exists():
            return self.error_response(query_class)

        patterns = _extract_patterns(query)
        search_query = " ".join(patterns) if patterns else query

        try:
            proc = subprocess.run(
                ["node", str(UA_SEARCH_SCRIPT), str(self.config.fixture_path), search_query],
                text=True,
                capture_output=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired):
            return self.error_response(query_class)

        if proc.returncode != 0:
            return self.error_response(query_class)

        results = self._parse_ua_output(proc.stdout)
        return self.normalize_response(results, query_class)

    def _parse_ua_output(self, stdout: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        # Format: [score] type: name — path
        ua_re = re.compile(r"^\[([0-9.]+)\]\s+\w+:\s+(.+?)\s+—\s+(.+)$")
        for line in (stdout or "").splitlines():
            line = line.strip()
            if not line:
                continue
            match = ua_re.match(line)
            if match:
                score = float(match.group(1))
                name = match.group(2).strip()
                file_path = match.group(3).strip()
                rel_path = _relative_to_fixture(file_path, self.config.fixture_path)
                results.append({
                    "file": rel_path,
                    "line_start": 0,
                    "line_end": 0,
                    "content": name,
                    "confidence": score,
                })
        return results


class SerenaAdapter(BaseAdapter):
    name = "serena-lsp"

    def _server_cmd(self) -> List[str]:
        return [
            "python3",
            str(SERENA_MCP_SERVER),
            "start-mcp-server",
            "--project",
            str(self.config.fixture_path),
            "--transport",
            "stdio",
        ]

    def prepare(self) -> Dict[str, Any]:
        if not SERENA_MCP_SERVER.exists() or not MCP_PROBE.exists():
            return _tool_missing_manifest("tool_missing")

        started = time.monotonic()
        try:
            output = _mcp_probe_list(self._server_cmd(), timeout=60)
        except Exception:
            return _tool_missing_manifest("error")

        return {
            "cold_index_ms": int((time.monotonic() - started) * 1000),
            "manifest": {
                "node_count": 0,
                "edge_types": ["definitions", "references", "diagnostics"],
                "index_mode": "lsp" if "find_symbol" in output else "error",
                "built_at": _now_iso(),
            },
        }

    def search(self, query: str, query_class: str) -> Dict[str, Any]:
        if not SERENA_MCP_SERVER.exists() or not MCP_PROBE.exists():
            return self.error_response(query_class)

        symbol = _extract_symbol(query)
        relative_path = _extract_relative_path(query, self.config.fixture_path)

        try:
            if query_class in {"callers", "change_impact"}:
                symbol_info = self._resolve_symbol(symbol, relative_path)
                if not symbol_info.get("relative_path"):
                    return self.error_response(query_class)

                payload = _mcp_probe_call(
                    "find_referencing_symbols",
                    {
                        "name_path": symbol_info.get("name_path") or symbol,
                        "relative_path": symbol_info["relative_path"],
                        "max_answer_chars": self.config.max_tokens,
                    },
                    self._server_cmd(),
                    timeout=60,
                )
                results = _collect_payload_results(payload, self.config.fixture_path)
                return self.normalize_response(results, query_class)

            if query_class == "dependency_path":
                definition_payload = self._find_symbol_payload(symbol, relative_path, include_body=False, depth=1)
                results = _collect_payload_results(definition_payload, self.config.fixture_path)

                symbol_info = _first_symbol_payload(definition_payload, self.config.fixture_path)
                if symbol_info.get("relative_path"):
                    try:
                        refs_payload = _mcp_probe_call(
                            "find_referencing_symbols",
                            {
                                "name_path": symbol_info.get("name_path") or symbol,
                                "relative_path": symbol_info["relative_path"],
                                "max_answer_chars": self.config.max_tokens,
                            },
                            self._server_cmd(),
                            timeout=60,
                        )
                        results.extend(_collect_payload_results(refs_payload, self.config.fixture_path))
                    except Exception:
                        pass

                return self.normalize_response(_dedupe_results(results), query_class)

            if query_class in {"architecture", "config"}:
                payload = self._find_symbol_payload(symbol, relative_path, include_body=False, depth=1)
                results = _collect_payload_results(payload, self.config.fixture_path)
                return self.normalize_response(results, query_class)

            return self.unsupported_response(query_class)
        except Exception:
            return self.error_response(query_class)

    def _find_symbol_payload(
        self,
        symbol: str,
        relative_path: str,
        include_body: bool = False,
        depth: int = 0,
    ) -> Any:
        return _mcp_probe_call(
            "find_symbol",
            {
                "name_path_pattern": symbol,
                "relative_path": relative_path,
                "include_body": include_body,
                "substring_matching": True,
                "depth": depth,
                "max_matches": self.config.max_results,
                "max_answer_chars": self.config.max_tokens,
            },
            self._server_cmd(),
            timeout=60,
        )

    def _resolve_symbol(self, symbol: str, relative_path: str) -> Dict[str, str]:
        if relative_path:
            return {"name_path": symbol, "relative_path": relative_path}

        payload = self._find_symbol_payload(symbol, "", include_body=False, depth=0)
        resolved = _first_symbol_payload(payload, self.config.fixture_path)
        if resolved:
            return resolved

        return {"name_path": symbol, "relative_path": relative_path}


def make_adapter(backend: str, config: AdapterConfig) -> BaseAdapter:
    if backend == "rg-control":
        return RgAdapter(config)
    if backend == "cm-mcp-full":
        return CodebaseMemoryAdapter(config)
    if backend == "oracle-context":
        return OracleAdapter(config)
    if backend == "graphify":
        return GraphifyAdapter(config)
    if backend == "codegraph":
        return CodegraphAdapter(config)
    if backend == "crg-full":
        return CodeReviewGraphAdapter(config)
    if backend == "ua-tree":
        return UnderstandAnythingAdapter(config)
    if backend == "serena-lsp":
        return SerenaAdapter(config)
    raise ValueError(f"Unsupported backend: {backend}")
