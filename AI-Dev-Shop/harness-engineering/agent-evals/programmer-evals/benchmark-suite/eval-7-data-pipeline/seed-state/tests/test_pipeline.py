"""
Customer Record Pipeline -- Test Suite

SEED-CL-09: Tests use truthy assertions (assert result), weak checks
(assert len(result['valid']) > 0), one mocks internal validate_email
(implementation probing), and one has a race condition with threading/sleep.
"""

import asyncio
import threading
import time
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from src.pipeline import (
    transform_pipeline,
    format_phone_e164,
    format_phone_international,
    validate_email,
    validate_phone,
    validate_signup_date,
    validate_record,
    transform_record,
)

# --- Reset module-level state before each test ---
import src.pipeline as pipeline_module


@pytest.fixture(autouse=True)
def reset_module_state():
    """Reset hidden module state between tests."""
    pipeline_module.last_run_timestamp = None
    yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_PLANS = {
    'pro': {'planName': 'Pro', 'monthlyPrice': 29.99, 'features': ['analytics', 'api-access']},
    'starter': {'planName': 'Starter', 'monthlyPrice': 9.99, 'features': ['basic-dashboard']},
}


def make_plan_service(plans=None):
    if plans is None:
        plans = {}
    service = AsyncMock()
    service.lookup_plans = AsyncMock(return_value=plans)
    return service


