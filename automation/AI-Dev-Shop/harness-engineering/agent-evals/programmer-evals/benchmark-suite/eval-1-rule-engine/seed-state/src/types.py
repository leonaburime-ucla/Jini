"""
Typed contracts for the discount rule engine.

Single source of truth for all domain types.
"""

from typing import TypedDict, List, Callable, Optional, Literal


class LineItem(TypedDict):
    """A single line item in a shopping cart."""
    sku: str
    name: str
    quantity: int
    unitPrice: float


class AppliedDiscount(TypedDict, total=False):
    """A discount applied by a rule."""
    rule: str
    amount: float
    sku: str


LoyaltyTier = Literal['gold', 'silver', 'none']


class RuleContext(TypedDict):
    """Context passed to each discount rule."""
    items: List[LineItem]
    subtotal: float
    loyaltyTier: LoyaltyTier


class ApplyDiscountsInput(TypedDict):
    """Required input for apply_discounts."""
    items: List[LineItem]
    loyaltyTier: LoyaltyTier


class ApplyDiscountsOptions(TypedDict, total=False):
    """Optional configuration for apply_discounts."""
    rules: List[Callable]
    maxDiscountFraction: float


class DiscountResult(TypedDict):
    """The result of applying discounts to a cart."""
    subtotal: float
    discounts: List[AppliedDiscount]
    totalDiscount: float
    finalTotal: float
    warnings: List[str]


# Type alias for discount rule function
DiscountRule = Callable[[RuleContext], List[AppliedDiscount]]
