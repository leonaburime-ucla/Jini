"""Tests for the batch notification processor."""

import pytest
import asyncio
import json
from src.processor import process_batch, NotificationRequest


# --- Test Helpers ----------------------------------------------------------

async def instant_delay(ms: int) -> None:
    """No-op delay for fast tests."""
    pass


def make_notification(**overrides) -> NotificationRequest:
    defaults = {
        'userId': 'user1',
        'templateId': 'welcome',
        'data': {},
        'priority': 'normal',
    }
    defaults.update(overrides)
    return defaults


class MockUserService:
    async def get_user(self, user_id: str) -> dict:
        return {'email': f'{user_id}@test.com'}


class MockTemplateService:
    async def render(self, template_id: str, data: dict) -> str:
        return f'<html>{template_id}:{json.dumps(data)}</html>'


class MockEmailService:
    def __init__(self):
        self.send_calls = []

    async def send(self, to: str, html: str) -> None:
        self.send_calls.append({'to': to, 'html': html})


def make_mocks():
    email_service = MockEmailService()
    return {
        'userService': MockUserService(),
        'templateService': MockTemplateService(),
        'emailService': email_service,
        'sendCalls': email_service.send_calls,
    }


# --- Tests -----------------------------------------------------------------

class TestProcessBatch:
    # -- Happy Path --

    @pytest.mark.asyncio
    async def test_sends_all_notifications_in_simple_batch(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='u1'),
            make_notification(userId='u2', templateId='reset'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 2
        assert result['failed'] == 0
        assert result['deduplicated'] == 0
        assert len(result['results']) == 2
        assert len(mocks['sendCalls']) == 2
        assert result['elapsedMs'] >= 0

    @pytest.mark.asyncio
    async def test_returns_empty_results_for_empty_batch(self):
        mocks = make_mocks()

        result = await process_batch(
            {'notifications': [], 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 0
        assert result['failed'] == 0
        assert result['deduplicated'] == 0
        assert len(result['results']) == 0

    # -- Deduplication --

    @pytest.mark.asyncio
    async def test_deduplicates_same_user_and_template(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='u1', templateId='welcome'),
            make_notification(userId='u1', templateId='welcome'),
            make_notification(userId='u1', templateId='welcome'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 1
        assert result['deduplicated'] == 2
        assert len(mocks['sendCalls']) == 1
        deduped = [r for r in result['results'] if r['status'] == 'deduplicated']
        assert len(deduped) == 2

    @pytest.mark.asyncio
    async def test_does_not_deduplicate_different_templates_for_same_user(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='u1', templateId='welcome'),
            make_notification(userId='u1', templateId='reset'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 2
        assert result['deduplicated'] == 0
        assert len(mocks['sendCalls']) == 2

    @pytest.mark.asyncio
    async def test_does_not_deduplicate_same_template_for_different_users(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='u1', templateId='welcome'),
            make_notification(userId='u2', templateId='welcome'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 2
        assert result['deduplicated'] == 0

    # -- Retry & Backoff --

    @pytest.mark.asyncio
    async def test_retries_failed_sends_with_exponential_backoff(self):
        mocks = make_mocks()
        call_count = 0

        class FlakyEmailService:
            async def send(self, to: str, html: str) -> None:
                nonlocal call_count
                call_count += 1
                if call_count < 3:
                    raise Exception('transient')

        delays = []

        async def tracking_delay(ms: int) -> None:
            delays.append(ms)

        result = await process_batch(
            {'notifications': [make_notification()], 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': FlakyEmailService()},
            {'delay': tracking_delay, 'baseDelayMs': 100},
        )

        assert result['sent'] == 1
        assert call_count == 3
        # Exponential: 2^0*100=100, 2^1*100=200
        assert delays == [100, 200]

    @pytest.mark.asyncio
    async def test_fails_after_max_retries_exhausted(self):
        mocks = make_mocks()

        class AlwaysFailEmail:
            async def send(self, to: str, html: str) -> None:
                raise Exception('permanent failure')

        result = await process_batch(
            {'notifications': [make_notification()], 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': AlwaysFailEmail()},
            {'delay': instant_delay, 'maxRetries': 3},
        )

        assert result['failed'] == 1
        assert result['sent'] == 0
        assert result['results'][0]['status'] == 'failed'
        assert 'permanent failure' in result['results'][0]['error']

    @pytest.mark.asyncio
    async def test_respects_custom_max_retries(self):
        mocks = make_mocks()
        call_count = 0

        class AlwaysFailEmail:
            async def send(self, to: str, html: str) -> None:
                nonlocal call_count
                call_count += 1
                raise Exception('fail')

        await process_batch(
            {'notifications': [make_notification()], 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': AlwaysFailEmail()},
            {'delay': instant_delay, 'maxRetries': 5},
        )

        assert call_count == 5

    # -- Failure Isolation --

    @pytest.mark.asyncio
    async def test_continues_batch_when_individual_items_fail(self):
        mocks = make_mocks()

        class PartialFailEmail:
            async def send(self, to: str, html: str) -> None:
                if to == 'u2@test.com':
                    raise Exception('u2 down')

        notifications = [
            make_notification(userId='u1'),
            make_notification(userId='u2'),
            make_notification(userId='u3'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': PartialFailEmail()},
            {'delay': instant_delay, 'maxRetries': 1},
        )

        assert result['sent'] == 2
        assert result['failed'] == 1
        u2_result = next(r for r in result['results'] if r['userId'] == 'u2')
        assert u2_result['status'] == 'failed'
        u1_result = next(r for r in result['results'] if r['userId'] == 'u1')
        assert u1_result['status'] == 'sent'
        u3_result = next(r for r in result['results'] if r['userId'] == 'u3')
        assert u3_result['status'] == 'sent'

    @pytest.mark.asyncio
    async def test_handles_user_service_failure_as_retryable(self):
        mocks = make_mocks()
        call_count = 0

        class FlakyUserService:
            async def get_user(self, user_id: str) -> dict:
                nonlocal call_count
                call_count += 1
                if call_count < 2:
                    raise Exception('user service down')
                return {'email': f'{user_id}@test.com'}

        result = await process_batch(
            {'notifications': [make_notification()], 'userService': FlakyUserService(),
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 1
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_handles_template_service_failure_as_retryable(self):
        mocks = make_mocks()
        call_count = 0

        class FlakyTemplate:
            async def render(self, template_id: str, data: dict) -> str:
                nonlocal call_count
                call_count += 1
                if call_count < 2:
                    raise Exception('template service down')
                return '<html>ok</html>'

        result = await process_batch(
            {'notifications': [make_notification()], 'userService': mocks['userService'],
             'templateService': FlakyTemplate(), 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 1

    # -- Chunking --

    @pytest.mark.asyncio
    async def test_processes_in_chunks_of_configured_size(self):
        mocks = make_mocks()
        concurrency_snapshots = []
        in_flight = 0

        class TrackingEmailService:
            async def send(self, to: str, html: str) -> None:
                nonlocal in_flight
                in_flight += 1
                concurrency_snapshots.append(in_flight)
                # Simulate async work so concurrency is observable
                await asyncio.sleep(0.001)
                in_flight -= 1

        notifications = [
            make_notification(userId=f'u{i}', templateId='tpl')
            for i in range(10)
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': TrackingEmailService()},
            {'delay': instant_delay, 'chunkSize': 3},
        )

        assert result['sent'] == 10
        # Max concurrency should never exceed chunk size of 3
        assert max(concurrency_snapshots) <= 3

    # -- Priority Ordering --

    @pytest.mark.asyncio
    async def test_processes_high_priority_before_normal_and_low(self):
        mocks = make_mocks()
        send_order = []

        class OrderTracker:
            async def send(self, to: str, html: str) -> None:
                send_order.append(to)

        notifications = [
            make_notification(userId='low1', priority='low'),
            make_notification(userId='high1', priority='high'),
            make_notification(userId='norm1', priority='normal'),
            make_notification(userId='high2', priority='high', templateId='other'),
            make_notification(userId='low2', priority='low', templateId='other'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': OrderTracker()},
            {'delay': instant_delay, 'chunkSize': 100},  # single chunk to observe ordering
        )

        assert result['sent'] == 5
        # High-priority items should come first
        high_indices = [i for i, email in enumerate(send_order) if email.startswith('high')]
        normal_indices = [i for i, email in enumerate(send_order) if email.startswith('norm')]
        low_indices = [i for i, email in enumerate(send_order) if email.startswith('low')]

        assert max(high_indices) < min(normal_indices)
        assert max(normal_indices) < min(low_indices)

    # -- Batch Size Validation --

    @pytest.mark.asyncio
    async def test_throws_when_batch_exceeds_max_size(self):
        mocks = make_mocks()
        notifications = [make_notification(userId=f'u{i}') for i in range(11)]

        with pytest.raises(Exception, match='Batch size 11 exceeds maximum of 10'):
            await process_batch(
                {'notifications': notifications, 'userService': mocks['userService'],
                 'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
                {'delay': instant_delay, 'maxBatchSize': 10},
            )

    @pytest.mark.asyncio
    async def test_accepts_batch_at_exactly_max_size(self):
        mocks = make_mocks()
        notifications = [make_notification(userId=f'u{i}') for i in range(10)]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay, 'maxBatchSize': 10},
        )

        assert result['sent'] == 10

    # -- Per-Item Results --

    @pytest.mark.asyncio
    async def test_includes_template_id_in_per_item_results(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='u1', templateId='welcome'),
            make_notification(userId='u2', templateId='reset'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert 'templateId' in result['results'][0]
        assert 'templateId' in result['results'][1]

    # -- Observability --

    @pytest.mark.asyncio
    async def test_logs_batch_start_per_item_events_and_completion(self):
        mocks = make_mocks()
        logs = []

        class TestLogger:
            def info(self, msg, meta=None):
                logs.append({'level': 'info', 'msg': msg})
            def warn(self, msg, meta=None):
                logs.append({'level': 'warn', 'msg': msg})
            def error(self, msg, meta=None):
                logs.append({'level': 'error', 'msg': msg})

        call_count = 0

        class PartialFailEmail:
            async def send(self, to: str, html: str) -> None:
                nonlocal call_count
                call_count += 1
                if to == 'u2@test.com' and call_count <= 4:
                    raise Exception('fail')

        notifications = [
            make_notification(userId='u1'),
            make_notification(userId='u2'),
        ]

        await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': PartialFailEmail()},
            {'delay': instant_delay, 'logger': TestLogger()},
        )

        assert any(l['msg'] == 'batch.start' for l in logs)
        assert any(l['msg'] == 'batch.complete' for l in logs)
        assert any(l['msg'] == 'notification.sent' for l in logs)

    # -- Adversarial: Cross-Item Evidence --

    @pytest.mark.asyncio
    async def test_adversarial_dedup_keys_no_collision(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='a:b', templateId='c'),
            make_notification(userId='a', templateId='b:c'),
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 2
        assert result['deduplicated'] == 0
        assert len(mocks['sendCalls']) == 2

    @pytest.mark.asyncio
    async def test_adversarial_all_duplicates_results_in_one_send(self):
        mocks = make_mocks()
        notifications = [
            make_notification(userId='same', templateId='same')
            for _ in range(100)
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': mocks['emailService']},
            {'delay': instant_delay},
        )

        assert result['sent'] == 1
        assert result['deduplicated'] == 99
        assert len(mocks['sendCalls']) == 1
        assert len(result['results']) == 100

    @pytest.mark.asyncio
    async def test_adversarial_mixed_failures_and_deduplication(self):
        mocks = make_mocks()

        class FailForU2:
            async def send(self, to: str, html: str) -> None:
                if to == 'u2@test.com':
                    raise Exception('u2 permanently down')

        notifications = [
            make_notification(userId='u1', templateId='a'),
            make_notification(userId='u2', templateId='a'),
            make_notification(userId='u1', templateId='a'),  # duplicate
            make_notification(userId='u3', templateId='a'),
            make_notification(userId='u2', templateId='a'),  # duplicate
        ]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': FailForU2()},
            {'delay': instant_delay, 'maxRetries': 1},
        )

        assert result['sent'] == 2
        assert result['failed'] == 1
        assert result['deduplicated'] == 2
        assert result['sent'] + result['failed'] + result['deduplicated'] == 5
        assert len(result['results']) == 5

    @pytest.mark.asyncio
    async def test_adversarial_every_item_in_large_batch_fails(self):
        mocks = make_mocks()

        class AlwaysFailEmail:
            async def send(self, to: str, html: str) -> None:
                raise Exception('total outage')

        notifications = [make_notification(userId=f'u{i}') for i in range(120)]

        result = await process_batch(
            {'notifications': notifications, 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': AlwaysFailEmail()},
            {'delay': instant_delay, 'maxRetries': 1},
        )

        assert result['failed'] == 120
        assert result['sent'] == 0
        assert len(result['results']) == 120
        assert all(r['status'] == 'failed' for r in result['results'])

    @pytest.mark.asyncio
    async def test_adversarial_default_delay_backoff_wiring(self):
        mocks = make_mocks()

        class AlwaysFailEmail:
            async def send(self, to: str, html: str) -> None:
                raise Exception('fail')

        delays = []

        async def tracking_delay(ms):
            delays.append(ms)

        await process_batch(
            {'notifications': [make_notification()], 'userService': mocks['userService'],
             'templateService': mocks['templateService'], 'emailService': AlwaysFailEmail()},
            {'delay': tracking_delay, 'maxRetries': 3, 'baseDelayMs': 200},
        )

        # 2^0*200=200, 2^1*200=400 -- only 2 delays (no delay after last attempt)
        assert delays == [200, 400]
