import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";
import { enforceRateLimit } from "./lib/rateLimit";
import {
  PREMIUM_THRESHOLD as PREMIUM_TIP_THRESHOLD,
  tierFor as tipTierFor,
} from "./credits";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Expected env var shape for the Gemini Vision OCR/analysis action.
 *
 * When `GEMINI_API_KEY` is present in the Keys tab, `reviewProof` calls Gemini
 * to read the uploaded payer-proof screenshot and extract payment details.
 * Until then, the admin board still gets a safe human-friendly review so the
 * paid / speed-pay / low-tip alerts can be demoed immediately.
 */
const GEMINI_MODEL = "gemini-2.5-flash";

/** Short-lived upload URL for intake reference files (signed-in clients). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to attach reference files.");
    // Storage uploads cost real bytes — keep them bounded per account.
    await enforceRateLimit(ctx, { name: "uploadUrl", key: userId, max: 30, windowMs: 3600_000 });
    return await ctx.storage.generateUploadUrl();
  },
});

/** Upload URL for a client proof of payment attached to a pending order. */
export const generateProofUrl = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to attach a payment proof.");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status !== "pending") throw new Error("Only pending orders can receive a payment proof.");
    // The owner can upload their own proof; an admin can attach one on their behalf
    // after the client sends it over WhatsApp.
    if (order.clientId !== userId) {
      await requireAdmin(ctx);
    } else {
      await enforceRateLimit(ctx, { name: "proofUpload", key: userId, max: 20, windowMs: 3600_000 });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach a payer proof image to an order. */
export const attachProof = mutation({
  args: { orderId: v.id("orders"), storageId: v.id("_storage") },
  handler: async (ctx, { orderId, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to attach a payment proof.");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status !== "pending") throw new Error("Only pending orders can receive a payment proof.");
    if (order.clientId !== userId) {
      await requireAdmin(ctx);
    }
    const existing = await ctx.db
      .query("paymentProofs")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .first();
    if (existing) throw new Error("A payment proof is already attached to this order.");
    const proofId = await ctx.db.insert("paymentProofs", {
      orderId,
      storageId,
      uploadedAt: Date.now(),
    });
    return proofId;
  },
});

/**
 * Queues the AI review of an uploaded proof.
 *
 * The Gemini vision call can take several seconds, which would eat a
 * mutation's time budget, so this mutation only validates the request and
 * schedules `analyzePaymentProofJob` to do the slow work. The admin board
 * reacts when the review row lands (the `listAll` query is reactive).
 */
export const reviewProof = mutation({
  args: { proofId: v.id("paymentProofs") },
  handler: async (ctx, { proofId }) => {
    await requireAdmin(ctx);
    const proof = await ctx.db.get(proofId);
    if (!proof) throw new Error("Payment proof not found.");

    const already = await ctx.db
      .query("paymentReviews")
      .withIndex("by_proof", (q) => q.eq("proofId", proofId))
      .first();
    if (already) return { queued: false as const, reviewId: already._id };

    // Fail fast on a missing image or order rather than inside the job.
    const url = await ctx.storage.getUrl(proof.storageId);
    if (!url) throw new Error("Proof image is not reachable.");
    const order = await ctx.db.get(proof.orderId);
    if (!order) throw new Error("Attached order not found.");

    await ctx.scheduler.runAfter(
      0,
      internal.orders.analyzePaymentProofJob,
      { proofId },
    );

    return { queued: true as const, reviewId: null };
  },
});

/**
 * The slow half of the proof review, run on the scheduler so the vision call
 * is never inside the admin's mutation. If Gemini is slow, missing, or
 * unhappy, it still writes a safe human-review checklist rather than leaving
 * the row empty.
 */
export const analyzePaymentProofJob = internalMutation({
  args: { proofId: v.id("paymentProofs") },
  handler: async (ctx, { proofId }) => {
    const proof = await ctx.db.get(proofId);
    if (!proof) return null;

    const already = await ctx.db
      .query("paymentReviews")
      .withIndex("by_proof", (q) => q.eq("proofId", proofId))
      .first();
    if (already) return already._id;

    const url = await ctx.storage.getUrl(proof.storageId);
    if (!url) throw new Error("Proof image is not reachable.");
    const order = await ctx.db.get(proof.orderId);
    if (!order) throw new Error("Attached order not found.");

    const review = await analyzePaymentProof(ctx, { imageUrl: url, order });

    return await ctx.db.insert("paymentReviews", {
      proofId,
      summary: review.summary,
      stillNeeded: review.stillNeeded,
      paidAmount: review.paidAmount ?? undefined,
      expectedAmount: review.expectedAmount,
      tipAmount: review.tipAmount,
      isSpeedPay: review.isSpeedPay,
      reviewedAt: Date.now(),
    });
  },
});

/** Creates an order after manual UPI payment. Price is re-derived from the tier server-side. */
export const create = mutation({
  args: {
    serviceId: v.id("services"),
    tierId: v.id("serviceTiers"),
    requirements: v.any(),
    clientName: v.string(),
    clientEmail: v.string(),
    clientWhatsapp: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in to place an order.");
    // Order spam protection: generous for real clients, hostile to junk floods.
    await enforceRateLimit(ctx, { name: "orderCreate", key: userId, max: 10, windowMs: 3600_000 });
    const tier = await ctx.db.get(args.tierId);
    if (!tier || tier.serviceId !== args.serviceId) throw new Error("Invalid tier selected.");
    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Invalid service selected.");

    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      clientId: userId,
      serviceId: args.serviceId,
      tierId: args.tierId,
      serviceName: service.name,
      tierName: tier.name,
      requirements: args.requirements,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      clientWhatsapp: args.clientWhatsapp,
      totalPrice: tier.basePrice,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return orderId;
  },
});

/** Signed-in client's own order history. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", userId))
      .order("desc")
      .collect();
  },
});

/** Every order with client identity, proof, and AI review — admin board. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").collect();
    return await Promise.all(
      orders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        const proof = await ctx.db
          .query("paymentProofs")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .first();
        const review = proof
          ? await ctx.db
              .query("paymentReviews")
              .withIndex("by_proof", (q) => q.eq("proofId", proof._id))
              .first()
          : undefined;
        return {
          ...order,
          clientAccountEmail: client?.email ?? order.clientEmail,
          clientAccountName: client?.name,
          proof: proof ?? null,
          review: review ?? null,
        };
      }),
    );
  },
});

/**
 * Record a customer tip attached to an order.
 *
 * A tip that clears the premium threshold (or the legendary one) also grants a
 * credit automatically, so contributing at checkout is enough to land on the
 * credits wall — no admin step required. The credit is idempotent per order.
 */
export const recordTip = mutation({
  args: { orderId: v.id("orders"), tipAmount: v.number() },
  handler: async (ctx, { orderId, tipAmount }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to add a tip.");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.clientId !== userId) throw new Error("You can only tip your own orders.");
    if (tipAmount < 0) throw new Error("Tip cannot be negative.");
    await ctx.db.patch(orderId, {
      totalPrice: order.totalPrice + tipAmount,
      updatedAt: Date.now(),
    });

    const granted = await grantCreditForTip(ctx, { order, tipAmount });
    return { creditGranted: granted };
  },
});

/** Confirm payment on an order after a human review of the proof. */
export const confirmPayment = mutation({
  args: {
    orderId: v.id("orders"),
    paidAmount: v.number(),
    reviewedProofId: v.id("paymentProofs"),
  },
  handler: async (ctx, { orderId, paidAmount, reviewedProofId }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    const review = await ctx.db
      .query("paymentReviews")
      .withIndex("by_proof", (q) => q.eq("proofId", reviewedProofId))
      .first();
    if (!review) throw new Error("Please review the proof before confirming payment.");
    const attachedProof = await ctx.db
      .query("paymentProofs")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .first();
    if (attachedProof?._id !== reviewedProofId) {
      // safety tie-break: the reviewed proof must be the one attached to this order
      throw new Error("The reviewed proof is not attached to this order.");
    }
    const expectedTotal = order.totalPrice;
    await ctx.db.patch(orderId, {
      status: "approved",
      updatedAt: Date.now(),
    });
    return {
      orderId,
      paidAmount,
      expectedTotal,
      tipAmount: review.tipAmount,
      isSpeedPay: review.isSpeedPay,
      stillNeeded: review.stillNeeded,
    };
  },
});

/** Status transition — admin only. */
export const updateStatus = mutation({
  args: { orderId: v.id("orders"), status: v.union(v.literal("pending"), v.literal("approved"), v.literal("completed")) },
  handler: async (ctx, { orderId, status }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    await ctx.db.patch(orderId, { status, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Grants a credit when a tip clears the premium/legendary threshold.
 *
 * Kept server-side next to `recordTip` so the tier gate can't be bypassed from
 * the client. Idempotent per order — re-tipping updates the same entry rather
 * than duplicating the name.
 */
async function grantCreditForTip(
  ctx: MutationCtx,
  args: { order: Doc<"orders">; tipAmount: number },
): Promise<boolean> {
  const { order, tipAmount } = args;
  if (tipAmount < PREMIUM_TIP_THRESHOLD) return false;

  const existing = await ctx.db
    .query("credits")
    .withIndex("by_source_order", (q) => q.eq("sourceOrderId", order._id))
    .first();

  const tier = tipTierFor(tipAmount);
  const fields = {
    name: order.clientName,
    greatness:
      tier === "legendary"
        ? "Legendary supporter — carried the studio."
        : "Premium supporter — tipped above the tier line.",
    amount: tipAmount,
    tier,
    sourceOrderId: order._id,
    autoGranted: true,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return true;
  }

  await ctx.db.insert("credits", { ...fields, createdAt: Date.now() });
  return true;
}

/** Payment-proof OCR + AI analysis.
 *
 * When `GEMINI_API_KEY` is configured in the Keys tab, this action calls
 * Gemini Vision to read the uploaded payer-proof screenshot and extract the
 * paid amount, tip, payer identity, and speed-pay signals. The result feeds
 * the admin order board: paid status, still-needed checklist, and AI alerts
 * (speed-pay, paid below tip).
 *
 * Without the key, the admin board still behaves correctly — it shows a
 * careful human review checklist so nothing is approved blindly.
 */
async function analyzePaymentProof(
  ctx: MutationCtx,
  args: { imageUrl: string; order: Doc<"orders"> },
) {
  const { order, imageUrl } = args;
  const expectedTotal = order.totalPrice;

  if (GEMINI_API_KEY) {
    try {
      return await analyzeWithGemini(ctx, {
        imageUrl,
        order,
        expectedTotal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("API key")) {
        throw new Error(
          `Gemini is configured, but the API key is not accepted: ${message}`,
        );
      }
      // Any transient vision failure falls back to the safe human checklist below.
      console.warn("[analyzePaymentProof] Gemini failed, using safe review:", message);
    }
  }

  // Safe fallback: never auto-approve; ask the admin to verify the receipt.
  return {
    summary: `Proof uploaded for “${order.serviceName} · ${order.tierName}” — review the receipt before approving.`,
    stillNeeded: [
      `Confirm the ₹${expectedTotal.toLocaleString("en-IN")} UPI receipt for ${order.clientName}`,
      "Match the payer name on the screenshot to the client name on the order",
      "Verify the transaction date is today or yesterday",
    ],
    paidAmount: null,
    expectedAmount: expectedTotal,
    tipAmount: 0,
    isSpeedPay: false,
  };
}

interface GeminiReviewInput {
  imageUrl: string;
  order: Doc<"orders">;
  expectedTotal: number;
}

interface GeminiReviewOutput {
  summary: string;
  stillNeeded: string[];
  paidAmount: number | null;
  expectedAmount: number;
  tipAmount: number;
  isSpeedPay: boolean;
}

async function analyzeWithGemini(
  ctx: MutationCtx,
  { imageUrl, order, expectedTotal }: GeminiReviewInput,
): Promise<GeminiReviewOutput> {
  const vision = await import("@google/generative-ai").then((m) =>
    m.GoogleGenerativeAI
  );
  const genAI = new vision(GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: [
      "You are the payment-proof auditor for Eden, a design studio.",
      "Read the uploaded screenshot and extract the payer proof details.",
      "Respond with JSON only, no other text.",
    ].join("\n"),
  });

  const result = await model.generateContent([
    {
      inlineData: {
        data: await imageUrlToBase64(ctx, imageUrl),
        mimeType: "image/jpeg",
      },
    },
    {
      text: [
        "Extract the following from this payment receipt screenshot as JSON:",
        "{",
        "  \"paidAmount\": number|null,",
        "  \"tipAmount\": number,",
        "  \"payerName\": string|null,",
        "  \"transactionDate\": string|null,",
        "  \"upiTransactionId\": string|null,",
        "  \"confidence\": \"high\"|\"medium\"|\"low\",",
        "  \"ocrIssues\": string[]",
        "}",
        "Rules:",
        "- paidAmount is the total debited in INR, or null if unreadable.",
        "- tipAmount is any extra amount above the visible billed amount; if none is visible, 0.",
        "- payerName is the UPI/account name shown on the screenshot, or null.",
        "- transactionDate is an ISO-8601 date string if visible, else null.",
        "- upiTransactionId is any transaction/reference number visible, else null.",
        "- confidence is high only if the amount and payer are clearly legible.",
        "- ocrIssues lists anything unreadable or ambiguous.",
        "Do not invent values. If a field is not visible, use null or 0 as appropriate.",
      ].join("\n"),
    },
  ]);
  const text = result.response.text();

  let parsed: {
    paidAmount: unknown;
    tipAmount: unknown;
    payerName: unknown;
    transactionDate: unknown;
    upiTransactionId: unknown;
    confidence: unknown;
    ocrIssues: unknown;
  };
  try {
    const jsonChunk = text.slice(
      text.indexOf("{"),
      text.lastIndexOf("}") + 1,
    );
    parsed = JSON.parse(jsonChunk);
  } catch {
    throw new Error("Gemini returned invalid JSON for the proof image.");
  }

  const paidAmount =
    typeof parsed.paidAmount === "number" && Number.isFinite(parsed.paidAmount)
      ? parsed.paidAmount
      : null;
  const tipAmount = Math.max(0, Number(parsed.tipAmount) || 0);
  const payerName = typeof parsed.payerName === "string" ? parsed.payerName : null;
  const transactionDate = typeof parsed.transactionDate === "string" ? parsed.transactionDate : null;
  const upiTransactionId =
    typeof parsed.upiTransactionId === "string" ? parsed.upiTransactionId : null;
  const confidence = parsed.confidence as string | undefined;
  const ocrIssues = Array.isArray(parsed.ocrIssues) ? parsed.ocrIssues : [];

  const isSpeedPay = isDateWithinDays(transactionDate, -2);

  const stillNeeded: string[] = [];

  if (paidAmount === null) {
    stillNeeded.push("The paid amount is not legible on the screenshot — ask the client for a clearer receipt.");
  } else if (paidAmount < expectedTotal) {
    stillNeeded.push(
      `Screenshot shows ₹${paidAmount.toLocaleString("en-IN")} but the order total is ₹${expectedTotal.toLocaleString("en-IN")} — confirm the balance is paid.`,
    );
  }

  if (paidAmount !== null && tipAmount === 0 && paidAmount === expectedTotal) {
    stillNeeded.push("No tip was visible on the receipt — confirm whether the client intended to add one.");
  }

  if (payerName === null || !payerName.toLowerCase().includes(String(order.clientName).toLowerCase())) {
    stillNeeded.push(
      payerName
        ? `Payer name “${payerName}” does not match the client name “${order.clientName}” — confirm the payer is authorized.`
        : "No payer name could be read on the screenshot — ask the client to confirm who made the payment.",
    );
  }

  if (upiTransactionId === null) {
    stillNeeded.push("No UPI transaction ID is visible — ask for a screenshot that shows the transaction reference.");
  }

  if (confidence === "low") {
    stillNeeded.push("The receipt is low confidence for OCR — request a sharper image or a bank statement excerpt.");
  }

  if (ocrIssues.length > 0) {
    stillNeeded.push(...ocrIssues.slice(0, 3).map((issue) => `OCR issue: ${issue}`));
  }

  const paidBelowTip =
    paidAmount !== null && paidAmount < expectedTotal + tipAmount;

  return {
    summary: buildSummary({
      order,
      paidAmount,
      tipAmount,
      payerName,
      upiTransactionId,
      transactionDate,
      confidence,
      paidBelowTip,
      isSpeedPay,
    }),
    stillNeeded,
    paidAmount,
    expectedAmount: expectedTotal,
    tipAmount,
    isSpeedPay,
  };
}

function isDateWithinDays(dateString: string | null, maxDaysAgo: number): boolean {
  if (!dateString) return false;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return false;
  const cutoff = Date.now() - maxDaysAgo * 86_400_000;
  return parsed.getTime() >= cutoff;
}

function buildSummary({
  order,
  paidAmount,
  tipAmount,
  payerName,
  upiTransactionId,
  transactionDate,
  confidence,
  paidBelowTip,
  isSpeedPay,
}: {
  order: Doc<"orders">;
  paidAmount: number | null;
  tipAmount: number;
  payerName: string | null;
  upiTransactionId: string | null;
  transactionDate: string | null;
  confidence: string | undefined;
  paidBelowTip: boolean;
  isSpeedPay: boolean;
}): string {
  const parts = [
    `“${order.serviceName} · ${order.tierName}” proof reviewed`,
  ];

  if (paidAmount !== null) {
    parts.push(`₹${paidAmount.toLocaleString("en-IN")} captured`);
    if (tipAmount > 0) {
      parts.push(`incl. ₹${tipAmount.toLocaleString("en-IN")} tip`);
    }
  } else {
    parts.push("amount not legible");
  }

  if (payerName) {
    parts.push(`payer “${payerName}”`);
  }

  if (upiTransactionId) {
    parts.push(`ref ${upiTransactionId}`);
  }

  if (transactionDate) {
    parts.push(`on ${new Date(transactionDate).toLocaleDateString("en-IN")}`);
  }

  if (confidence) {
    parts.push(`OCR confidence ${confidence}`);
  }

  if (isSpeedPay) {
    parts.push("speed-pay signal");
  }

  if (paidBelowTip) {
    parts.push("paid below expected total + tip");
  }

  return parts.join(" — ") + ".";
}

async function imageUrlToBase64(
  ctx: MutationCtx,
  url: string,
): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Cannot download proof image: HTTP ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new Error("Proof image is too large (max 10 MB).");
  }
  const base64 = btoa(
    new Uint8Array(bytes).reduce(
      (acc, byte) => acc + String.fromCharCode(byte),
      "",
    ),
  );
  return base64;
}

/** Financial widget: completed orders within a window → volume, revenue, 20% cut. */
export const stats = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    await requireAdmin(ctx);
    const completed = await ctx.db
      .query("orders")
      .withIndex("by_status_created", (q) =>
        q.eq("status", "completed").gte("createdAt", from).lte("createdAt", to),
      )
      .collect();
    const revenue = completed.reduce((sum, o) => sum + o.totalPrice, 0);
    return {
      volume: completed.length,
      revenue,
      platformCut: Math.round(revenue * 0.2 * 100) / 100,
    };
  },
});
