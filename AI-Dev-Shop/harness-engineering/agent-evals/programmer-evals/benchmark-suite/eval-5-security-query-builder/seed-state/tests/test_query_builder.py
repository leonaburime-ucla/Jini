"""Tests for the secure search query builder."""

import re
import pytest
from unittest.mock import patch

from src.query_builder import build_search_query, ValidationError


# Suppress print() during tests (except PII tests which manage their own mock)
@pytest.fixture(autouse=True)
def _suppress_print(monkeypatch):
    monkeypatch.setattr("builtins.print", lambda *a, **kw: None)


# -- Helpers -----------------------------------------------------------------

def default_input(overrides=None):
    base = {"query_text": "", "filters": {}}
    if overrides:
        base.update(overrides)
    return base


def default_options(overrides=None):
    base = {
        "pagination": {"page": 1, "page_size": 20},
        "sort": {"field": "created_at", "direction": "ASC"},
    }
    if overrides:
        base.update(overrides)
    return base


# -- Basic query building ----------------------------------------------------

class TestBuildSearchQueryBasic:
    def test_returns_well_formed_result_shape(self):
        result = build_search_query(default_input(), default_options())
        assert "sql" in result
        assert "params" in result
        assert "total_count_sql" in result
        assert "total_count_params" in result

    def test_produces_a_select_from_documents_with_order_by_limit_offset(self):
        result = build_search_query(default_input(), default_options())
        assert re.match(
            r"^SELECT \* FROM documents\s+ORDER BY created_at ASC LIMIT \$1 OFFSET \$2$",
            result["sql"],
        )
        assert result["params"] == [20, 0]

    def test_produces_a_count_query_without_limit_offset(self):
        result = build_search_query(default_input(), default_options())
        assert result["total_count_sql"] == "SELECT COUNT(*) FROM documents "
        assert result["total_count_params"] == []


# -- Text search -------------------------------------------------------------

class TestBuildSearchQueryTextSearch:
    def test_adds_ilike_conditions_for_query_text(self):
        result = build_search_query(
            default_input({"query_text": "hello"}),
            default_options(),
        )
        assert "title ILIKE $1" in result["sql"]
        assert "content ILIKE $2" in result["sql"]
        assert result["params"][0] == "%hello%"
        assert result["params"][1] == "%hello%"

    def test_uses_separate_param_indices_for_title_and_content_ilike(self):
        result = build_search_query(
            default_input({"query_text": "test"}),
            default_options(),
        )
        # title ILIKE $1 OR content ILIKE $2 -- two distinct indices
        assert "$1" in result["sql"]
        assert "$2" in result["sql"]

    def test_skips_text_search_when_query_text_is_empty(self):
        result = build_search_query(default_input(), default_options())
        assert "ILIKE" not in result["sql"]


# -- Filters -----------------------------------------------------------------

class TestBuildSearchQueryFilters:
    def test_adds_status_filter(self):
        result = build_search_query(
            default_input({"filters": {"status": "published"}}),
            default_options(),
        )
        assert "status = $1" in result["sql"]
        assert "published" in result["params"]

    def test_adds_author_filter(self):
        result = build_search_query(
            default_input({"filters": {"author": "alice"}}),
            default_options(),
        )
        assert "author = $1" in result["sql"]
        assert "alice" in result["params"]

    def test_adds_date_range_filter_with_between(self):
        result = build_search_query(
            default_input(
                {"filters": {"date_range": {"start": "2026-01-01", "end": "2026-12-31"}}}
            ),
            default_options(),
        )
        assert "BETWEEN $1 AND $2" in result["sql"]
        assert "2026-01-01" in result["params"]
        assert "2026-12-31" in result["params"]

    def test_adds_tags_filter_with_in_clause(self):
        result = build_search_query(
            default_input({"filters": {"tags": ["finance", "legal"]}}),
            default_options(),
        )
        assert "tags IN ($1, $2)" in result["sql"]
        assert "finance" in result["params"]
        assert "legal" in result["params"]

    def test_skips_tags_filter_when_tags_array_is_empty(self):
        result = build_search_query(
            default_input({"filters": {"tags": []}}),
            default_options(),
        )
        assert "tags" not in result["sql"]

    def test_combines_all_filters_correctly(self):
        result = build_search_query(
            default_input(
                {
                    "query_text": "report",
                    "filters": {
                        "status": "draft",
                        "author": "bob",
                        "date_range": {"start": "2026-01-01", "end": "2026-06-30"},
                        "tags": ["hr"],
                    },
                }
            ),
            default_options(),
        )
        assert "ILIKE" in result["sql"]
        assert "status =" in result["sql"]
        assert "author =" in result["sql"]
        assert "BETWEEN" in result["sql"]
        assert "tags IN" in result["sql"]
        # All conditions joined with AND
        where_match = re.search(r"WHERE (.+?) ORDER", result["sql"])
        assert where_match is not None
        and_count = where_match.group(1).count(" AND ")
        # 5 conditions = 4 ANDs, plus 1 AND inside BETWEEN clause = 5 total
        assert and_count == 5


