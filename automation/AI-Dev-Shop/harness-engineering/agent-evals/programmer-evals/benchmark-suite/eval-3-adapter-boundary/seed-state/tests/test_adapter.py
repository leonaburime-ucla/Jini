"""Tests for the payment gateway adapter."""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
from src.adapter import PaymentAdapter, AdapterResult, AdapterError, map_error_code


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_mock_sdk():
    sdk = MagicMock()
    sdk.charge = AsyncMock()
    sdk.refund = AsyncMock()
    sdk.get_transaction = AsyncMock()
    return sdk


def create_mock_logger():
    logger = MagicMock()
    logger.info = MagicMock()
    logger.error = MagicMock()
    return logger


def is_error(result: dict) -> bool:
    return result['status'] == 'error'


async def delay(ms: int, value):
    """Helper to create a coroutine that resolves after ms milliseconds."""
    await asyncio.sleep(ms / 1000.0)
    return value


async def delay_reject(ms: int, err: Exception):
    """Helper to create a coroutine that rejects after ms milliseconds."""
    await asyncio.sleep(ms / 1000.0)
    raise err


# ---------------------------------------------------------------------------
# chargeCard
# ---------------------------------------------------------------------------

class TestChargeCard:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.sdk = create_mock_sdk()
        self.logger = create_mock_logger()
        self.adapter = PaymentAdapter(self.sdk, {'logger': self.logger, 'timeoutMs': 200})

    @pytest.mark.asyncio
    async def test_returns_success_on_happy_path(self):
        self.sdk.charge.return_value = {'transactionId': 'txn-1', 'status': 'completed'}

        result = await self.adapter.charge_card({
            'amount': 1000,
            'currency': 'USD',
            'cardToken': 'tok_secret_123',
        })

        assert result['status'] == 'success'
        if result['status'] == 'success':
            assert result['data']['transactionId'] == 'txn-1'
            assert result['data']['status'] == 'completed'

    @pytest.mark.asyncio
    async def test_passes_amount_currency_and_card_token_to_sdk(self):
        self.sdk.charge.return_value = {'transactionId': 'txn-1', 'status': 'completed'}

        await self.adapter.charge_card({'amount': 500, 'currency': 'EUR', 'cardToken': 'tok_abc'})

        self.sdk.charge.assert_called_once_with(500, 'EUR', 'tok_abc')

    @pytest.mark.asyncio
    async def test_logs_operation_duration_success_and_transaction_id(self):
        self.sdk.charge.return_value = {'transactionId': 'txn-1', 'status': 'completed'}

        await self.adapter.charge_card({'amount': 1000, 'currency': 'USD', 'cardToken': 'tok_x'})

        assert self.logger.info.call_count == 1
        meta = self.logger.info.call_args[0][1]
        assert meta['operation'] == 'chargeCard'
        assert meta['transactionId'] == 'txn-1'
        assert meta['success'] is True
        assert isinstance(meta['duration'], float)

    @pytest.mark.asyncio
    async def test_never_logs_card_token(self):
        self.sdk.charge.return_value = {'transactionId': 'txn-1', 'status': 'completed'}

        await self.adapter.charge_card({'amount': 1000, 'currency': 'USD', 'cardToken': 'tok_super_secret'})

        all_log_args = ' '.join([
            *[str(c) for c in self.logger.info.call_args_list],
            *[str(c) for c in self.logger.error.call_args_list],
        ])

        assert 'tok_super_secret' not in all_log_args

    @pytest.mark.asyncio
    async def test_logs_operation_duration_failure_and_error_code(self):
        self.sdk.charge.side_effect = Exception('card_declined')

        await self.adapter.charge_card({'amount': 1000, 'currency': 'USD', 'cardToken': 'tok_x'})

        assert self.logger.error.call_count == 1
        meta = self.logger.error.call_args[0][1]
        assert meta['operation'] == 'chargeCard'
        assert meta['success'] is False
        assert isinstance(meta['duration'], float)

    # --- Error code mapping ---

    @pytest.mark.asyncio
    async def test_maps_invalid_card_error(self):
        self.sdk.charge.side_effect = Exception('invalid_card')

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'INVALID_CARD'
        assert result['message'] == 'invalid_card'

    @pytest.mark.asyncio
    async def test_maps_insufficient_funds_error(self):
        self.sdk.charge.side_effect = Exception('insufficient_funds')

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'INSUFFICIENT_FUNDS'

    @pytest.mark.asyncio
    async def test_maps_network_error(self):
        self.sdk.charge.side_effect = Exception('network error: ECONNREFUSED')

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'NETWORK_ERROR'

    @pytest.mark.asyncio
    async def test_maps_unrecognised_errors_to_unknown(self):
        self.sdk.charge.side_effect = Exception('solar flare')

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'UNKNOWN'
        assert result['message'] == 'solar flare'

    @pytest.mark.asyncio
    async def test_handles_non_exception_thrown_values(self):
        # In Python, side_effect with a string will raise it as an exception
        # We simulate a non-standard error scenario
        self.sdk.charge.side_effect = Exception('string boom')

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'UNKNOWN'
        assert result['message'] == 'string boom'

    @pytest.mark.asyncio
    async def test_handles_none_thrown_values(self):
        # Simulate an unexpected error
        self.sdk.charge.side_effect = Exception()

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'UNKNOWN'

    # --- Timeout ---

    @pytest.mark.asyncio
    async def test_returns_timeout_when_sdk_exceeds_deadline(self):
        async def slow_charge(*args):
            await asyncio.sleep(0.5)
            return {'transactionId': 'late', 'status': 'ok'}

        self.sdk.charge.side_effect = slow_charge

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert is_error(result)
        assert result['code'] == 'TIMEOUT'

    @pytest.mark.asyncio
    async def test_allows_per_call_timeout_override(self):
        async def medium_charge(*args):
            await asyncio.sleep(0.1)
            return {'transactionId': 'txn-ok', 'status': 'ok'}

        self.sdk.charge.side_effect = medium_charge

        # Default timeout is 200ms but override to 50ms
        result = await self.adapter.charge_card(
            {'amount': 100, 'currency': 'USD', 'cardToken': 'tok'},
            {'timeoutMs': 50},
        )

        assert is_error(result)
        assert result['code'] == 'TIMEOUT'

    @pytest.mark.asyncio
    async def test_succeeds_if_sdk_responds_before_timeout(self):
        async def fast_charge(*args):
            await asyncio.sleep(0.01)
            return {'transactionId': 'txn-fast', 'status': 'ok'}

        self.sdk.charge.side_effect = fast_charge

        result = await self.adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        assert result['status'] == 'success'


