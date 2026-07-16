#!/usr/bin/env python3
import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Set

Grade = str
StaleCause = str


@dataclass
class GradeResult:
    grade: Grade
    stale_cause: StaleCause
    precision: float
    recall: float
    f1: float
    expected_set: List[str]
    returned_set: List[str]
    missing: List[str]
    extra: List[str]


@dataclass
class PathGradeResult:
    grade: Grade
    stale_cause: StaleCause
    expected_answer: bool
    returned_answer: bool
    evidence_valid: bool


SET_TRUTH: Dict[str, Dict[str, Dict[str, List[str]]]] = {
    "Q2": {
        "clean": {
            "expected": [
                "src/orders/OrderService.ts",
                "src/inventory/InventoryService.ts",
                "src/orders/OrderController.ts",
                "tests/inventory/InventoryService.test.ts",
                "src/fulfillment/FulfillmentPipeline.ts",
            ],
            "stale": [],
        },
        "dirty": {
            "expected": [
                "src/orders/OrderService.ts",
                "src/inventory/InventoryService.ts",
                "src/orders/OrderController.ts",
                "tests/inventory/InventoryService.test.ts",
                "src/fulfillment/FulfillmentPipeline.ts",
                "src/inventory/audit.ts",
            ],
            "stale": [],
        },
    },
    "Q7": {
        "clean": {
            "expected": ["true", "src/orders/OrderService.ts", "src/inventory/InventoryService.ts"],
            "stale": [],
        },
        "dirty": {
            "expected": ["true", "src/orders/OrderService.ts", "src/inventory/InventoryService.ts"],
            "stale": [],
        },
    },
    "Q8": {
        "clean": {
            "expected": ["true", "src/orders/OrderController.ts", "src/inventory/InventoryData.ts"],
            "stale": [],
        },
        "dirty": {
            "expected": ["true", "src/orders/OrderController.ts", "src/inventory/InventoryData.ts"],
            "stale": [],
        },
    },
    "Q9": {
        "clean": {
            "expected": ["src/config/redis.json", "src/config/env.ts", "5000"],
            "stale": [],
        },
        "dirty": {
            "expected": ["src/config/redis.json", "src/config/env.ts", "10000"],
            "stale": ["5000"],
        },
    },
    "Q14": {
        "clean": {
            "expected": [
                "src/orders/shipping.ts",
                "src/orders/OrderService.ts",
                "tests/orders/OrderService.test.ts",
                "src/fulfillment/FulfillmentPipeline.ts",
            ],
            "stale": [],
        },
        "dirty": {
            "expected": [
                "src/orders/logistics.ts",
                "src/orders/shipping.ts",
                "src/orders/OrderService.ts",
                "tests/orders/OrderService.test.ts",
                "src/fulfillment/FulfillmentPipeline.ts",
            ],
            "stale": ["src/orders/shipping.ts"],
        },
    },
}

PATH_TRUTH: Dict[str, Dict[str, Dict[str, Any]]] = {
    "Q3": {
        "clean": {"answer": True, "path": ["OrderController", "OrderService", "NotificationService"]},
        "dirty": {"answer": True, "path": ["OrderController", "OrderService", "NotificationService"]},
    },
    "Q5": {
        "clean": {"answer": False},
        "dirty": {"answer": False},
    },
}

KNOWN_BASENAMES = {
    "OrderService.ts": "src/orders/OrderService.ts",
    "OrderController.ts": "src/orders/OrderController.ts",
    "InventoryService.ts": "src/inventory/InventoryService.ts",
    "InventoryService.test.ts": "tests/inventory/InventoryService.test.ts",
    "InventoryData.ts": "src/inventory/InventoryData.ts",
    "NotificationService.ts": "src/notifications/NotificationService.ts",
    "OrderService.test.ts": "tests/orders/OrderService.test.ts",
    "FulfillmentPipeline.ts": "src/fulfillment/FulfillmentPipeline.ts",
    "audit.ts": "src/inventory/audit.ts",
    "shipping.ts": "src/orders/shipping.ts",
    "logistics.ts": "src/orders/logistics.ts",
    "redis.json": "src/config/redis.json",
    "env.ts": "src/config/env.ts",
}

KNOWN_SYMBOL_FILES = [
    ("OrderController", "src/orders/OrderController.ts"),
    ("OrderService", "src/orders/OrderService.ts"),
    ("InventoryService", "src/inventory/InventoryService.ts"),
    ("InventoryData", "src/inventory/InventoryData.ts"),
    ("NotificationService", "src/notifications/NotificationService.ts"),
    ("FulfillmentPipeline", "src/fulfillment/FulfillmentPipeline.ts"),
    ("InventoryAudit", "src/inventory/audit.ts"),
]

PATH_NODES = [
    "OrderController",
    "OrderService",
    "NotificationService",
    "InventoryData",
    "InventoryService",
]


