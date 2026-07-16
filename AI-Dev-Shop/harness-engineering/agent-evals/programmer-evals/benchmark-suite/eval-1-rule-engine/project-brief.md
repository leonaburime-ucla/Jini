# Discount Rule Engine

Build a discount rule engine for an e-commerce checkout system in Python.

## Requirements

1. Accept a cart with line items (SKU, name, quantity, unitPrice) and apply discount rules.
2. Rules: bulk discount (10+ of same SKU = 15% off that SKU), combo discount (SKUs "WIDGET-A" + "WIDGET-B" together = $5 off total), loyalty discount (loyalty tier "gold" = 10% off total, "silver" = 5%).
3. Rules stack but total discount cannot exceed 40% of cart subtotal.
4. Return: original subtotal, each discount applied with rule name and amount, final total, and any warnings.
5. If a line item has quantity <= 0 or unitPrice < 0, reject the entire cart with a clear error.
6. The engine should be easy to extend with new rules without modifying the core loop.

## Constraints

- Pure Python, no external dependencies
- Must include tests
- Must handle edge cases: empty cart, single item, all rules applying, discount cap hit
