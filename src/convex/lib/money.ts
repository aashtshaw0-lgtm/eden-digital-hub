/**
 * Splitting a cart-level rupee amount across its line items.
 *
 * A cart is one payment: the client sends a single UPI transfer for the whole
 * total, but each line item is stored as its own order. The order totals must
 * therefore add up to exactly what the client was charged — not one rupee more
 * (which the admin board would read as an unexplained shortfall) and not one
 * rupee less (which would read as an overpayment nobody can explain).
 *
 * Kept pure, integer-only and exported so the arithmetic can be unit-tested
 * without a database, and reused by the checkout preview.
 */

/**
 * Largest cart we will turn into orders in one transaction.
 *
 * A mutation is one transaction; this bounds how much work and how many proof
 * rows a single call can create.
 */
export const MAX_CART_LINES = 12;

/**
 * Splits `total` across `weights` in proportion, in whole rupees.
 *
 * The parts are whole rupees, never negative, and always sum to exactly
 * `total`: so a hundred-rupee discount over three lines never leaves a rupee
 * unaccounted for, and an awkward split never invents one either.
 */
export function allocateProportionally(
  total: number,
  weights: number[],
): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const target = Math.max(0, Math.round(total));
  const parts = new Array<number>(n).fill(0);
  if (target === 0) return parts;

  const safeWeights = weights.map((w) => (Number.isFinite(w) ? Math.max(0, w) : 0));
  const weightSum = safeWeights.reduce((a, b) => a + b, 0);
  // Nothing to weigh against (a fully discounted cart): put it all on line one
  // rather than dividing by zero.
  if (weightSum <= 0) {
    parts[0] = target;
    return parts;
  }

  // Largest-remainder (Hamilton) apportionment.
  //
  // Rounding each share independently is not safe here: every share can round
  // *up*, so their sum overshoots the target and the line that absorbs the
  // remainder is handed a negative amount. Flooring first can never overshoot,
  // and the leftover rupees are then handed to the lines with the largest
  // fractional parts — so the parts always sum to exactly `target` and no line
  // is ever negative.
  const remainders: number[] = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    const exact = (target * safeWeights[i]) / weightSum;
    parts[i] = Math.floor(exact);
    remainders.push(exact - parts[i]);
    assigned += parts[i];
  }

  let leftover = target - assigned;
  if (leftover > 0) {
    // Largest fractional part first; ties break toward the earlier line so the
    // result is stable for a given cart.
    const order = remainders
      .map((remainder, i) => ({ i, remainder }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    for (const { i } of order) {
      if (leftover <= 0) break;
      parts[i] += 1;
      leftover -= 1;
    }
  }
  return parts;
}

/**
 * How much of `discount` each line absorbs.
 *
 * Shares are proportional to what each line is worth, then capped at that
 * line's own gross so no order can be driven below zero. Independent rounding
 * can overshoot a cap by a rupee on a small line; the overflow is trimmed from
 * the largest line rather than left to make the parts stop summing to the
 * discount.
 *
 * `discount` is clamped to the cart gross, so the returned parts always sum to
 * `min(discount, grossTotal)`.
 */
export function distributeDiscount(gross: number[], discount: number): number[] {
  const grossTotal = gross.reduce((a, b) => a + Math.max(0, b), 0);
  const shares = allocateProportionally(
    Math.min(Number.isFinite(discount) ? discount : 0, grossTotal),
    gross,
  );

  let excess = 0;
  const capped = shares.map((share, i) => {
    const lineGross = Math.max(0, gross[i] ?? 0);
    if (share > lineGross) {
      excess += share - lineGross;
      return lineGross;
    }
    return share;
  });

  if (excess > 0 && capped.length > 0) {
    let largest = 0;
    for (let i = 1; i < capped.length; i++) {
      if (capped[i] > capped[largest]) largest = i;
    }
    capped[largest] = Math.max(0, capped[largest] - excess);
  }

  return capped;
}