/**
 * Verifies the real shipped source of toAmount / resolvePaidAmount / paymentState
 * against the reported case: a Rs 55 receipt against a Rs 1,999 order.
 * The functions are sliced straight out of the source files and evaluated, so
 * this tests the code that ships rather than a copy of it.
 */
import { readFileSync } from "fs";
import { transformSync } from "esbuild";

const orders = readFileSync("src/convex/orders.ts", "utf8");
const admin = readFileSync("src/components/eden/admin/AdminOrders.tsx", "utf8");

function slice(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`start marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error(`end marker not found: ${endMarker}`);
  return src.slice(start, end).trimEnd();
}

/**
 * Strips the TypeScript types so the extracted code can be evaluated as-is.
 * `export` is removed too — these are loaded into a function body, not a module.
 */
function compile(fnSource: string): string {
  return transformSync(fnSource, { loader: "ts" }).code.replace(/^export /gm, "");
}

const toAmountSrc = slice(orders, "function toAmount(", "async function analyzeWithGemini(");
const resolveSrc = slice(orders, "function resolvePaidAmount(", "/**\n * Coerces whatever");
const coupons = readFileSync("src/convex/coupons.ts", "utf8");
// Starts at the constants so MAX_DISCOUNT_RATIO travels with the functions.
const couponSrc = slice(coupons, "/** A coupon never takes an order below zero.", "/** Human label");
const stateSrc = slice(admin, "function paymentState(", "const STATUS_STYLES");

const { toAmount, resolvePaidAmount } = new Function(
  `${compile(toAmountSrc)}\n${compile(resolveSrc)}\nreturn { toAmount, resolvePaidAmount };`,
)();

const { normalizeCode, discountFor } = new Function(
  `${compile(couponSrc)}\nreturn { normalizeCode, discountFor };`,
)();

const compiledState = compile(stateSrc);
const loaded = new Function(`${compiledState}\nreturn paymentState;`)();
if (typeof loaded !== "function") {
  console.log("---- paymentState source ----\n" + compiledState);
  throw new Error("paymentState failed to load: " + typeof loaded);
}
const paymentState = loaded as (o: unknown) => Record<string, unknown>;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`,
  );
}

console.log("--- toAmount: model answers in the shapes it actually uses ---");
check('"55" -> 55', toAmount("55"), 55);
check('"Rs 55.00" -> 55', toAmount("₹55.00"), 55);
check('"1,999" -> 1999', toAmount("1,999"), 1999);
check("55 (number) -> 55", toAmount(55), 55);
check('"" -> null (unreadable)', toAmount(""), null);
check("null -> null", toAmount(null), null);
check('"not visible" -> null', toAmount("not visible"), null);

console.log("\n--- resolvePaidAmount: the reported Rs 55 vs Rs 1,999 case ---");
const order = { totalPrice: 1999 };

check(
  "AI read 55 -> short by 1,944, source ai",
  resolvePaidAmount(order, { declaredAmount: undefined }, { paidAmount: 55 }),
  { paidAmount: 55, shortBy: 1944, paidSource: "ai" },
);
check(
  "no review at all -> unknown, NOT short by 1,999",
  resolvePaidAmount(order, {}, undefined),
  { paidAmount: null, shortBy: null, paidSource: "unknown" },
);
check(
  "AI read nothing -> unknown, NOT short by 1,999",
  resolvePaidAmount(order, {}, { paidAmount: undefined }),
  { paidAmount: null, shortBy: null, paidSource: "unknown" },
);
check(
  "client claims 1,999 but receipt read 55 -> AI wins, short 1,944",
  resolvePaidAmount(order, { declaredAmount: 1999 }, { paidAmount: 55 }),
  { paidAmount: 55, shortBy: 1944, paidSource: "ai" },
);
check(
  "no AI read, client declared 55 -> short 1,944 from the claim",
  resolvePaidAmount(order, { declaredAmount: 55 }, undefined),
  { paidAmount: 55, shortBy: 1944, paidSource: "declared" },
);
check(
  "paid in full -> shortBy 0",
  resolvePaidAmount(order, {}, { paidAmount: 1999 }),
  { paidAmount: 1999, shortBy: 0, paidSource: "ai" },
);

console.log("\n--- paymentState: what the board is allowed to say ---");
const s1 = paymentState({ ...order, status: "pending", paidAmount: 55, shortBy: 1944, paidSource: "ai" });
check("55 read -> short, unpaid", [s1.short, s1.paid, s1.known], [true, false, true]);

const s2 = paymentState({ ...order, status: "pending", paidAmount: null, shortBy: null, paidSource: "unknown" });
check("nothing read -> NOT short, unverified", [s2.short, s2.paid, s2.known], [false, false, false]);

const s3 = paymentState({ ...order, status: "approved", paidAmount: null, shortBy: null, paidSource: "unknown" });
check("approved order -> paid regardless", [s3.short, s3.paid], [false, true]);

console.log("\n--- coupons: code normalisation ---");
check('" eden20 " -> "EDEN20"', normalizeCode(" eden20 "), "EDEN20");
check('"Eden 20" -> "EDEN20"', normalizeCode("Eden 20"), "EDEN20");

console.log("\n--- coupons: discount pricing ---");
check("flat 500 off a 1,999 order", discountFor({ kind: "flat", value: 500 }, 1999), 500);
check("10% off a 1,999 order", discountFor({ kind: "percent", value: 10 }, 1999), 200);
check("10% off 55", discountFor({ kind: "percent", value: 10 }, 55), 6);
check("flat 5,000 capped at the order total", discountFor({ kind: "flat", value: 5000 }, 1999), 1999);
check("never negative", discountFor({ kind: "flat", value: 100 }, 0), 0);
check("percent of zero is zero", discountFor({ kind: "percent", value: 50 }, 0), 0);

console.log("\n--- chat: which side of the thread a message belongs to ---");
const chat = readFileSync("src/convex/chat.ts", "utf8");
const studioRoleSrc = slice(chat, "function isStudioRole(", "/** Live message thread");
const studioRoleFn = new Function(`${compile(studioRoleSrc)}\nreturn isStudioRole;`)();
const isStudioRole = studioRoleFn as (role: string | undefined) => boolean;

// Regression: the side used to be derived from session ownership, so a manager
// replying inside their own session was labelled "client" and both messages
// rendered in the same column.
check("manager -> studio side", isStudioRole("manager"), true);
check("super_owner -> studio side", isStudioRole("super_owner"), true);
check("customer -> client side", isStudioRole("customer"), false);
check("no role yet -> client side", isStudioRole(undefined), false);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);