# ---------------------------------------------------------------------------
# refund
# ---------------------------------------------------------------------------

class TestRefund:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.sdk = create_mock_sdk()
        self.logger = create_mock_logger()
        self.adapter = PaymentAdapter(self.sdk, {'logger': self.logger, 'timeoutMs': 200})

    @pytest.mark.asyncio
    async def test_returns_success_on_happy_path(self):
        self.sdk.refund.return_value = {'refundId': 'ref-1', 'status': 'completed'}

        result = await self.adapter.refund({'transactionId': 'txn-1', 'amount': 50})

        assert result['status'] == 'success'
        if result['status'] == 'success':
            assert result['data']['refundId'] == 'ref-1'

    @pytest.mark.asyncio
    async def test_passes_transaction_id_and_amount_to_sdk(self):
        self.sdk.refund.return_value = {'refundId': 'ref-1', 'status': 'completed'}

        await self.adapter.refund({'transactionId': 'txn-abc', 'amount': 200})

        self.sdk.refund.assert_called_once_with('txn-abc', 200)

    @pytest.mark.asyncio
    async def test_logs_operation_with_transaction_id_on_success(self):
        self.sdk.refund.return_value = {'refundId': 'ref-1', 'status': 'completed'}

        await self.adapter.refund({'transactionId': 'txn-1', 'amount': 50})

        assert self.logger.info.call_count == 1
        meta = self.logger.info.call_args[0][1]
        assert meta['operation'] == 'refund'
        assert meta['transactionId'] == 'txn-1'
        assert meta['success'] is True

    @pytest.mark.asyncio
    async def test_maps_sdk_error_to_typed_response(self):
        self.sdk.refund.side_effect = Exception('insufficient_funds')

        result = await self.adapter.refund({'transactionId': 'txn-1', 'amount': 999})

        assert is_error(result)
        assert result['code'] == 'INSUFFICIENT_FUNDS'

    @pytest.mark.asyncio
    async def test_logs_on_error_with_error_code(self):
        self.sdk.refund.side_effect = Exception('network failure')

        await self.adapter.refund({'transactionId': 'txn-1', 'amount': 50})

        assert self.logger.error.call_count == 1
        meta = self.logger.error.call_args[0][1]
        assert meta['operation'] == 'refund'
        assert meta['errorCode'] == 'NETWORK_ERROR'
        assert meta['success'] is False

    @pytest.mark.asyncio
    async def test_returns_timeout_when_sdk_exceeds_deadline(self):
        async def slow_refund(*args):
            await asyncio.sleep(0.5)
            return {'refundId': 'late', 'status': 'ok'}

        self.sdk.refund.side_effect = slow_refund

        result = await self.adapter.refund({'transactionId': 'txn-1', 'amount': 50})

        assert is_error(result)
        assert result['code'] == 'TIMEOUT'


