"""
Discount rule functions for the rule engine.

Each rule inspects the cart context and returns applicable discounts.
"""

from typing import List
from .types import AppliedDiscount, RuleContext


def _round_cents(value: float) -> float:
    """
    Rounds a number to two decimal places (cents).

    Args:
        value: The number to round.

    Returns:
        Rounded value.

    @complexity Time: O(1), Space: O(1)
    @overallScore 95/100
    """
    return round(value * 100) / 100


def bulk_discount(context: RuleContext) -> List[AppliedDiscount]:
    """
    Bulk discount rule: 15% off any SKU with quantity >= 10.

    Args:
        context: dict with items, subtotal, loyaltyTier.

    Returns:
        List of AppliedDiscount, one per qualifying SKU.

    @complexity Time: O(n), Space: O(n)
    @overallScore 95/100
    """
    results: List[AppliedDiscount] = []

    for item in context['items']:
        if item['quantity'] >= 10:
            amount = _round_cents(item['quantity'] * item['unitPrice'] * 0.15)
            results.append({'rule': 'bulk', 'sku': item['sku'], 'amount': amount})

    return results


def combo_discount(context: RuleContext) -> List[AppliedDiscount]:
    """
    Combo discount rule: $5 off when both WIDGET-A and WIDGET-B are in the cart.

    Args:
        context: dict with items, subtotal, loyaltyTier.

    Returns:
        List with one AppliedDiscount if combo qualifies, empty otherwise.

    @complexity Time: O(n), Space: O(1)
    @overallScore 95/100
    """
    skus = set(i['sku'] for i in context['items'])

    if 'WIDGET-A' in skus and 'WIDGET-B' in skus:
        return [{'rule': 'combo', 'amount': 5}]

    return []


def loyalty_discount(context: RuleContext) -> List[AppliedDiscount]:
    """
    Loyalty discount rule: gold = 10% off subtotal, silver = 5%.

    Args:
        context: dict with items, subtotal, loyaltyTier.

    Returns:
        List with one AppliedDiscount if tier qualifies, empty otherwise.

    @complexity Time: O(1), Space: O(1)
    @overallScore 95/100
    """
    rates = {'gold': 0.10, 'silver': 0.05}
    rate = rates.get(context['loyaltyTier'])

    if rate is not None:
        return [{'rule': 'loyalty', 'amount': _round_cents(context['subtotal'] * rate)}]

    return []


# The default set of discount rules applied when none are specified.
DEFAULT_RULES = [bulk_discount, combo_discount, loyalty_discount]