def normalize_path(value: str) -> str:
    text = str(value).strip().replace("\\", "/")
    text = re.sub(r"^\./", "", text)
    return text


def grade_set_answer(
    returned: List[str],
    expected: List[str],
    stale_indicators: List[str],
    state: str,
) -> GradeResult:
    normalized_returned = [normalize_path(item) for item in returned]
    normalized_expected = [normalize_path(item) for item in expected]
    normalized_stale = [normalize_path(item) for item in stale_indicators]

    returned_set = set(normalized_returned)
    expected_set = set(normalized_expected)
    stale_set = set(normalized_stale)

    intersection = returned_set & expected_set
    missing = [item for item in normalized_expected if item not in returned_set]
    extra = [item for item in normalized_returned if item not in expected_set]

    precision = len(intersection) / len(returned_set) if returned_set else 0.0
    recall = len(intersection) / len(expected_set) if expected_set else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if precision + recall > 0 else 0.0

    returned_stale = any(item in stale_set for item in returned_set)
    missing_fresh = [item for item in missing if item not in stale_set]
    ambiguity = len(expected_set) >= 3 and len(intersection) == 1

    stale_cause: StaleCause = "fresh"
    if state != "clean" and returned_stale and missing_fresh:
        grade = "CRITICAL_STALE"
        stale_cause = detect_stale_cause(normalized_returned, normalized_expected, normalized_stale)
    elif ambiguity:
        grade = "PARTIAL_AMBIGUITY"
    elif f1 >= 0.9:
        grade = "PASS"
    elif f1 >= 0.5:
        grade = "PARTIAL"
    else:
        grade = "FAIL"

    return GradeResult(
        grade=grade,
        stale_cause=stale_cause,
        precision=precision,
        recall=recall,
        f1=f1,
        expected_set=normalized_expected,
        returned_set=normalized_returned,
        missing=missing,
        extra=extra,
    )


def detect_stale_cause(returned: List[str], expected: List[str], stale: List[str]) -> StaleCause:
    lowered_stale = [item.lower() for item in stale]
    if any("shipping" in item for item in lowered_stale):
        return "stale:moved"
    if any("5000" in item for item in lowered_stale):
        return "stale:old-value"
    missing = [item for item in expected if item not in returned]
    if any("audit" in item.lower() for item in missing):
        return "stale:missing-new"
    return "stale:wrong-graph"


def grade_path_answer(
    returned: Dict[str, Any],
    expected: Dict[str, Any],
    state: str,
) -> PathGradeResult:
    returned_answer = bool(returned.get("answer"))
    expected_answer = bool(expected.get("answer"))
    answers_match = returned_answer == expected_answer

    if not answers_match:
        if returned_answer is True and expected_answer is False:
            return PathGradeResult(
                grade="FALSE_POSITIVE",
                stale_cause="fresh",
                expected_answer=expected_answer,
                returned_answer=returned_answer,
                evidence_valid=False,
            )
        return PathGradeResult(
            grade="FAIL",
            stale_cause="not-applicable" if state == "clean" else "fresh",
            expected_answer=expected_answer,
            returned_answer=returned_answer,
            evidence_valid=False,
        )

    evidence_valid = True
    if expected_answer and expected.get("path"):
        expected_nodes = [node.lower() for node in expected["path"]]
        evidence_text = " ".join(str(item) for item in returned.get("evidence", [])).lower()
        evidence_valid = any(node.lower() in evidence_text for node in expected_nodes)

    return PathGradeResult(
        grade="PASS" if answers_match and evidence_valid else "PARTIAL",
        stale_cause="not-applicable",
        expected_answer=expected_answer,
        returned_answer=returned_answer,
        evidence_valid=evidence_valid,
    )


def tag_stale_cause(
    query_id: str,
    state: str,
    returned_files: List[str],
    returned_values: List[str],
) -> StaleCause:
    if state == "clean":
        return "not-applicable"

    returned = [item.lower() for item in returned_files + returned_values]

    if query_id == "Q14" and state == "dirty":
        has_stale = any("src/orders/shipping.ts" in item for item in returned)
        missing_fresh = not any("src/orders/logistics.ts" in item for item in returned)
        if has_stale and missing_fresh:
            return "stale:moved"
        return "fresh"

    if query_id == "Q2" and state == "dirty":
        missing_new = not any("src/inventory/audit.ts" in item for item in returned)
        if missing_new:
            return "stale:missing-new"
        return "fresh"

    if query_id == "Q9" and state == "dirty":
        if any("5000" in item for item in returned):
            return "stale:old-value"
        return "fresh"

    return "not-applicable"


def collect_strings(value: Any, acc: Optional[List[str]] = None) -> List[str]:
    if acc is None:
        acc = []

    if value is None:
        return acc

    if isinstance(value, (str, int, float, bool)):
        acc.append(str(value))
        return acc

    if isinstance(value, list):
        for item in value:
            collect_strings(item, acc)
        return acc

    if isinstance(value, dict):
        for key, child in value.items():
            acc.append(str(key))
            collect_strings(child, acc)

    return acc


