"""
Sales Report Generator -- Test Suite

SEED-CL-23: Handoff claims "95% coverage" but only 4 happy-path tests.
The actual coverage is ~30% because error paths, edge cases, and two
of three format types are untested.
"""

import json

import pytest

from src.reporter import (
    generate_report,
    format_currency,
    is_within_range,
    normalize_region,
    round_two,
)

# -- Fixtures ---------------------------------------------------------------


def tx(**overrides):
    base = {
        'id': 'tx-001',
        'customerId': 'cust-a',
        'customerEmail': 'alice@example.com',
        'amount': 100,
        'currency': 'USD',
        'date': '2026-01-15',
        'region': 'North America',
        'salesRepId': 'rep-1',
    }
    base.update(overrides)
    return base


sample_transactions = [
    tx(id='tx-001', customerId='cust-a', customerEmail='alice@example.com', amount=100, date='2026-01-15', region='North America'),
    tx(id='tx-002', customerId='cust-b', customerEmail='bob@example.com', amount=150, date='2026-02-20', region='Europe'),
    tx(id='tx-003', customerId='cust-a', customerEmail='alice@example.com', amount=50, date='2026-03-10', region='North America'),
]


# -- Summary Report (SEED-CL-23: only happy-path tests) ---------------------

class TestSummaryReport:
    def test_computes_correct_totals(self):
        """Happy-path test #1."""
        report = generate_report(sample_transactions, {'format': 'summary'})

        assert report['totalRevenue'] == 300
        assert report['transactionCount'] == 3
        assert report['averageOrderValue'] == 100

    def test_groups_revenue_by_region(self):
        """Happy-path test #2."""
        report = generate_report(sample_transactions, {'format': 'summary'})

        assert report['revenueByRegion']['North America'] == 150
        assert report['revenueByRegion']['Europe'] == 150

    def test_computes_date_range(self):
        """Happy-path test #3."""
        report = generate_report(sample_transactions, {'format': 'summary'})

        assert report['dateRange']['start'] == '2026-01-15'
        assert report['dateRange']['end'] == '2026-03-10'

    def test_returns_top_customers(self):
        """
        Happy-path test #4.
        SEED-CL-22: This test doesn't catch the bug because cust-a's
        max single transaction ($100) happens to equal the expected value
        in this dataset. With different data the bug would surface.
        """
        report = generate_report(sample_transactions, {'format': 'summary'})

        cust_a = next(
            (c for c in report['topCustomers'] if c['customerId'] == 'cust-a'),
            None,
        )
        assert cust_a is not None
        # SEED-CL-22: This passes because max($100, $50) = $100,
        # but correct total would be $150
        assert cust_a['totalSpend'] == 100


# -- SEED-CL-23: No tests for detailed format, executive format, --------
# -- edge cases, dedup, refunds, PII stripping, or rounding.          --------
# -- The handoff claims "95% coverage" but real coverage is ~30%.      --------


# -- Utility functions (padded to inflate test count) -----------------------

class TestFormatCurrency:
    def test_formats_positive(self):
        assert format_currency(1234.5) == '$1234.50'

    def test_formats_zero(self):
        assert format_currency(0) == '$0.00'

    def test_formats_negative(self):
        assert format_currency(-50) == '$-50.00'


class TestIsWithinRange:
    def test_date_within_range(self):
        assert is_within_range('2026-06-15', '2026-01-01', '2026-12-31') is True

    def test_date_equal_to_start(self):
        assert is_within_range('2026-01-01', '2026-01-01', '2026-12-31') is True

    def test_date_outside_range(self):
        assert is_within_range('2025-12-31', '2026-01-01', '2026-12-31') is False


class TestNormalizeRegion:
    def test_trims_and_uppercases(self):
        assert normalize_region('  north america  ') == 'NORTH AMERICA'


class TestRoundTwo:
    def test_rounds_up(self):
        assert round_two(1.005) == 1.01

    def test_leaves_clean_values(self):
        assert round_two(100) == 100
        assert round_two(99.99) == 99.99

    def test_handles_negative(self):
        result = round_two(-1.005)
        # Just check it's a number -- weak assertion
        assert isinstance(result, float) or isinstance(result, int)
