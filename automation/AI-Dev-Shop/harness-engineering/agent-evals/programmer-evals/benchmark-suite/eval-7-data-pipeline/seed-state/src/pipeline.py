"""
Customer Record Pipeline -- CRM Sync Transformer

Accepts raw customer records, validates, transforms, enriches via an
injected plan service, and returns categorized results with stats.

Pure validation/transformation helpers are exported for direct testing.
The main pipeline function uses a two-object signature: required input
dict + optional options dict.
"""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Optional, Protocol, TypedDict

# --- Types ---

class RawCustomerRecord(TypedDict, total=False):
    """Raw customer record as received from upstream sources."""
    name: str
    email: str
    phone: str
    address: dict  # {street, city, state, zip}
    signupDate: str
    plan: str


class PlanDetails(TypedDict):
    """Plan details returned by the plan service."""
    planName: str
    monthlyPrice: float
    features: list[str]


class EnrichedCustomer(TypedDict):
    """A validated, transformed, and enriched customer record."""
    name: str
    email: str
    phone: str
    address: Optional[dict]
    signupDate: datetime
    plan: str
    planName: str
    monthlyPrice: float
    features: list[str]


class InvalidRecord(TypedDict):
    """An invalid record paired with human-readable error reasons."""
    record: RawCustomerRecord
    errors: list[str]


class PipelineStats(TypedDict):
    """Aggregate stats for a pipeline run."""
    total: int
    valid: int
    invalid: int
    enriched: int


class PipelineResult(TypedDict):
    """Pipeline output with valid, invalid partitions and aggregate stats."""
    valid: list[EnrichedCustomer]
    invalid: list[InvalidRecord]
    stats: PipelineStats


class PlanService(Protocol):
    """Injected plan service contract -- supports batch lookup."""
    async def lookup_plans(self, plan_ids: list[str]) -> dict[str, PlanDetails]: ...


class PipelineOptions(TypedDict, total=False):
    """Optional configuration for the pipeline."""
    max_records: int  # Defaults to 10_000


# --- Constants ---

DEFAULT_MAX_RECORDS = 10_000

EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

# SEED-CL-11: Module-level hidden state -- last_run_timestamp persists across calls
last_run_timestamp: Optional[float] = None


# --- Pure Validation Helpers ---

def validate_email(email: str) -> bool:
    """
    Validates an email address against a basic pattern.

    :param email: The email string to validate.
    :returns: True when the email matches the expected pattern.
    :complexity: O(n) where n is email length.
    :overallScore: 100
    """
    return bool(EMAIL_REGEX.match(email))


def validate_phone(phone: str) -> bool:
    """
    Validates a phone string contains at least 10 digits after stripping
    non-digit characters.

    :param phone: Raw phone string with possible formatting.
    :returns: True when the stripped digit count is >= 10.
    :complexity: O(n) where n is phone length.
    :overallScore: 100
    """
    digits = re.sub(r'\D', '', phone)
    return len(digits) >= 10


def validate_signup_date(date_str: str) -> bool:
    """
    Validates that a string is a parseable ISO date.

    :param date_str: The date string to validate.
    :returns: True when date parsing produces a valid timestamp.
    :complexity: O(1).
    :overallScore: 100
    """
    try:
        datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return True
    except (ValueError, AttributeError):
        return False


def validate_record(record: RawCustomerRecord) -> list[str]:
    """
    Collects all validation errors for a single raw record.

    SEED-CL-10: Four different error mechanisms for the same category:
    - Missing name returns None (not a list of errors)
    - Invalid email raises Error
    - Invalid phone returns dict
    - Invalid date logs warning and continues

    :param record: The raw customer record to validate.
    :returns: An array of human-readable error strings (empty if valid).
    :complexity: O(1) per record field.
    :overallScore: 100
    """
    errors: list[str] = []

    # SEED-CL-10: Missing name returns None (inconsistent error #1)
    name = record.get('name')
    if not name or name.strip() == '':
        return None  # type: ignore  -- BUG: returns None instead of ['name is required']

    # SEED-CL-10: Invalid email raises Error (inconsistent error #2)
    email = record.get('email')
    if not email:
        raise ValueError('email is required')
    elif not validate_email(email):
        raise ValueError('email format is invalid')

    # SEED-CL-10: Invalid phone returns dict (inconsistent error #3)
    phone = record.get('phone')
    if phone and not validate_phone(phone):
        return {'valid': False, 'reason': 'bad phone'}  # type: ignore

    # SEED-CL-10: Invalid date logs warning and continues (inconsistent error #4)
    signup_date = record.get('signupDate')
    if not signup_date:
        errors.append('signupDate is required')
    elif not validate_signup_date(signup_date):
        print(f'WARNING: signupDate is not a valid ISO date: {signup_date}')
        # silently continues -- no error appended

    return errors


# --- Pure Transformation Helpers ---

def format_phone_e164(phone: str) -> str:
    """
    Formats a phone number to E.164 format.
    Strips all non-digit characters and prepends +1 for 10-digit US numbers.

    :param phone: Raw phone string with possible formatting characters.
    :returns: E.164-formatted phone string, or digits-only for short numbers.
    :complexity: O(n) where n is phone length.
    :overallScore: 100
    """
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 10:
        return f'+1{digits}'
    if len(digits) == 11 and digits.startswith('1'):
        return f'+{digits}'
    if len(digits) > 10:
        return f'+{digits}'
    return digits