def add_path_matches(text: str, returned: Set[str]) -> None:
    for match in re.findall(r"(?:src|tests)/[A-Za-z0-9_./-]+\.(?:ts|json)", text):
        returned.add(match.lstrip("./"))

    lowered = text.lower()
    for basename, path in KNOWN_BASENAMES.items():
        if basename.lower() in lowered:
            returned.add(path)


def add_symbol_matches(text: str, returned: Set[str]) -> None:
    for symbol, path in KNOWN_SYMBOL_FILES:
        if re.search(rf"\b{re.escape(symbol)}\b", text, re.IGNORECASE):
            returned.add(path)


def returned_set(solution: Any, query_id: str) -> List[str]:
    strings = collect_strings(solution)
    returned: Set[str] = set()

    for text in strings:
        add_path_matches(text, returned)

        if query_id in {"Q2", "Q7", "Q8", "Q14"}:
            add_symbol_matches(text, returned)

        if query_id in {"Q7", "Q8"}:
            if re.search(r"\b(true|yes)\b", text, re.IGNORECASE):
                returned.add("true")
            if re.search(r"\b(false|no)\b", text, re.IGNORECASE):
                returned.add("false")

        if query_id == "Q9":
            if re.search(r"\b5000\b", text):
                returned.add("5000")
            if re.search(r"\b10000\b", text):
                returned.add("10000")

    return list(returned)


def path_answer(solution: Any) -> Dict[str, Any]:
    strings = collect_strings(solution)
    answer: Optional[bool] = None

    if isinstance(solution, dict) and isinstance(solution.get("answer"), bool):
        answer = solution["answer"]

    for text in strings:
        if answer is None and re.search(r"\b(true|yes)\b", text, re.IGNORECASE):
            answer = True
        if answer is None and re.search(r"\b(false|no)\b", text, re.IGNORECASE):
            answer = False

    evidence: Set[str] = set()
    for text in strings:
        for node in PATH_NODES:
            if re.search(rf"\b{re.escape(node)}\b", text, re.IGNORECASE):
                evidence.add(node)

    return {"has_answer": answer is not None, "answer": bool(answer), "evidence": list(evidence)}


def score_for_grade(grade: Grade) -> float:
    if grade == "PASS":
        return 1.0
    if grade in {"PARTIAL", "PARTIAL_AMBIGUITY"}:
        return 0.5
    return 0.0


def fail(stale_cause: StaleCause = "not-applicable") -> Dict[str, Any]:
    return {
        "grade": "FAIL",
        "stale_cause": stale_cause,
        "f1": 0,
        "precision": 0,
        "recall": 0,
    }


def _compact_set_grade(result: GradeResult) -> Dict[str, Any]:
    return {
        "grade": result.grade,
        "stale_cause": result.stale_cause,
        "f1": result.f1,
        "precision": result.precision,
        "recall": result.recall,
    }


def grade_set(query_id: str, state: str, solution: Any) -> Dict[str, Any]:
    truth = SET_TRUTH.get(query_id, {}).get(state)
    if not truth:
        return fail()

    returned = returned_set(solution, query_id)
    result = grade_set_answer(returned, truth["expected"], truth["stale"], state)

    returned_files = [
        item for item in returned if item.startswith("src/") or item.startswith("tests/")
    ]
    returned_values = [
        item for item in returned if not item.startswith("src/") and not item.startswith("tests/")
    ]
    stale_tag = tag_stale_cause(query_id, state, returned_files, returned_values)

    if stale_tag not in {"fresh", "not-applicable"}:
        result.stale_cause = stale_tag

    if query_id == "Q9" and state == "dirty" and stale_tag == "stale:old-value" and result.grade != "PASS":
        result.grade = "CRITICAL_STALE"

    if query_id == "Q14" and state == "dirty" and stale_tag == "stale:moved":
        result.grade = "CRITICAL_STALE"

    return _compact_set_grade(result)


def grade_path(query_id: str, state: str, solution: Any) -> Dict[str, Any]:
    truth = PATH_TRUTH.get(query_id, {}).get(state)
    if not truth:
        return fail()

    returned = path_answer(solution)
    if not returned["has_answer"]:
        return fail("not-applicable" if state == "clean" else "fresh")

    result = grade_path_answer(
        {"answer": returned["answer"], "evidence": returned["evidence"]},
        truth,
        state,
    )
    score = score_for_grade(result.grade)

    return {
        "grade": result.grade,
        "stale_cause": result.stale_cause,
        "f1": score,
        "precision": score,
        "recall": score,
    }


def grade_cell(query_id: str, state: str, solution: Any) -> Dict[str, Any]:
    try:
        if query_id in SET_TRUTH:
            return grade_set(query_id, state, solution)
        if query_id in PATH_TRUTH:
            return grade_path(query_id, state, solution)
        return fail()
    except Exception:
        return fail()
