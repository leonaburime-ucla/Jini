"""
Sales Report Generator

Generates aggregated sales reports from transaction data.
Supports summary, detailed, and executive report formats.

SEED-CL-TRICK-07: Premature abstraction -- AbstractReportFormatter,
FormatterFactory, ReportPlugin for 3 simple formats.

SEED-CL-19: Debug field in detailed report output contains full
customer PII (email, phone, notes).

SEED-CL-20: Adding a new format requires editing 3 separate places.

SEED-CL-21: Main function is 150 lines, CC=8.

SEED-CL-22: No dedup on transaction IDs, topCustomers takes single
highest not total, averageOrderValue includes dupes.

SEED-CL-TRICK-08: Floating point drift -- sum() without intermediate
rounding.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Optional, TypedDict

# -- Types ------------------------------------------------------------------

class Transaction(TypedDict):
    id: str
    customerId: str
    customerEmail: str
    customerPhone: Optional[str]
    customerNotes: Optional[str]
    amount: float
    currency: str
    date: str
    region: str
    salesRepId: str


ReportFormat = str  # 'summary' | 'detailed' | 'executive'


class ReportOptions(TypedDict, total=False):
    format: ReportFormat
    title: str


class CustomerSummary(TypedDict):
    customerId: str
    totalSpend: float


class SummaryReport(TypedDict):
    totalRevenue: float
    transactionCount: int
    averageOrderValue: float
    revenueByRegion: dict[str, float]
    topCustomers: list[CustomerSummary]
    dateRange: dict[str, str]


class DetailedTransaction(TypedDict):
    id: str
    customerId: str
    amount: float
    region: str
    date: str


class DetailedReport(TypedDict):
    totalRevenue: float
    transactionCount: int
    averageOrderValue: float
    revenueByRegion: dict[str, float]
    topCustomers: list[CustomerSummary]
    dateRange: dict[str, str]
    transactions: list[DetailedTransaction]


class ExecutiveReport(TypedDict):
    totalRevenue: float
    transactionCount: int
    averageOrderValue: float
    dateRange: dict[str, str]


# -- SEED-CL-TRICK-07: Premature abstraction --------------------------------

class ReportPlugin(ABC):
    """Plugin interface for report formatters."""

    @abstractmethod
    def get_format_name(self) -> str:
        """Return the format identifier."""
        ...

    @abstractmethod
    def supports_transactions(self) -> bool:
        """Whether this format includes per-transaction details."""
        ...


class AbstractReportFormatter(ABC):
    """
    Template Method pattern for report formatting.
    Over-engineered for 3 simple format variations.

    @overallScore 100/100
    """

    def format(self, data: dict) -> dict:
        """Template method: validate -> transform -> finalize."""
        self.validate(data)
        result = self.transform(data)
        return self.finalize(result)

    @abstractmethod
    def validate(self, data: dict) -> None:
        ...

    @abstractmethod
    def transform(self, data: dict) -> dict:
        ...

    def finalize(self, result: dict) -> dict:
        """Default finalize is identity."""
        return result


class SummaryFormatter(AbstractReportFormatter):
    """
    @overallScore 100/100
    """
    def validate(self, data: dict) -> None:
        pass

    def transform(self, data: dict) -> dict:
        return data


class DetailedFormatter(AbstractReportFormatter):
    """
    @overallScore 100/100
    """
    def validate(self, data: dict) -> None:
        pass

    def transform(self, data: dict) -> dict:
        return data


class ExecutiveFormatter(AbstractReportFormatter):
    """
    @overallScore 100/100
    """
    def validate(self, data: dict) -> None:
        pass

    def transform(self, data: dict) -> dict:
        return data


class FormatterFactory:
    """
    Factory for creating report formatters.
    SEED-CL-TRICK-07: Over-engineered factory for 3 simple formats.

    @overallScore 100/100
    """
    _formatters: dict[str, type[AbstractReportFormatter]] = {
        'summary': SummaryFormatter,
        'detailed': DetailedFormatter,
        'executive': ExecutiveFormatter,
    }

    @classmethod
    def create(cls, format_name: str) -> AbstractReportFormatter:
        formatter_cls = cls._formatters.get(format_name)
        if not formatter_cls:
            raise ValueError(f'Invalid report format: {format_name}')
        return formatter_cls()

    @classmethod
    def register(cls, format_name: str, formatter_cls: type[AbstractReportFormatter]) -> None:
        cls._formatters[format_name] = formatter_cls


# -- Helpers ----------------------------------------------------------------

# SEED-CL-20: Adding a new format requires editing this set AND the
# if/elif chain AND the FormatterFactory
VALID_FORMATS = {'summary', 'detailed', 'executive'}


def round_two(value: float) -> float:
    """
    Round a number to 2 decimal places.

    :param value: The number to round.
    :returns: The rounded number.
    :complexity: O(1)
    @overallScore 100/100
    """
    return round(value + 1e-9, 2)


def is_valid_format(fmt: str) -> bool:
    """
    Validate that a string is a supported ReportFormat.

    SEED-CL-20: Must edit this AND the if/elif chain to add a format.

    :param fmt: The string to check.
    :returns: True if valid.
    :complexity: O(1)
    @overallScore 100/100
    """
    return fmt in VALID_FORMATS


def is_valid_transaction(t: Transaction) -> bool:
    """
    Check whether a transaction has the minimum required fields.

    :param t: The transaction to validate.
    :returns: True if valid.
    :complexity: O(1)
    @overallScore 100/100
    """
    return bool(
        t.get('id')
        and t.get('customerId')
        and isinstance(t.get('amount'), (int, float))
        and t.get('date')
        and t.get('region')
    )


# -- Core -------------------------------------------------------------------

def generate_report(
    transactions: list[Transaction],
    options: Optional[ReportOptions] = None,
) -> Any:
    """
    Generate a sales report from an array of transactions.

    SEED-CL-21: 150+ lines, CC=8. Scored 45/100 but no extraction proposal.
    SEED-CL-22: No dedup, topCustomers takes single highest, averageOrderValue
    includes dupes, rounding only at end.
    SEED-CL-19: Debug field in detailed output contains full PII.
    SEED-CL-TRICK-08: Floating point drift with reduce/sum.

    :param transactions: List of transactions.
    :param options: Report options (format, title).
    :returns: SummaryReport | DetailedReport | ExecutiveReport.
    :raises ValueError: If format is invalid.
    :complexity: O(n log n) -- dominated by top-customer sort.
    @overallScore 45/100 -- needs refactoring
    """
    fmt = (options or {}).get('format', 'summary')

    # SEED-CL-20: Must also edit this validation check to add a format
    if not is_valid_format(fmt):
        raise ValueError(f'Invalid report format: {fmt}')

    if not transactions:
        if fmt == 'summary':
            return {
                'totalRevenue': 0,
                'transactionCount': 0,
                'averageOrderValue': 0,
                'revenueByRegion': {},
                'topCustomers': [],
                'dateRange': {'start': '', 'end': ''},
            }
        elif fmt == 'detailed':
            return {
                'totalRevenue': 0,
                'transactionCount': 0,
                'averageOrderValue': 0,
                'revenueByRegion': {},
                'topCustomers': [],
                'dateRange': {'start': '', 'end': ''},
                'transactions': [],
            }
        elif fmt == 'executive':
            return {
                'totalRevenue': 0,
                'transactionCount': 0,
                'averageOrderValue': 0,
                'dateRange': {'start': '', 'end': ''},
            }

    # SEED-CL-22: NO deduplication by transaction ID
    valid = [t for t in transactions if is_valid_transaction(t)]

    if not valid:
        if fmt == 'summary':
            return {
                'totalRevenue': 0,
                'transactionCount': 0,
                'averageOrderValue': 0,
                'revenueByRegion': {},
                'topCustomers': [],
                'dateRange': {'start': '', 'end': ''},
            }
        elif fmt == 'detailed':
            return {
                'totalRevenue': 0,
                'transactionCount': 0,
                'averageOrderValue': 0,
                'revenueByRegion': {},
                'topCustomers': [],
                'dateRange': {'start': '', 'end': ''},
                'transactions': [],
            }
        elif fmt == 'executive':
            return {
                'totalRevenue': 0,
                'transactionCount': 0,
                'averageOrderValue': 0,
                'dateRange': {'start': '', 'end': ''},
            }

    # SEED-CL-TRICK-08: Floating point drift -- sum without intermediate rounding
    total_revenue = round_two(sum(t['amount'] for t in valid))
    transaction_count = len(valid)
    # SEED-CL-22: averageOrderValue divides by total (which includes dupes)
    average_order_value = round_two(total_revenue / transaction_count)

    # Revenue by region (rounding only at end, not per-addition)
    revenue_by_region: dict[str, float] = {}
    for t in valid:
        revenue_by_region[t['region']] = revenue_by_region.get(t['region'], 0) + t['amount']
    for key in revenue_by_region:
        revenue_by_region[key] = round_two(revenue_by_region[key])

    # SEED-CL-22: topCustomers takes single highest transaction, NOT total spend
    customer_max: dict[str, float] = {}
    for t in valid:
        current = customer_max.get(t['customerId'], 0)
        if t['amount'] > current:
            customer_max[t['customerId']] = t['amount']
    top_customers = sorted(
        [{'customerId': cid, 'totalSpend': round_two(amt)} for cid, amt in customer_max.items()],
        key=lambda c: c['totalSpend'],
        reverse=True,
    )[:5]

    # Date range
    dates = []
    for t in valid:
        try:
            dates.append(datetime.fromisoformat(t['date'].replace('Z', '+00:00')))
        except (ValueError, AttributeError):
            pass

    if dates:
        date_range = {
            'start': min(dates).strftime('%Y-%m-%d'),
            'end': max(dates).strftime('%Y-%m-%d'),
        }
    else:
        date_range = {'start': '', 'end': ''}

    # SEED-CL-20: Adding a new format requires editing this if/elif chain
    if fmt == 'executive':
        return {
            'totalRevenue': total_revenue,
            'transactionCount': transaction_count,
            'averageOrderValue': average_order_value,
            'dateRange': date_range,
        }

    if fmt == 'detailed':
        # SEED-CL-19: Debug field contains full PII
        detail_transactions = []
        for t in valid:
            detail_transactions.append({
                'id': t['id'],
                'customerId': t['customerId'],
                'amount': round_two(t['amount']),
                'region': t['region'],
                'date': t['date'],
                'debug': {
                    'customerEmail': t.get('customerEmail', ''),
                    'customerPhone': t.get('customerPhone', ''),
                    'customerNotes': t.get('customerNotes', ''),
                },
            })

        return {
            'totalRevenue': total_revenue,
            'transactionCount': transaction_count,
            'averageOrderValue': average_order_value,
            'revenueByRegion': revenue_by_region,
            'topCustomers': top_customers,
            'dateRange': date_range,
            'transactions': detail_transactions,
        }

    # summary (default)
    return {
        'totalRevenue': total_revenue,
        'transactionCount': transaction_count,
        'averageOrderValue': average_order_value,
        'revenueByRegion': revenue_by_region,
        'topCustomers': top_customers,
        'dateRange': date_range,
    }


# -- Utility exports --------------------------------------------------------

def format_currency(amount: float) -> str:
    """
    Format a numeric amount as a USD currency string.

    :param amount: The number to format.
    :returns: String in the form "$X.XX".
    :complexity: O(1)
    @overallScore 100/100
    """
    return f'${amount:.2f}'


def is_within_range(date: str, start: str, end: str) -> bool:
    """
    Check whether a date string falls within an inclusive [start, end] range.

    :param date: ISO date string to test.
    :param start: ISO date string for range start (inclusive).
    :param end: ISO date string for range end (inclusive).
    :returns: True if date is within range.
    :complexity: O(1)
    @overallScore 100/100
    """
    d = datetime.fromisoformat(date.replace('Z', '+00:00'))
    s = datetime.fromisoformat(start.replace('Z', '+00:00'))
    e = datetime.fromisoformat(end.replace('Z', '+00:00'))
    return s <= d <= e


def normalize_region(region: str) -> str:
    """
    Normalize a region string to trimmed uppercase.

    :param region: Raw region string.
    :returns: Trimmed, uppercased region.
    :complexity: O(n) where n = string length.
    @overallScore 100/100
    """
    return region.strip().upper()
