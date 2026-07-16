# Email Notification Batch Processor

Build a batch email notification processor in Python.

## Requirements

1. Accept a batch of notification requests (userId, templateId, data payload, priority).
2. For each notification: resolve user email from a user service, render template, send via email provider.
3. Support batch sizes up to 1000. Process in chunks of 50.
4. Failed individual sends should not abort the batch — collect failures and return a summary.
5. Support retry with exponential backoff (max 3 retries per item).
6. Duplicate notifications (same userId + templateId within a batch) should be deduplicated.
7. Return: total sent, total failed, total deduplicated, per-item results, and elapsed time.

## Constraints

- Pure Python, no external dependencies except provided service interfaces
- Must include tests
- Services (user lookup, template rendering, email sending) are injected interfaces