def make_record(**overrides):
    base = {
        'name': 'Jane Doe',
        'email': 'jane@example.com',
        'phone': '(555) 123-4567',
        'address': {'street': '123 Main St', 'city': 'Springfield', 'state': 'IL', 'zip': '62701'},
        'signupDate': '2025-06-15T00:00:00Z',
        'plan': 'pro',
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# validate_email
# ---------------------------------------------------------------------------

class TestValidateEmail:
    def test_accepts_standard_email(self):
        assert validate_email('user@example.com') is True

    def test_rejects_email_without_at(self):
        assert validate_email('userexample.com') is False

    def test_rejects_email_without_domain(self):
        assert validate_email('user@') is False

    def test_rejects_empty_string(self):
        assert validate_email('') is False

    def test_rejects_email_with_spaces(self):
        assert validate_email('user @example.com') is False


# ---------------------------------------------------------------------------
# validate_phone
# ---------------------------------------------------------------------------

class TestValidatePhone:
    def test_accepts_10_digit_number(self):
        assert validate_phone('5551234567') is True

    def test_accepts_formatted_number(self):
        assert validate_phone('(555) 123-4567') is True

    def test_rejects_short_number(self):
        assert validate_phone('12345') is False

    def test_accepts_international_number(self):
        assert validate_phone('+44 20 7946 0958') is True


# ---------------------------------------------------------------------------
# validate_signup_date
# ---------------------------------------------------------------------------

class TestValidateSignupDate:
    def test_accepts_valid_iso_date(self):
        assert validate_signup_date('2025-06-15T00:00:00Z') is True

    def test_accepts_date_only_string(self):
        assert validate_signup_date('2025-01-01') is True

    def test_rejects_garbage_string(self):
        assert validate_signup_date('not-a-date') is False


# ---------------------------------------------------------------------------
# format_phone_e164
# ---------------------------------------------------------------------------

class TestFormatPhoneE164:
    def test_formats_10_digit_us_number(self):
        assert format_phone_e164('5551234567') == '+15551234567'

    def test_formats_number_with_formatting(self):
        assert format_phone_e164('(555) 123-4567') == '+15551234567'

    def test_handles_11_digit_starting_with_1(self):
        assert format_phone_e164('15551234567') == '+15551234567'

    def test_handles_international_numbers(self):
        assert format_phone_e164('+44 20 7946 0958') == '+442079460958'

    def test_passes_through_short_numbers(self):
        assert format_phone_e164('12345') == '12345'


# ---------------------------------------------------------------------------
# format_phone_international -- SEED-CL-TRICK-04: dead code, fully tested
# ---------------------------------------------------------------------------

class TestFormatPhoneInternational:
    def test_formats_10_digit_us_number(self):
        assert format_phone_international('5551234567') == '+1 (555) 123-4567'

    def test_formats_11_digit_starting_with_1(self):
        assert format_phone_international('15551234567') == '+1 (555) 123-4567'

    def test_formats_international_number(self):
        result = format_phone_international('+442079460958')
        assert result  # SEED-CL-09: truthy assertion instead of exact check

    def test_passes_through_short_numbers(self):
        assert format_phone_international('12345') == '12345'

    def test_handles_formatted_input(self):
        result = format_phone_international('(555) 123-4567')
        assert result  # SEED-CL-09: truthy assertion


# ---------------------------------------------------------------------------
# transform_pipeline -- happy path
# ---------------------------------------------------------------------------

class TestTransformPipelineHappyPath:
    @pytest.mark.asyncio
    async def test_processes_single_valid_record(self):
        records = [make_record()]
        service = make_plan_service(SAMPLE_PLANS)

        result = await transform_pipeline(records, service)

        # SEED-CL-09: Truthy assertion instead of exact check
        assert result
        assert len(result['valid']) > 0  # SEED-CL-09: weak assertion

    @pytest.mark.asyncio
    async def test_processes_multiple_records(self):
        records = [
            make_record(email='alice@test.com', name='Alice', plan='pro'),
            make_record(email='bob@test.com', name='Bob', plan='starter'),
            make_record(email='carol@test.com', name='Carol', plan='starter'),
        ]
        service = make_plan_service(SAMPLE_PLANS)

        result = await transform_pipeline(records, service)

        assert result  # SEED-CL-09: truthy assertion
        assert result['stats']['valid'] > 0  # SEED-CL-09: weak assertion

    @pytest.mark.asyncio
    async def test_calls_lookup_plans_with_unique_ids(self):
        records = [
            make_record(email='a@test.com', plan='pro'),
            make_record(email='b@test.com', plan='pro'),
            make_record(email='c@test.com', plan='starter'),
        ]
        service = make_plan_service(SAMPLE_PLANS)

        await transform_pipeline(records, service)

        service.lookup_plans.assert_called_once()
        called_with = service.lookup_plans.call_args[0][0]
        assert sorted(called_with) == ['pro', 'starter']

    @pytest.mark.asyncio
    async def test_does_not_call_lookup_when_no_plans(self):
        records = [make_record(email='a@test.com', plan=None)]
        service = make_plan_service(SAMPLE_PLANS)

        result = await transform_pipeline(records, service)

        service.lookup_plans.assert_not_called()

    @pytest.mark.asyncio
    async def test_does_not_mutate_input_array(self):
        """
        SEED-CL-TRICK-03: This test SHOULD catch the records.sort() mutation
        bug, but the assertion is too weak.
        """
        records = [
            make_record(email='b@test.com', signupDate='2025-01-01T00:00:00Z'),
            make_record(email='a@test.com', signupDate='2024-01-01T00:00:00Z'),
        ]
        original_first_email = records[0]['email']
        service = make_plan_service(SAMPLE_PLANS)

        await transform_pipeline(records, service)

        # SEED-CL-09: Only checks length, not order -- misses the sort mutation
        assert len(records) == 2


# ---------------------------------------------------------------------------
# transform_pipeline -- invalid records
# ---------------------------------------------------------------------------

class TestTransformPipelineInvalidRecords:
    @pytest.mark.asyncio
    async def test_rejects_missing_name(self):
        records = [make_record(name='')]
        service = make_plan_service(SAMPLE_PLANS)

        result = await transform_pipeline(records, service)

        assert len(result['valid']) == 0
        assert len(result['invalid']) > 0  # SEED-CL-09: weak assertion

    @pytest.mark.asyncio
    async def test_rejects_invalid_email(self):
        records = [make_record(email='not-an-email')]
        service = make_plan_service(SAMPLE_PLANS)

        result = await transform_pipeline(records, service)

        assert len(result['invalid']) > 0  # SEED-CL-09: weak assertion

    @pytest.mark.asyncio
    async def test_mixes_valid_and_invalid(self):
        records = [
            make_record(email='good@test.com'),
            make_record(name='', email='bad-name@test.com'),
            make_record(email='also-good@test.com'),
        ]
        service = make_plan_service(SAMPLE_PLANS)

        result = await transform_pipeline(records, service)

        # SEED-CL-09: Weak assertions -- only checks > 0
        assert len(result['valid']) > 0
        assert len(result['invalid']) > 0


# ---------------------------------------------------------------------------
# transform_pipeline -- implementation probing mock
# ---------------------------------------------------------------------------

class TestTransformPipelineImplProbing:
    @pytest.mark.asyncio
    async def test_uses_validate_email_internally(self):
        """
        SEED-CL-09: Mocks the internal validate_email function to verify
        it's called -- this is implementation probing, not behavior testing.
        """
        records = [make_record()]
        service = make_plan_service(SAMPLE_PLANS)

        with patch('src.pipeline.validate_email', return_value=True) as mock_validate:
            result = await transform_pipeline(records, service)
            mock_validate.assert_called()


# ---------------------------------------------------------------------------
# transform_pipeline -- race condition with threading
# ---------------------------------------------------------------------------

class TestTransformPipelineRaceCondition:
    @pytest.mark.asyncio
    async def test_enrichment_with_delay(self):
        """
        SEED-CL-09: Race condition -- uses threading + sleep to simulate
        async enrichment instead of proper async patterns.
        """
        result_container = {}

        async def delayed_lookup(plan_ids):
            time.sleep(0.05)  # SEED-CL-09: real sleep in async context
            return SAMPLE_PLANS

        service = AsyncMock()
        service.lookup_plans = delayed_lookup
        records = [make_record()]

        def run_pipeline():
            loop = asyncio.new_event_loop()
            result_container['result'] = loop.run_until_complete(
                transform_pipeline(records, service)
            )
            loop.close()

        thread = threading.Thread(target=run_pipeline)
        thread.start()
        thread.join(timeout=5)

        # SEED-CL-09: Truthy check on result from thread
        assert result_container.get('result')


# ---------------------------------------------------------------------------
# transform_pipeline -- maxRecords
# ---------------------------------------------------------------------------

class TestTransformPipelineMaxRecords:
    @pytest.mark.asyncio
    async def test_throws_when_exceeds_default_limit(self):
        records = [make_record(email=f'user{i}@test.com') for i in range(10_001)]
        service = make_plan_service()

        with pytest.raises(ValueError, match='Input exceeds maximum of 10000'):
            await transform_pipeline(records, service)

    @pytest.mark.asyncio
    async def test_respects_custom_max_records(self):
        records = [
            make_record(email='a@test.com'),
            make_record(email='b@test.com'),
            make_record(email='c@test.com'),
        ]
        service = make_plan_service()

        with pytest.raises(ValueError, match='Input exceeds maximum of 2'):
            await transform_pipeline(records, service, {'max_records': 2})


# ---------------------------------------------------------------------------
# transform_pipeline -- stats
# ---------------------------------------------------------------------------

class TestTransformPipelineStats:
    @pytest.mark.asyncio
    async def test_returns_zero_stats_for_empty_input(self):
        service = make_plan_service()

        result = await transform_pipeline([], service)

        assert result['stats'] == {'total': 0, 'valid': 0, 'invalid': 0, 'enriched': 0}
        assert result['valid'] == []
        assert result['invalid'] == []
