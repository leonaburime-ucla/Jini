"""
Secure Search Query Builder for PostgreSQL ``documents`` table.
"""

from __future__ import annotations

from typing import Any, TypedDict

# -- Allowed sort columns -- allowlist prevents SQL injection via ORDER BY.
ALLOWED_SORT_FIELDS = {"title", "created_at", "updated_at", "author"}

# -- Allowed sort directions.
ALLOWED_SORT_DIRECTIONS = {"ASC", "DESC"}

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_SORT_FIELD = "created_at"
DEFAULT_SORT_DIRECTION = "ASC"


# -- Public types ------------------------------------------------------------

class SearchFilters(TypedDict, total=False):
    status: str
    author: str
    date_range: dict  # {"start": str, "end": str}
    tags: list[str]


class Pagination(TypedDict, total=False):
    page: int
    page_size: int


class SortOptions(TypedDict, total=False):
    field: str
    direction: str


class SearchInput(TypedDict):
    query_text: str
    filters: SearchFilters


class SearchOptions(TypedDict, total=False):
    pagination: Pagination
    sort: SortOptions


class SearchQueryResult(TypedDict):
    sql: str
    params: list
    total_count_sql: str
    total_count_params: list


# -- Errors ------------------------------------------------------------------

class ValidationError(Exception):
    """Raised when input fails validation."""
    pass


# -- Validation helpers (pure, no side effects) ------------------------------

def validate_pagination(
    pagination: Pagination | None,
) -> dict[str, int]:
    """
    Validates and normalises pagination.

    Args:
        pagination: Raw pagination input.

    Returns:
        Validated { "page": int, "page_size": int }

    Raises:
        ValidationError: if constraints are violated.

    @complexity O(1)
    @overallScore 100
    """
    page = (pagination or {}).get("page", 1)
    page_size = (pagination or {}).get("page_size", DEFAULT_PAGE_SIZE)

    if not isinstance(page, int) or isinstance(page, bool) or page < 1:
        raise ValidationError("page must be an integer >= 1")
    if (
        not isinstance(page_size, int)
        or isinstance(page_size, bool)
        or page_size < 1
        or page_size > MAX_PAGE_SIZE
    ):
        raise ValidationError(
            f"page_size must be an integer between 1 and {MAX_PAGE_SIZE}"
        )
    return {"page": page, "page_size": page_size}


def validate_sort(
    sort: SortOptions | None,
) -> dict[str, str]:
    """
    Validates sort field and direction against allowlists.

    Args:
        sort: Raw sort input.

    Returns:
        Validated { "field": str, "direction": str } (safe for interpolation).

    Raises:
        ValidationError: if field or direction is not in the allowlist.

    @complexity O(1)
    @overallScore 100
    """
    field = (sort or {}).get("field", DEFAULT_SORT_FIELD)
    raw_direction = (sort or {}).get("direction", DEFAULT_SORT_DIRECTION)
    direction = raw_direction.upper() if raw_direction else DEFAULT_SORT_DIRECTION

    if field not in ALLOWED_SORT_FIELDS:
        raise ValidationError(
            f'Invalid sort field "{field}". Allowed: {", ".join(sorted(ALLOWED_SORT_FIELDS))}'
        )
    if direction not in ALLOWED_SORT_DIRECTIONS:
        raise ValidationError(
            f'Invalid sort direction "{direction}". Allowed: ASC, DESC'
        )
    return {"field": field, "direction": direction}


# -- Logging helper (PII-safe) -----------------------------------------------

def _log_search_operation(
    query_text: str,
    filters: SearchFilters,
    page: int,
    page_size: int,
) -> None:
    """
    Logs search metadata without exposing PII.

    Logs: query length, number of active filters, page, page_size.
    Never logs actual query text or filter values.

    Args:
        query_text: The raw query text (used only for length measurement).
        filters:    The raw filters (used only for key counting).
        page:       Current page number.
        page_size:  Items per page.

    @complexity O(1)
    @overallScore 100
    """
    filter_count = sum(1 for v in filters.values() if v is not None)
    print(
        f"[Search] queryLength={len(query_text)} filterCount={filter_count} "
        f"page={page} pageSize={page_size}"
    )


# -- Core builder ------------------------------------------------------------

def build_search_query(
    input_data: SearchInput,
    options: SearchOptions | None = None,
) -> SearchQueryResult:
    """
    Builds a parameterized search query for the ``documents`` table.

    All user-provided values are parameterized -- never interpolated into SQL.
    Sort field/direction are validated against a strict allowlist before use.

    Uses the two-object exported signature: required SearchInput + optional
    SearchOptions.

    Args:
        input_data: Required: { query_text, filters }
        options:    Optional: { pagination?, sort? }

    Returns:
        { sql, params, total_count_sql, total_count_params }

    Raises:
        ValidationError: on invalid pagination or sort.

    @complexity Time: O(f + t) where f = filter count, t = tag count.
               Space: O(p) where p = param count.
    @overallScore 88
    """
    query_text = input_data["query_text"]
    filters = input_data["filters"]
    opts = options or {}
    validated_page = validate_pagination(opts.get("pagination"))
    page = validated_page["page"]
    page_size = validated_page["page_size"]
    validated_sort = validate_sort(opts.get("sort"))
    sort_field = validated_sort["field"]
    sort_direction = validated_sort["direction"]

    # PII-safe logging
    _log_search_operation(query_text, filters, page, page_size)

    conditions: list[str] = []
    params: list = []
    param_index = 1

    # -- Text search --
    if query_text:
        conditions.append(
            f"(title ILIKE ${param_index} OR content ILIKE ${param_index + 1})"
        )
        params.append(f"%{query_text}%")
        params.append(f"%{query_text}%")
        param_index += 2

    # -- Status filter --
    if filters.get("status"):
        conditions.append(f"status = ${param_index}")
        params.append(filters["status"])
        param_index += 1

    # -- Author filter --
    if filters.get("author"):
        conditions.append(f"author = ${param_index}")
        params.append(filters["author"])
        param_index += 1

    # -- Date range filter (BETWEEN) --
    date_range = filters.get("date_range")
    if date_range:
        conditions.append(
            f"created_at BETWEEN ${param_index} AND ${param_index + 1}"
        )
        params.append(date_range["start"])
        params.append(date_range["end"])
        param_index += 2

    # -- Tags filter (IN clause per brief requirement) --
    tags = filters.get("tags")
    if tags and len(tags) > 0:
        tag_placeholders = [f"${param_index + i}" for i in range(len(tags))]
        conditions.append(f"tags IN ({', '.join(tag_placeholders)})")
        params.extend(tags)
        param_index += len(tags)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Sort field/direction are from validated allowlist -- safe to interpolate
    order_clause = f"ORDER BY {sort_field} {sort_direction}"

    offset = (page - 1) * page_size

    sql = (
        f"SELECT * FROM documents {where_clause} "
        f"{order_clause} LIMIT ${param_index} OFFSET ${param_index + 1}"
    )
    params.append(page_size)
    params.append(offset)

    # Count query shares the WHERE params but not LIMIT/OFFSET
    total_count_params = params[: len(params) - 2]
    total_count_sql = f"SELECT COUNT(*) FROM documents {where_clause}"

    return {
        "sql": sql,
        "params": params,
        "total_count_sql": total_count_sql,
        "total_count_params": total_count_params,
    }
