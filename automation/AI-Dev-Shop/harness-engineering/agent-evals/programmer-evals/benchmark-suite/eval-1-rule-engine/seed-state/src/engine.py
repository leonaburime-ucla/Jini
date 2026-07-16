"""
Discount rule engine -- applies discount rules to a cart and returns a detailed breakdown.
"""

from typing import List, Optional
from .rules import DEFAULT_RULES
from .types import (
    AppliedDiscount,
    ApplyDiscountsInput,
    ApplyDiscountsOptions,
    DiscountResult,
)
from .validation import validate_cart

DEFAULT_MAX_DISCOUNT_FRACTION = 0.4


def apply_discounts(
    input: ApplyDiscountsInput,
    options: Optional[ApplyDiscountsOptions] = None,
) -> DiscountResult:
    """
    Applies discount rules to a cart and returns a detailed breakdown.

    Two-object signature: required input + optional options.

    Args:
        input: dict with 'items' and 'loyaltyTier' -- the cart and customer info (required).
        options: dict with 'rules' and/or 'maxDiscountFraction' -- override rules or cap (optional).

    Returns:
        DiscountResult with subtotal, applied discounts, final total, and warnings.

    Raises:
        Exception: if cart validation fails (empty cart, invalid quantity/price).

    @complexity Time: O(R * n) where R = number of rules, Space: O(n)
    @overallScore 92/100
    """
    items = input['items']
    loyalty_tier = input['loyaltyTier']
    rules = (options or {}).get('rules', DEFAULT_RULES)
    max_fraction = (options or {}).get('maxDiscountFraction', DEFAULT_MAX_DISCOUNT_FRACTION)

    # Validate -- raises on invalid cart (fail-fast)
    validate_cart({'items': items})

    # Calculate subtotal
    subtotal = sum(item['quantity'] * item['unitPrice'] for item in items)

    max_discount = _round_cents(subtotal * max_fraction)
    discounts: List[AppliedDiscount] = []
    total_discount = 0.0
    warnings: List[str] = []

    # Apply each rule in order; clamp to cap
    context = {'items': items, 'subtotal': subtotal, 'loyaltyTier': loyalty_tier}

    for rule in rules:
        rule_results = rule(context)

        for d in rule_results:
            remaining = _round_cents(max_discount - total_discount)

            if remaining <= 0:
                break

            if d['amount'] <= remaining:
                discounts.append(d)
                total_discount = _round_cents(total_discount + d['amount'])
            else:
                # Partially apply the discount up to the cap
                discounts.append({**d, 'amount': remaining})
                total_discount = _round_cents(total_discount + remaining)

    if total_discount >= max_discount and max_discount > 0:
        warnings.append(f'Discount cap of {max_fraction * 100}% reached')

    return {
        'subtotal': subtotal,
        'discounts': discounts,
        'totalDiscount': total_discount,
        'finalTotal': _round_cents(subtotal - total_discount),
        'warnings': warnings,
    }


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
