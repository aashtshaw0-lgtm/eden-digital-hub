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

/** Strips the TypeScript types so the extracted code can be evaluated as-is. */
function compile(fnSource: string): string {
  return transformSync(fnSource, { loader: "ts" }).code;
}

const toAmountSrc = slice(orders, "function toAmount(", "async function analyzeWithGemini(");
const resolveSrc = slice(orders, "function resolvePaidAmount(", "/**\n * Coerces whatever");
const stateSrc = slice(admin, "function paymentState(", "const STATUS_STYLES");

const { toAmount, resolvePaidAmount } = new Function(
  `${compile(toAmountSrc)}\n${compile(resolveSrc)}\nreturn { toAmount, resolvePaidAmount };`,
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

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);