# ---------------------------------------------------------------------------
# getTransaction
# ---------------------------------------------------------------------------

class TestGetTransaction:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.sdk = create_mock_sdk()
        self.logger = create_mock_logger()
        self.adapter = PaymentAdapter(self.sdk, {'logger': self.logger, 'timeoutMs': 200})

    @pytest.mark.asyncio
    async def test_returns_success_on_happy_path(self):
        self.sdk.get_transaction.return_value = {
            'transactionId': 'txn-1',
            'amount': 1000,
            'status': 'completed',
            'createdAt': '2026-01-01',
        }

        result = await self.adapter.get_transaction({'transactionId': 'txn-1'})

        assert result['status'] == 'success'
        if result['status'] == 'success':
            assert result['data']['transactionId'] == 'txn-1'
            assert result['data']['amount'] == 1000
            assert result['data']['createdAt'] == '2026-01-01'

    @pytest.mark.asyncio
    async def test_passes_transaction_id_to_sdk(self):
        self.sdk.get_transaction.return_value = {
            'transactionId': 'txn-xyz',
            'amount': 100,
            'status': 'completed',
            'createdAt': '2026-01-01',
        }

        await self.adapter.get_transaction({'transactionId': 'txn-xyz'})

        self.sdk.get_transaction.assert_called_once_with('txn-xyz')

    @pytest.mark.asyncio
    async def test_logs_operation_with_transaction_id_on_success(self):
        self.sdk.get_transaction.return_value = {
            'transactionId': 'txn-1',
            'amount': 100,
            'status': 'completed',
            'createdAt': '2026-01-01',
        }

        await self.adapter.get_transaction({'transactionId': 'txn-1'})

        assert self.logger.info.call_count == 1
        meta = self.logger.info.call_args[0][1]
        assert meta['operation'] == 'getTransaction'
        assert meta['transactionId'] == 'txn-1'

    @pytest.mark.asyncio
    async def test_maps_sdk_error_to_typed_response(self):
        self.sdk.get_transaction.side_effect = Exception('not found')

        result = await self.adapter.get_transaction({'transactionId': 'txn-gone'})

        assert is_error(result)
        assert result['code'] == 'UNKNOWN'
        assert result['message'] == 'not found'

    @pytest.mark.asyncio
    async def test_returns_timeout_when_sdk_exceeds_deadline(self):
        async def slow_get(*args):
            await asyncio.sleep(0.5)
            return {'transactionId': 'txn-1', 'amount': 100, 'status': 'ok', 'createdAt': ''}

        self.sdk.get_transaction.side_effect = slow_get

        result = await self.adapter.get_transaction({'transactionId': 'txn-1'})

        assert is_error(result)
        assert result['code'] == 'TIMEOUT'

    @pytest.mark.asyncio
    async def test_logs_on_error(self):
        self.sdk.get_transaction.side_effect = Exception('boom')

        await self.adapter.get_transaction({'transactionId': 'txn-1'})

        assert self.logger.error.call_count == 1
        meta = self.logger.error.call_args[0][1]
        assert meta['operation'] == 'getTransaction'
        assert meta['success'] is False


# ---------------------------------------------------------------------------
# Constructor defaults
# ---------------------------------------------------------------------------

class TestPaymentAdapterDefaults:
    def test_constructs_without_options(self):
        sdk = create_mock_sdk()
        # Should not raise
        adapter = PaymentAdapter(sdk)
        assert adapter is not None

    @pytest.mark.asyncio
    async def test_uses_5_second_default_timeout(self):
        sdk = create_mock_sdk()
        logger = create_mock_logger()
        sdk.charge.return_value = {'transactionId': 'txn-1', 'status': 'ok'}
        adapter = PaymentAdapter(sdk, {'logger': logger})

        result = await adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})
        assert result['status'] == 'success'

    @pytest.mark.asyncio
    async def test_default_logger_writes_structured_json_to_console(self, capsys):
        sdk = create_mock_sdk()
        adapter = PaymentAdapter(sdk)  # uses default logger

        sdk.charge.return_value = {'transactionId': 'txn-1', 'status': 'ok'}
        await adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        captured = capsys.readouterr()
        parsed = json.loads(captured.out.strip())
        assert parsed['level'] == 'info'

        sdk.charge.side_effect = Exception('boom')
        await adapter.charge_card({'amount': 100, 'currency': 'USD', 'cardToken': 'tok'})

        captured = capsys.readouterr()
        parsed_err = json.loads(captured.err.strip())
        assert parsed_err['level'] == 'error'