# -- Pagination --------------------------------------------------------------

class TestBuildSearchQueryPagination:
    def test_applies_default_pagination_when_omitted(self):
        result = build_search_query(default_input())
        assert 20 in result["params"]  # default page_size
        assert 0 in result["params"]  # offset for page 1

    def test_calculates_offset_correctly_for_page_3_page_size_10(self):
        result = build_search_query(
            default_input(), {"pagination": {"page": 3, "page_size": 10}}
        )
        assert 10 in result["params"]
        assert 20 in result["params"]  # (3-1) * 10

    def test_rejects_page_less_than_1(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(), {"pagination": {"page": 0, "page_size": 20}}
            )

    def test_rejects_negative_page(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(), {"pagination": {"page": -5, "page_size": 20}}
            )

    def test_rejects_page_size_greater_than_100(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(), {"pagination": {"page": 1, "page_size": 101}}
            )

    def test_rejects_page_size_zero(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(), {"pagination": {"page": 1, "page_size": 0}}
            )

    def test_rejects_non_integer_page(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(), {"pagination": {"page": 1.5, "page_size": 20}}
            )

    def test_rejects_non_integer_page_size(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(), {"pagination": {"page": 1, "page_size": 20.5}}
            )

    def test_allows_page_size_100_boundary(self):
        result = build_search_query(
            default_input(), {"pagination": {"page": 1, "page_size": 100}}
        )
        assert 100 in result["params"]

    def test_allows_page_size_1_boundary(self):
        result = build_search_query(
            default_input(), {"pagination": {"page": 1, "page_size": 1}}
        )
        assert 1 in result["params"]


# -- Sort validation ---------------------------------------------------------

class TestBuildSearchQuerySort:
    @pytest.mark.parametrize("field", ["title", "created_at", "updated_at", "author"])
    def test_allows_valid_sort_field(self, field):
        result = build_search_query(
            default_input(), {"sort": {"field": field, "direction": "ASC"}}
        )
        assert f"ORDER BY {field} ASC" in result["sql"]

    def test_allows_desc_direction(self):
        result = build_search_query(
            default_input(), {"sort": {"field": "title", "direction": "DESC"}}
        )
        assert "ORDER BY title DESC" in result["sql"]

    def test_normalises_direction_case_lowercase_input(self):
        result = build_search_query(
            default_input(), {"sort": {"field": "title", "direction": "desc"}}
        )
        assert "ORDER BY title DESC" in result["sql"]

    def test_rejects_invalid_sort_field(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(),
                {"sort": {"field": "DROP TABLE documents;--", "direction": "ASC"}},
            )

    def test_rejects_invalid_sort_direction(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(),
                {"sort": {"field": "title", "direction": "SIDEWAYS"}},
            )

    def test_applies_defaults_when_sort_is_omitted(self):
        result = build_search_query(default_input())
        assert "ORDER BY created_at ASC" in result["sql"]


# -- SQL injection prevention (adversarial) ----------------------------------

