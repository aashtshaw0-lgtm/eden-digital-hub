/**
 * Property check for the cart money split.
 *
 * Runs the shipped helpers over many cart shapes and asserts the invariants the
 * admin board depends on: the line totals must be whole non-negative rupees
 * that sum to exactly what the client was charged.
 *
 * Run: bun run scripts/verify-cart-money.ts
 */
import { allocateProportionally, distributeDiscount } from "../src/convex/lib/money";

let checked = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  checked++;
}

// Deterministic pseudo-random so a failure is reproducible.
let seed = 12345;
function rand(max: number): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return Math.floor((seed / 2147483648) * max);
}

for (let trial = 0; trial < 20000; trial++) {
  const lines = 1 + rand(6);
  const prices: number[] = [];
  for (let i = 0; i < lines; i++) {
    // Include zero-priced and free-with-tip lines, which are the awkward cases.
    prices.push(rand(4) === 0 ? 0 : 1 + rand(5000));
  }
  const itemsTotal = prices.reduce((a, b) => a + b, 0);
  const tip = rand(3) === 0 ? 0 : rand(2000);
  const subtotal = itemsTotal + tip;
  // The discount can be anything the coupon rules allow: 0, partial, or the
  // whole thing (a 100% coupon), plus the over-amount create clamps away.
  const rawDiscount = rand(5) === 0 ? subtotal + rand(500) : rand(subtotal + 1);

  const tipParts = allocateProportionally(tip, prices);
  const grossParts = prices.map((p, i) => p + tipParts[i]);
  const discountParts = distributeDiscount(grossParts, rawDiscount);
  const netParts = grossParts.map((g, i) => Math.max(0, g - discountParts[i]));

  // 1. No fractional rupees anywhere in the money path.
  for (const v of [...tipParts, ...discountParts, ...netParts]) {
    assert(Number.isInteger(v), `non-integer part ${v} (trial ${trial})`);
  }
  // 2. Nothing goes negative.
  for (const v of [...tipParts, ...discountParts, ...netParts]) {
    assert(v >= 0, `negative part ${v} (trial ${trial})`);
  }
  // 3. The tip is charged exactly once across the cart.
  assert(
    tipParts.reduce((a, b) => a + b, 0) === Math.max(0, Math.round(tip)),
    `tip parts lost a rupee (trial ${trial})`,
  );
  // 4. The discount is never more than the cart is worth.
  const appliedDiscount = discountParts.reduce((a, b) => a + b, 0);
  assert(
    appliedDiscount <= Math.max(0, Math.round(subtotal)),
    `discount ${appliedDiscount} exceeds cart ${subtotal} (trial ${trial})`,
  );
  // 5. THE invariant: the order totals equal the amount the client was charged.
  const charged = Math.max(0, subtotal - appliedDiscount);
  const orderTotal = netParts.reduce((a, b) => a + b, 0);
  assert(
    orderTotal === charged,
    `orders total ${orderTotal} != charged ${charged} (trial ${trial}, lines ${JSON.stringify(prices)}, tip ${tip}, disc ${rawDiscount})`,
  );
}

// Targeted cases the random sweep is unlikely to hit.
//
// These assert the *properties* (sums exactly, nothing negative, as even as
// possible) rather than one particular distribution — which line receives a
// leftover rupee is an arbitrary tie-break, not part of the contract.
const even = allocateProportionally(100, [1000, 1000, 1000]);
assert(even.reduce((a, b) => a + b, 0) === 100, "equal split sums to the whole");
assert(even.every((v) => v >= 0), "equal split has no negative line");
assert(
  Math.max(...even) - Math.min(...even) <= 1,
  "equal split is as even as whole rupees allow",
);
assert(
  JSON.stringify(allocateProportionally(1, [0, 0, 0])) === JSON.stringify([1, 0, 0]),
  "tip on a free cart lands on line one",
);
assert(
  JSON.stringify(distributeDiscount([0, 0], 500)) === JSON.stringify([0, 0]),
  "a fully free cart absorbs no discount",
);
assert(
  JSON.stringify(distributeDiscount([100, 100], 100)) === JSON.stringify([50, 50]),
  "an even discount splits evenly",
);

console.log(`PASS  ${checked} cart-money invariants across 20000 carts + 4 targeted cases`);