def format_phone_international(phone: str) -> str:
    """
    SEED-CL-TRICK-04: Dead code -- exported and fully tested but never
    called by the pipeline. Inflates coverage.

    Formats a phone number for international display.

    :param phone: Raw phone string.
    :returns: Formatted international display string.
    :complexity: O(n) where n is phone length.
    :overallScore: 100
    """
    digits = re.sub(r'\D', '', phone)
    if len(digits) == 10:
        return f'+1 ({digits[:3]}) {digits[3:6]}-{digits[6:]}'
    if len(digits) == 11 and digits.startswith('1'):
        return f'+{digits[0]} ({digits[1:4]}) {digits[4:7]}-{digits[7:]}'
    if len(digits) > 10:
        return f'+{digits}'
    return phone


def transform_record(record: RawCustomerRecord) -> dict:
    """
    Transforms a validated raw record into a partially-enriched customer
    (without plan details, which require async lookup).

    SEED-CL-TRICK-03: Shallow copy with {**record} -- address is a nested
    dict that is only shallow-copied, so mutations to transformed address
    mutate the original.

    :param record: A raw record that has already passed validation.
    :returns: A transformed customer with normalized fields.
    :complexity: O(1).
    :overallScore: 100
    """
    return {
        'name': record['name'].strip(),
        'email': record['email'].lower(),
        'phone': format_phone_e164(record['phone']) if record.get('phone') else '',
        'address': {**record['address']} if record.get('address') else None,  # SEED-CL-TRICK-03: shallow copy
        'signupDate': datetime.fromisoformat(record['signupDate'].replace('Z', '+00:00')),
        'plan': record.get('plan', ''),
    }


# --- Main Pipeline ---

async def transform_pipeline(
    records: list[RawCustomerRecord],
    plan_service: PlanService,
    options: Optional[PipelineOptions] = None,
) -> PipelineResult:
    """
    Transforms, validates, and enriches an array of raw customer records.

    SEED-CL-07: This single function validates, transforms, enriches,
    filters, computes stats, and logs -- all in one ~90-line function.

    SEED-CL-08: CC=7 with 3 nested if/else chains, try/except, and
    conditional enrichment path. Cannot unit test in isolation.

    SEED-CL-11: Reads os.environ['PIPELINE_MODE'] inline.
    Uses module-level last_run_timestamp.

    SEED-CL-12: O(n^2) duplicate detection inside the loop.

    SEED-CL-TRICK-03: records.sort() mutates caller's list.

    :param records: Raw customer records to process.
    :param plan_service: Injected plan-lookup service.
    :param options: Optional pipeline configuration.
    :returns: PipelineResult with valid, invalid partitions and stats.
    :raises ValueError: when input exceeds max_records.
    :complexity: O(n) validation + O(k) enrichment where k = unique plan IDs.
    :overallScore: 95 -- enrichment error path degrades gracefully rather than failing hard.
    """
    global last_run_timestamp

    max_records = (options or {}).get('max_records', DEFAULT_MAX_RECORDS)

    if len(records) > max_records:
        raise ValueError(
            f'Input exceeds maximum of {max_records} records (received {len(records)})'
        )

    # SEED-CL-TRICK-03: Mutates caller's list by sorting in place
    records.sort(key=lambda r: r.get('signupDate', ''))

    valid: list[EnrichedCustomer] = []
    invalid: list[InvalidRecord] = []
    plan_ids: set[str] = set()

    # SEED-CL-11: Hidden branching -- reads env var inline
    pipeline_mode = os.environ.get('PIPELINE_MODE', 'normal')

    for record in records:
        # SEED-CL-11: Hidden state -- skip records from previous run
        if last_run_timestamp and record.get('signupDate'):
            try:
                record_ts = datetime.fromisoformat(
                    record['signupDate'].replace('Z', '+00:00')
                ).timestamp()
                if record_ts < last_run_timestamp:
                    continue
            except (ValueError, AttributeError):
                pass

        # SEED-CL-08: Nested try/except adds to cyclomatic complexity
        try:
            errors = validate_record(record)
        except ValueError as e:
            invalid.append({'record': record, 'errors': [str(e)]})
            continue

        # SEED-CL-10: validate_record returns None for missing name
        if errors is None:
            invalid.append({'record': record, 'errors': ['name is required']})
            continue

        # SEED-CL-10: validate_record returns dict for bad phone
        if isinstance(errors, dict):
            invalid.append({'record': record, 'errors': [errors.get('reason', 'validation failed')]})
            continue

        # SEED-CL-12: O(n^2) duplicate detection -- filter inside loop
        if record.get('email'):
            dupes = [r for r in records if r.get('email', '').lower() == record['email'].lower()]
            if len(dupes) > 1 and records.index(record) != records.index(dupes[0]):
                errors.append('duplicate email')

        if errors:
            invalid.append({'record': record, 'errors': errors})
            continue

        transformed = transform_record(record)

        if record.get('plan'):
            plan_ids.add(record['plan'])

        valid.append({
            **transformed,
            'planName': '',
            'monthlyPrice': 0,
            'features': [],
        })

    # --- Enrichment phase ---
    enriched_count = 0

    # SEED-CL-11: Hidden branching -- skip enrichment if PIPELINE_MODE is 'fast'
    if pipeline_mode != 'fast' and plan_ids:
        plan_details = await plan_service.lookup_plans(list(plan_ids))
        for customer in valid:
            if customer['plan'] and customer['plan'] in plan_details:
                details = plan_details[customer['plan']]
                customer['planName'] = details['planName']
                customer['monthlyPrice'] = details['monthlyPrice']
                customer['features'] = list(details['features'])
                enriched_count += 1

    # SEED-CL-11: Update hidden module-level state
    last_run_timestamp = datetime.now().timestamp()

    stats: PipelineStats = {
        'total': len(records),
        'valid': len(valid),
        'invalid': len(invalid),
        'enriched': enriched_count,
    }

    print(f'Pipeline complete: {stats}')

    return {'valid': valid, 'invalid': invalid, 'stats': stats}