class TestSQLInjectionPrevention:
    def test_parameterizes_query_text_never_interpolated(self):
        malicious = "'; DROP TABLE documents; --"
        result = build_search_query(
            default_input({"query_text": malicious}),
            default_options(),
        )
        # The malicious string should be in params, not in the SQL
        assert malicious not in result["sql"]
        assert f"%{malicious}%" in result["params"]

    def test_parameterizes_status_filter(self):
        malicious = "' OR 1=1; --"
        result = build_search_query(
            default_input({"filters": {"status": malicious}}),
            default_options(),
        )
        assert malicious not in result["sql"]
        assert malicious in result["params"]

    def test_parameterizes_author_filter(self):
        malicious = "admin'--"
        result = build_search_query(
            default_input({"filters": {"author": malicious}}),
            default_options(),
        )
        assert malicious not in result["sql"]
        assert malicious in result["params"]

    def test_parameterizes_tags(self):
        malicious = ["'; DELETE FROM documents; --", "normal"]
        result = build_search_query(
            default_input({"filters": {"tags": malicious}}),
            default_options(),
        )
        assert malicious[0] not in result["sql"]
        assert malicious[0] in result["params"]

    def test_rejects_sort_field_injection_attempt(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(),
                {"sort": {"field": "1; DROP TABLE documents;--", "direction": "ASC"}},
            )

    def test_rejects_sort_direction_injection_attempt(self):
        with pytest.raises(ValidationError):
            build_search_query(
                default_input(),
                {"sort": {"field": "title", "direction": "ASC; DROP TABLE documents;--"}},
            )

    def test_parameterizes_date_range_values(self):
        malicious = "2026-01-01'; DROP TABLE documents;--"
        result = build_search_query(
            default_input(
                {"filters": {"date_range": {"start": malicious, "end": "2026-12-31"}}}
            ),
            default_options(),
        )
        assert malicious not in result["sql"]
        assert malicious in result["params"]


# -- PII logging safety ------------------------------------------------------

class TestPIISafeLogging:
    def test_logs_query_length_not_query_text(self):
        secret = "my-secret-medical-records"
        log_output = []

        def capture_print(*args, **kwargs):
            log_output.append(" ".join(str(a) for a in args))

        with patch("builtins.print", side_effect=capture_print):
            build_search_query(
                default_input({"query_text": secret}),
                default_options(),
            )

        log_line = log_output[0] if log_output else ""
        assert secret not in log_line
        assert f"queryLength={len(secret)}" in log_line

    def test_logs_filter_count_not_filter_values(self):
        log_output = []

        def capture_print(*args, **kwargs):
            log_output.append(" ".join(str(a) for a in args))

        with patch("builtins.print", side_effect=capture_print):
            build_search_query(
                default_input(
                    {"filters": {"status": "classified", "author": "secret-agent"}}
                ),
                default_options(),
            )

        log_line = log_output[0] if log_output else ""
        assert "classified" not in log_line
        assert "secret-agent" not in log_line
        assert "filterCount=2" in log_line

    def test_logs_page_and_page_size(self):
        log_output = []

        def capture_print(*args, **kwargs):
            log_output.append(" ".join(str(a) for a in args))

        with patch("builtins.print", side_effect=capture_print):
            build_search_query(
                default_input(), {"pagination": {"page": 5, "page_size": 25}}
            )

        log_line = log_output[0] if log_output else ""
        assert "page=5" in log_line
        assert "pageSize=25" in log_line


# -- Count query correctness ------------------------------------------------

class TestTotalCountQuery:
    def test_shares_where_params_but_not_limit_offset_params(self):
        result = build_search_query(
            default_input({"query_text": "test", "filters": {"status": "active"}}),
            default_options(),
        )
        # total_count_params should have text search params + status param
        # but NOT page_size and offset
        assert len(result["total_count_params"]) == len(result["params"]) - 2
        assert "LIMIT" not in result["total_count_sql"]
        assert "OFFSET" not in result["total_count_sql"]
        assert "COUNT(*)" in result["total_count_sql"]
        assert "WHERE" in result["total_count_sql"]

    def test_count_query_has_no_where_when_no_filters(self):
        result = build_search_query(default_input(), default_options())
        assert "WHERE" not in result["total_count_sql"]
        assert result["total_count_params"] == []


# -- Edge cases --------------------------------------------------------------

class TestEdgeCases:
    def test_handles_empty_filters_object(self):
        result = build_search_query(
            {"query_text": "", "filters": {}}, default_options()
        )
        assert "WHERE" not in result["sql"]

    def test_works_with_no_options_argument_at_all(self):
        result = build_search_query({"query_text": "", "filters": {}})
        assert "ORDER BY created_at ASC" in result["sql"]
        assert 20 in result["params"]  # default page_size

    def test_single_tag_produces_in_clause_with_one_placeholder(self):
        result = build_search_query(
            default_input({"filters": {"tags": ["solo"]}}),
            default_options(),
        )
        assert "tags IN ($1)" in result["sql"]
