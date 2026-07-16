"""Tests for the discount rule engine."""

import pytest
from src.engine import apply_discounts
from src.rules import bulk_discount, combo_discount, loyalty_discount
from src.validation import validate_cart
from src.types import LineItem, RuleContext, AppliedDiscount


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_item(sku: str, **overrides) -> LineItem:
    defaults = {
        'sku': sku,
        'name': sku,
        'quantity': 1,
        'unitPrice': 10,
    }
    defaults.update(overrides)
    return defaults


def make_context(items, loyalty_tier='none') -> RuleContext:
    subtotal = sum(i['quantity'] * i['unitPrice'] for i in items)
    return {'items': items, 'subtotal': subtotal, 'loyaltyTier': loyalty_tier}


# ---------------------------------------------------------------------------
# validate_cart
# ---------------------------------------------------------------------------

class TestValidateCart:
    def test_throws_on_empty_cart(self):
        with pytest.raises(Exception, match='Cart cannot be empty'):
            validate_cart({'items': []})

    def test_throws_on_none_items(self):
        with pytest.raises(Exception, match='Cart cannot be empty'):
            validate_cart({'items': None})

    def test_throws_when_quantity_is_zero(self):
        with pytest.raises(Exception, match=r'Invalid quantity.*"A"'):
            validate_cart({'items': [make_item('A', quantity=0)]})

    def test_throws_when_quantity_is_negative(self):
        with pytest.raises(Exception, match=r'Invalid quantity.*"B"'):
            validate_cart({'items': [make_item('B', quantity=-5)]})

    def test_throws_when_unit_price_is_negative(self):
        with pytest.raises(Exception, match=r'Invalid unitPrice.*"C"'):
            validate_cart({'items': [make_item('C', unitPrice=-1)]})

    def test_passes_for_valid_items(self):
        # Should not raise
        validate_cart({'items': [make_item('OK', quantity=1, unitPrice=0)]})

    def test_allows_unit_price_of_zero(self):
        # Should not raise
        validate_cart({'items': [make_item('FREE', unitPrice=0)]})


# ---------------------------------------------------------------------------
# Individual rules
# ---------------------------------------------------------------------------

class TestBulkDiscount:
    def test_returns_empty_for_items_below_threshold(self):
        ctx = make_context([make_item('A', quantity=9, unitPrice=10)])
        assert bulk_discount(ctx) == []

    def test_returns_15pct_off_for_items_at_threshold(self):
        ctx = make_context([make_item('A', quantity=10, unitPrice=10)])
        result = bulk_discount(ctx)
        assert result == [{'rule': 'bulk', 'sku': 'A', 'amount': 15}]

    def test_returns_15pct_off_for_items_above_threshold(self):
        ctx = make_context([make_item('A', quantity=12, unitPrice=10)])
        result = bulk_discount(ctx)
        assert result == [{'rule': 'bulk', 'sku': 'A', 'amount': 18}]

    def test_returns_multiple_discounts_for_multiple_qualifying_items(self):
        items = [
            make_item('A', quantity=10, unitPrice=10),
            make_item('B', quantity=20, unitPrice=5),
        ]
        ctx = make_context(items)
        result = bulk_discount(ctx)
        assert len(result) == 2
        assert result[0] == {'rule': 'bulk', 'sku': 'A', 'amount': 15}
        assert result[1] == {'rule': 'bulk', 'sku': 'B', 'amount': 15}


class TestComboDiscount:
    def test_returns_5_off_when_both_widgets_present(self):
        items = [make_item('WIDGET-A'), make_item('WIDGET-B')]
        assert combo_discount(make_context(items)) == [{'rule': 'combo', 'amount': 5}]

    def test_returns_empty_when_only_widget_a_present(self):
        assert combo_discount(make_context([make_item('WIDGET-A')])) == []

    def test_returns_empty_when_only_widget_b_present(self):
        assert combo_discount(make_context([make_item('WIDGET-B')])) == []

    def test_returns_empty_when_neither_present(self):
        assert combo_discount(make_context([make_item('OTHER')])) == []


class TestLoyaltyDiscount:
    def test_returns_10pct_for_gold_tier(self):
        ctx = make_context([make_item('A', quantity=1, unitPrice=100)], 'gold')
        assert loyalty_discount(ctx) == [{'rule': 'loyalty', 'amount': 10}]

    def test_returns_5pct_for_silver_tier(self):
        ctx = make_context([make_item('A', quantity=1, unitPrice=100)], 'silver')
        assert loyalty_discount(ctx) == [{'rule': 'loyalty', 'amount': 5}]

    def test_returns_empty_for_none_tier(self):
        ctx = make_context([make_item('A', quantity=1, unitPrice=100)], 'none')
        assert loyalty_discount(ctx) == []


