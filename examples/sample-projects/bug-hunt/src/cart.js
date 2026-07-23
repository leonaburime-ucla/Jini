/**
 * Calculates a cart total from quantity, unit price, and optional line discounts.
 *
 * The sample intentionally contains one defect for a coding agent to find.
 */
export function cartTotal(lines, taxRate = 0) {
  const subtotal = lines.reduce((sum, line) => {
    const linePrice = line.quantity * line.unitPrice;
    return sum + linePrice - line.discount;
  }, 0);

  return Number((subtotal + subtotal * (taxRate / 100)).toFixed(2));
}
