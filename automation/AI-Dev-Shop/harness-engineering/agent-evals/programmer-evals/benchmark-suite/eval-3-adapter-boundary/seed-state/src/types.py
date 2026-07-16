"""
Type definitions for the Payment SDK interface.
"""

from typing import Protocol


class PaymentSDK(Protocol):
    """External payment SDK interface."""

    async def charge(self, amount: int, currency: str, card_token: str) -> dict:
        """Charge a card. Returns dict with transactionId, status."""
        ...

    async def refund(self, transaction_id: str, amount: int) -> dict:
        """Refund a transaction. Returns dict with refundId, status."""
        ...

    async def get_transaction(self, transaction_id: str) -> dict:
        """Get transaction details. Returns dict with transactionId, amount, status, createdAt."""
        ...