# ---------------------------------------------------------------------------
# apply_discounts -- integration
# ---------------------------------------------------------------------------

class TestApplyDiscounts:
    # -- Basic happy paths ---------------------------------------------------

    def test_calculates_correct_subtotal(self):
        items = [
            make_item('A', quantity=2, unitPrice=25),
            make_item('B', quantity=3, unitPrice=10),
        ]
        result = apply_discounts({'items': items, 'loyaltyTier': 'none'}, {'rules': []})
        assert result['subtotal'] == 80
        assert result['finalTotal'] == 80
        assert result['discounts'] == []

    def test_applies_bulk_discount_only_when_requested(self):
        items = [make_item('X', quantity=10, unitPrice=20)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [bulk_discount]},
        )
        assert result['discounts'] == [{'rule': 'bulk', 'sku': 'X', 'amount': 30}]
        assert result['totalDiscount'] == 30
        assert result['finalTotal'] == 170

    def test_applies_combo_discount_when_widgets_present(self):
        items = [
            make_item('WIDGET-A', quantity=1, unitPrice=20),
            make_item('WIDGET-B', quantity=1, unitPrice=30),
        ]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [combo_discount]},
        )
        assert result['discounts'] == [{'rule': 'combo', 'amount': 5}]
        assert result['finalTotal'] == 45

    def test_applies_loyalty_discount_for_gold_tier(self):
        items = [make_item('A', quantity=1, unitPrice=100)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'gold'},
            {'rules': [loyalty_discount]},
        )
        assert result['discounts'] == [{'rule': 'loyalty', 'amount': 10}]
        assert result['finalTotal'] == 90

    def test_applies_loyalty_discount_for_silver_tier(self):
        items = [make_item('A', quantity=1, unitPrice=100)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'silver'},
            {'rules': [loyalty_discount]},
        )
        assert result['discounts'] == [{'rule': 'loyalty', 'amount': 5}]
        assert result['finalTotal'] == 95

    # -- Rule stacking -------------------------------------------------------

    def test_stacks_all_three_rules(self):
        items = [
            make_item('WIDGET-A', quantity=12, unitPrice=10),  # bulk: 18
            make_item('WIDGET-B', quantity=3, unitPrice=20),   # no bulk
        ]
        # subtotal = 120 + 60 = 180
        # bulk: 18, combo: 5, loyalty(gold): 18 => total = 41
        # 40% cap = 72, so all fit
        result = apply_discounts({'items': items, 'loyaltyTier': 'gold'})
        assert result['subtotal'] == 180
        assert len(result['discounts']) == 3
        assert result['totalDiscount'] == 41
        assert result['finalTotal'] == 139

    # -- Discount cap --------------------------------------------------------

    def test_caps_total_discount_at_40pct_of_subtotal(self):
        big_rule = lambda ctx: [{'rule': 'big', 'amount': 999}]
        items = [make_item('A', quantity=1, unitPrice=100)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [big_rule]},
        )
        # 40% of 100 = 40
        assert result['totalDiscount'] == 40
        assert result['finalTotal'] == 60
        assert 'Discount cap of 40.0% reached' in result['warnings']

    def test_partially_applies_discount_when_exceeding_cap(self):
        rule25 = lambda ctx: [{'rule': 'first', 'amount': 25}]
        rule30 = lambda ctx: [{'rule': 'second', 'amount': 30}]
        items = [make_item('A', quantity=1, unitPrice=100)]
        # cap = 40, first takes 25, second clamped to 15
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [rule25, rule30]},
        )
        assert result['totalDiscount'] == 40
        assert result['discounts'] == [
            {'rule': 'first', 'amount': 25},
            {'rule': 'second', 'amount': 15},
        ]
        assert 'Discount cap of 40.0% reached' in result['warnings']

    def test_respects_custom_max_discount_fraction(self):
        big_rule = lambda ctx: [{'rule': 'big', 'amount': 999}]
        items = [make_item('A', quantity=1, unitPrice=100)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [big_rule], 'maxDiscountFraction': 0.2},
        )
        assert result['totalDiscount'] == 20
        assert result['finalTotal'] == 80
        assert 'Discount cap of 20.0% reached' in result['warnings']

    # -- Validation ----------------------------------------------------------

    def test_throws_on_empty_cart(self):
        with pytest.raises(Exception, match='Cart cannot be empty'):
            apply_discounts({'items': [], 'loyaltyTier': 'none'})

    def test_throws_on_negative_quantity(self):
        with pytest.raises(Exception, match=r'Invalid quantity'):
            apply_discounts({
                'items': [make_item('BAD', quantity=-1)],
                'loyaltyTier': 'none',
            })

    def test_throws_on_negative_unit_price(self):
        with pytest.raises(Exception, match=r'Invalid unitPrice'):
            apply_discounts({
                'items': [make_item('BAD', unitPrice=-5)],
                'loyaltyTier': 'none',
            })

    def test_throws_on_zero_quantity(self):
        with pytest.raises(Exception, match=r'Invalid quantity'):
            apply_discounts({
                'items': [make_item('ZERO', quantity=0)],
                'loyaltyTier': 'none',
            })

    # -- Edge cases -----------------------------------------------------------

    def test_returns_zero_discounts_for_no_qualifying_rules(self):
        items = [make_item('SOLO', quantity=1, unitPrice=50)]
        result = apply_discounts({'items': items, 'loyaltyTier': 'none'})
        assert result['subtotal'] == 50
        assert result['discounts'] == []
        assert result['totalDiscount'] == 0
        assert result['finalTotal'] == 50
        assert result['warnings'] == []

    def test_handles_free_items_without_errors(self):
        items = [make_item('FREE', quantity=5, unitPrice=0)]
        result = apply_discounts({'items': items, 'loyaltyTier': 'gold'})
        assert result['subtotal'] == 0
        assert result['finalTotal'] == 0

    # -- Extensibility -------------------------------------------------------

    def test_supports_custom_rules_without_modifying_core(self):
        def bogo(ctx):
            results = []
            for item in ctx['items']:
                if item['quantity'] >= 2:
                    results.append({'rule': 'bogo', 'sku': item['sku'], 'amount': item['unitPrice']})
            return results

        items = [make_item('SHOE', quantity=2, unitPrice=80)]
        # subtotal = 160, cap = 64, bogo = 80 => clamped to 64
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [bogo]},
        )
        assert result['discounts'] == [{'rule': 'bogo', 'sku': 'SHOE', 'amount': 64}]
        assert result['finalTotal'] == 96

    def test_applies_default_rules_when_no_rules_option_given(self):
        items = [
            make_item('WIDGET-A', quantity=10, unitPrice=10),
            make_item('WIDGET-B', quantity=1, unitPrice=20),
        ]
        result = apply_discounts({'items': items, 'loyaltyTier': 'gold'})
        # subtotal = 100 + 20 = 120
        # bulk on WIDGET-A: 10*10*0.15 = 15
        # combo: 5
        # loyalty(gold): 120*0.10 = 12
        # total discount = 32, cap = 48 => all fit
        assert result['subtotal'] == 120
        assert result['totalDiscount'] == 32
        assert result['finalTotal'] == 88

    # -- Adversarial: cross-item / aggregate edge cases ----------------------

    def test_adversarial_many_small_discounts_exceed_cap(self):
        many_small = lambda ctx: [{'rule': f'small-{i}', 'amount': 1} for i in range(100)]
        items = [make_item('A', quantity=1, unitPrice=100)]
        # cap = 40, should only apply 40 of the 100 $1 discounts
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [many_small]},
        )
        assert result['totalDiscount'] == 40
        assert len(result['discounts']) == 40
        assert 'Discount cap of 40.0% reached' in result['warnings']

    def test_adversarial_discount_equals_exactly_the_cap(self):
        exact_cap = lambda ctx: [{'rule': 'exact', 'amount': 40}]
        items = [make_item('A', quantity=1, unitPrice=100)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [exact_cap]},
        )
        assert result['totalDiscount'] == 40
        assert result['finalTotal'] == 60
        assert 'Discount cap of 40.0% reached' in result['warnings']

    def test_adversarial_small_fractional_prices_correct_rounding(self):
        items = [make_item('PENNY', quantity=10, unitPrice=0.01)]
        # subtotal = 0.10, bulk = 0.10 * 0.15 = 0.015 => rounds to 0.02
        # cap = 0.10 * 0.40 = 0.04
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [bulk_discount]},
        )
        assert abs(result['subtotal'] - 0.10) < 0.001
        assert result['totalDiscount'] == 0.02
        assert abs(result['finalTotal'] - 0.08) < 0.001

    def test_adversarial_zero_amount_discount_does_not_count_toward_cap(self):
        zero_discount = lambda ctx: [{'rule': 'zero', 'amount': 0}]
        items = [make_item('A', quantity=1, unitPrice=100)]
        result = apply_discounts(
            {'items': items, 'loyaltyTier': 'none'},
            {'rules': [zero_discount]},
        )
        assert result['totalDiscount'] == 0
        assert result['warnings'] == []
