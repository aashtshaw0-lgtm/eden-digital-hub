import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";
import { enforceRateLimit } from "./lib/rateLimit";
import { recordRedemption, resolveForOrder } from "./coupons";
import {
  MAX_CART_LINES,
  allocateProportionally,
  distributeDiscount,
} from "./lib/money";
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
    // A review that could not read the amount is worth retrying — clearing it
    // here is what lets a re-scan replace a failed read instead of the row
    // sticking forever on "amount not legible".
    if (already?.readFailed) await ctx.db.delete(already._id);
    else if (already) return { queued: false as const, reviewId: already._id };

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
    if (already && !already.readFailed) return already._id;
    if (already) await ctx.db.delete(already._id);

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
      readFailed: review.readFailed,
      reviewedAt: Date.now(),
    });
  },
});

/**
 * Stores a proof image supplied as raw bytes and returns its storage id.
 *
 * Only actions can write to storage, and this exists because the signed upload
 * URL is a cross-origin POST that an embedding preview frame can block. When
 * that route fails the client sends compressed bytes here instead, so checkout
 * is never dead in the water over a blocked request.
 */
export const storeProofBytes = action({
  args: { bytes: v.bytes() },
  handler: async (ctx, { bytes }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to attach a payment proof.");
    if (bytes.byteLength === 0) throw new Error("That image came through empty.");
    if (bytes.byteLength > 1_500_000) {
      throw new Error("Image is too large even after compression — try a smaller screenshot.");
    }
    // Actions have no db, so the per-account limiter (which needs one) can't
    // run here; the size ceiling plus auth are the guardrails.
    return await ctx.storage.store(
      new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    );
  },
});

/**
 * Creates an order together with its payment proof.
 *
 * The client must submit the screenshot and the UTR *before* the order is
 * created, so both land in one transaction: a client can never leave an order
 * behind without the evidence needed to review it.
 */
export const createWithProof = mutation({
  args: {
    serviceId: v.id("services"),
    tierId: v.id("serviceTiers"),
    requirements: v.any(),
    clientName: v.string(),
    clientEmail: v.string(),
    clientWhatsapp: v.string(),
    tipAmount: v.optional(v.number()),
    storageId: v.id("_storage"),
    utr: v.string(),
    txnId: v.optional(v.string()),
    declaredAmount: v.optional(v.number()),
    payerName: v.optional(v.string()),
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in to place an order.");
    await enforceRateLimit(ctx, { name: "orderCreate", key: userId, max: 10, windowMs: 3600_000 });

    const tier = await ctx.db.get(args.tierId);
    if (!tier || tier.serviceId !== args.serviceId) throw new Error("Invalid tier selected.");
    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Invalid service selected.");

    const utr = args.utr.trim();
    if (utr.length < 4) throw new Error("Enter the UPI reference / UTR from your payment app.");

    // The proof normally arrives via a storage upload URL, but that POST can be
    // blocked by an embedding iframe. `storeProofBytes` (an action, since only
    // actions can write storage) provides the fallback id.
    if (!args.storageId) throw new Error("Attach your payment screenshot.");
    const storageId: Id<"_storage"> = args.storageId;

    const tip = Math.max(0, args.tipAmount ?? 0);

    // The discount is derived here from the stored code, never taken from the
    // client, so it cannot be inflated or replayed.
    const subtotal = tier.basePrice + tip;
    let couponApplied: { couponId: Id<"coupons">; discount: number; label: string } | null =
      null;
    if (args.couponCode && args.couponCode.trim() !== "") {
      couponApplied = await resolveForOrder(ctx, {
        code: args.couponCode,
        userId,
        subtotal,
      });
    }

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
      totalPrice: Math.max(0, subtotal - (couponApplied?.discount ?? 0)),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("paymentProofs", {
      orderId,
      storageId,
      utr,
      txnId: args.txnId?.trim() || undefined,
      declaredAmount: args.declaredAmount,
      payerName: args.payerName?.trim() || undefined,
      uploadedAt: now,
    });

    // Recorded in the same transaction as the order so usage counts are exact
    // and a coupon can never be spent on an order that was not created.
    if (couponApplied) {
      await recordRedemption(ctx, {
        couponId: couponApplied.couponId,
        userId,
        discount: couponApplied.discount,
        orderId,
      });
    }

    // A qualifying tip grants the credit straight away.
    if (tip > 0) {
      await grantCreditForTip(ctx, { order: (await ctx.db.get(orderId))!, tipAmount: tip });
    }
    return orderId;
  },
});

/**
 * Places a whole cart in one transaction.
 *
 * The single-item `createWithProof` above is still correct for one line, but a
 * cart of N lines used to call it N times with the same tip and the same coupon
 * code. That charged the tip N times, applied the discount once per line, and —
 * because `maxPerClient` defaults to one — made the second line throw "you have
 * already used this coupon" *after* the first order was already committed, so
 * the client had paid and the studio held half an order.
 *
 * Here the tip and the coupon are each resolved once against the cart total and
 * then allocated across the lines, so the order totals sum to exactly what the
 * client was shown on the checkout receipt.
 */
export const createCartWithProof = mutation({
  args: {
    items: v.array(
      v.object({
        serviceId: v.id("services"),
        tierId: v.id("serviceTiers"),
        requirements: v.any(),
      }),
    ),
    clientName: v.string(),
    clientEmail: v.string(),
    clientWhatsapp: v.string(),
    tipAmount: v.optional(v.number()),
    storageId: v.id("_storage"),
    utr: v.string(),
    txnId: v.optional(v.string()),
    declaredAmount: v.optional(v.number()),
    payerName: v.optional(v.string()),
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in to place an order.");
    if (args.items.length === 0) throw new Error("Your cart is empty.");
    if (args.items.length > MAX_CART_LINES) {
      throw new Error(`Please place at most ${MAX_CART_LINES} items per order.`);
    }
    // One rate-limit unit per cart, not per line, so a legitimate multi-item
    // checkout cannot exhaust the budget it is entitled to.
    await enforceRateLimit(ctx, { name: "orderCreate", key: userId, max: 10, windowMs: 3600_000 });

    const utr = args.utr.trim();
    if (utr.length < 4) throw new Error("Enter the UPI reference / UTR from your payment app.");

    // Validate every line before writing anything, so a bad tier on line three
    // cannot leave lines one and two committed.
    const lines: {
      tier: Doc<"serviceTiers">;
      service: Doc<"services">;
      requirements: unknown;
      gross: number;
    }[] = [];
    for (const item of args.items) {
      const tier = await ctx.db.get(item.tierId);
      if (!tier || tier.serviceId !== item.serviceId) throw new Error("Invalid tier selected.");
      const service = await ctx.db.get(item.serviceId);
      if (!service) throw new Error("Invalid service selected.");
      lines.push({
        tier,
        service,
        requirements: item.requirements,
        gross: Math.max(0, tier.basePrice),
      });
    }

    const tip = Math.max(0, args.tipAmount ?? 0);
    const itemsTotal = lines.reduce((sum, line) => sum + line.gross, 0);
    const subtotal = itemsTotal + tip;

    // Resolved once for the whole cart, against the total the client was shown.
    let couponApplied: { couponId: Id<"coupons">; discount: number; label: string } | null = null;
    if (args.couponCode && args.couponCode.trim() !== "") {
      couponApplied = await resolveForOrder(ctx, {
        code: args.couponCode,
        userId,
        subtotal,
      });
    }

    // The tip and the discount are cart-level amounts, so they are spread over
    // the lines in proportion to what each line is worth. Each part is whole
    // rupees and the parts sum back to the exact cart total.
    const tipParts = allocateProportionally(tip, lines.map((l) => l.gross));
    const grossParts = lines.map((line, i) => line.gross + tipParts[i]);
    const discountParts = distributeDiscount(
      grossParts,
      couponApplied?.discount ?? 0,
    );

    const now = Date.now();
    const orderIds: Id<"orders">[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const orderId = await ctx.db.insert("orders", {
        clientId: userId,
        serviceId: line.service._id,
        tierId: line.tier._id,
        serviceName: line.service.name,
        tierName: line.tier.name,
        requirements: line.requirements,
        clientName: args.clientName,
        clientEmail: args.clientEmail,
        clientWhatsapp: args.clientWhatsapp,
        totalPrice: Math.max(0, grossParts[i] - discountParts[i]),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      orderIds.push(orderId);

      // One proof row per order so the board can show evidence for every line,
      // all pointing at the single screenshot the client uploaded for the cart.
      await ctx.db.insert("paymentProofs", {
        orderId,
        storageId: args.storageId,
        utr,
        txnId: args.txnId?.trim() || undefined,
        declaredAmount: args.declaredAmount,
        payerName: args.payerName?.trim() || undefined,
        uploadedAt: now,
      });
    }

    // One redemption for the cart, so a single-use coupon is spent exactly once
    // no matter how many lines it covered.
    if (couponApplied) {
      await recordRedemption(ctx, {
        couponId: couponApplied.couponId,
        userId,
        discount: couponApplied.discount,
        orderId: orderIds[0],
      });
    }

    // The tip is credited once, against the first line's order, and is
    // idempotent per order so a retried cart cannot double-grant.
    if (tip > 0) {
      await grantCreditForTip(ctx, {
        order: (await ctx.db.get(orderIds[0]))!,
        tipAmount: tip,
      });
    }

    // The per-line totals are returned so the client's confirmation screen shows
    // exactly what was written, rather than re-deriving the allocation and
    // risking a receipt that does not add up to the charge.
    return lines.map((line, i) => ({
      orderId: orderIds[i],
      label: `${line.service.name} · ${line.tier.name}`,
      amount: Math.max(0, grossParts[i] - discountParts[i]),
    }));
  },
});

/** Approves an order once its proof checks out — admin only. */
export const approve = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    await ctx.db.patch(orderId, {
      status: "approved",
      rejectionReason: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Declines an order with a reason the client can read — admin only.
 *
 * Used for a short payment, a wrong proof, or anything else that means the
 * order should not proceed.
 */
export const reject = mutation({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, { orderId, reason }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    const trimmed = reason.trim();
    if (!trimmed) throw new Error("Give the client a reason for declining.");
    await ctx.db.patch(orderId, {
      status: "rejected",
      rejectionReason: trimmed,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Records that money was returned to the client — admin only. */
export const markRefunded = mutation({
  args: { orderId: v.id("orders"), amount: v.optional(v.number()) },
  handler: async (ctx, { orderId, amount }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    await ctx.db.patch(orderId, {
      refundedAmount: Math.max(0, amount ?? order.totalPrice),
      refundedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
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

/** Signed-in client's own order history, flagged with whether proof is in. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_client", (q) => q.eq("clientId", userId))
      .order("desc")
      .collect();
    return await Promise.all(
      orders.map(async (order) => {
        const proof = await ctx.db
          .query("paymentProofs")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .first();
        return { ...order, hasProof: Boolean(proof) };
      }),
    );
  },
});

/**
 * Whether the studio can actually receive a UPI payment right now.
 *
 * `settings.get` substitutes a placeholder for a missing UPI ID, which hides
 * the one thing an admin most needs to see on the order board: that clients
 * are being asked to pay an account that does not exist.
 */
export const paymentReadiness = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("globalSettings").first();
    const upiId = row?.upiId?.trim() || null;
    return {
      upiConfigured: upiId !== null,
      upiId,
      hasQr: Boolean(row?.qrStorageId),
    };
  },
});

/** Every order with client identity, proof, and AI review — admin board. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").collect();

    // Loaded in three batched reads rather than per order. The old shape made
    // one indexed query for the proof and another for its review for every row,
    // so the admin board cost 2N round-trips on a large order book.
    const [allProofs, allReviews, clients] = await Promise.all([
      ctx.db.query("paymentProofs").collect(),
      ctx.db.query("paymentReviews").collect(),
      Promise.all(
        [...new Set(orders.map((o) => o.clientId))].map((id) => ctx.db.get(id)),
      ),
    ]);
    const proofByOrder = new Map(allProofs.map((p) => [p.orderId, p]));
    const reviewByProof = new Map(allReviews.map((r) => [r.proofId, r]));
    const clientById = new Map(
      clients.filter((c) => c !== null).map((c) => [c!._id, c!]),
    );

    return await Promise.all(
      orders.map(async (order) => {
        const client = clientById.get(order.clientId) ?? null;
        const proof = proofByOrder.get(order._id) ?? null;
        const review = proof ? (reviewByProof.get(proof._id) ?? null) : null;
        const { paidAmount, shortBy, paidSource } = resolvePaidAmount(
          order,
          proof,
          review,
        );
        return {
          ...order,
          clientAccountEmail: client?.email ?? order.clientEmail,
          clientAccountName: client?.name,
          proof: proof ?? null,
          review: review ?? null,
          /**
           * What was actually paid, resolved once here so the board, the paid
           * pill, and the counts can never disagree with each other.
           */
          paidAmount,
          shortBy,
          paidSource,
          mismatch: (shortBy === null
            ? "unknown"
            : shortBy > 0
              ? "short"
              : "match") as "match" | "short" | "unknown",
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
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
  },
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
      const settings = await ctx.db.query("globalSettings").first();
      return await analyzeWithGemini(ctx, {
        imageUrl,
        order,
        expectedTotal,
        studioUpiId: settings?.upiId?.trim() || null,
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
    readFailed: true,
  };
}

interface GeminiReviewInput {
  imageUrl: string;
  order: Doc<"orders">;
  expectedTotal: number;
  studioUpiId: string | null;
}

interface GeminiReviewOutput {
  summary: string;
  stillNeeded: string[];
  paidAmount: number | null;
  expectedAmount: number;
  tipAmount: number;
  isSpeedPay: boolean;
  /** The vision call produced nothing usable — do not infer an amount. */
  readFailed: boolean;
}

/**
 * The one place that decides how much was actually paid.
 *
 * The AI read of the receipt outranks the client's typed claim, because the
 * claim is what they *say* they sent and the screenshot is what left the
 * account. `null` means genuinely unknown — no proof, no review, or a failed
 * read — and must never be flattened to zero, since a zero silently reports a
 * client who paid nothing as short by the entire order total.
 */
function resolvePaidAmount(
  order: Doc<"orders">,
  proof: Doc<"paymentProofs"> | null | undefined,
  review: Doc<"paymentReviews"> | null | undefined,
): { paidAmount: number | null; shortBy: number | null; paidSource: "ai" | "declared" | "unknown" } {
  const read = review?.paidAmount;
  const declared = proof?.declaredAmount;

  let paidAmount: number | null = null;
  let paidSource: "ai" | "declared" | "unknown" = "unknown";
  if (typeof read === "number" && Number.isFinite(read) && read >= 0) {
    paidAmount = read;
    paidSource = "ai";
  } else if (typeof declared === "number" && Number.isFinite(declared) && declared >= 0) {
    paidAmount = declared;
    paidSource = "declared";
  }

  return {
    paidAmount,
    shortBy: paidAmount === null ? null : Math.max(0, order.totalPrice - paidAmount),
    paidSource,
  };
}

/**
 * Coerces whatever the model returned into a rupee amount.
 *
 * Vision models routinely answer "55", "₹55.00" or 55 for the same field. A
 * strict `typeof === "number"` check threw all of those away and left the board
 * reporting a full-total shortfall for a receipt it had actually read, so the
 * value is parsed instead of type-gated.
 */
function toAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  // Drop currency marks, separators, and any trailing "paid"/"debited" words.
  const cleaned = value.replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  // A decimal point in Indian grouping ("1.999") is thousands, not rupees.
  return value.includes(",") || /\.\d{3}\b/.test(cleaned)
    ? Math.round(parsed)
    : Math.round(parsed * 100) / 100;
}

async function analyzeWithGemini(
  ctx: MutationCtx,
  { imageUrl, order, expectedTotal, studioUpiId }: GeminiReviewInput,
): Promise<GeminiReviewOutput> {
  const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: [
      "You are the payment-proof auditor for Eden, a design studio.",
      "Read the uploaded screenshot and extract the payer proof details.",
      "The amount actually debited is the most important field. Read it even if",
      "it is small or does not match what the client was supposed to pay.",
    ].join("\n"),
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8192,
      // Constrained decoding: without this the model answers in prose or
      // truncates mid-object, and the whole review silently degrades to
      // "amount not legible" no matter how clear the screenshot was.
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          // Text, not a number: a receipt can read "₹55.00", "55" or "1,999"
          // and the model may not be able to say "not visible" as a JSON number.
          // An empty string means unreadable, which toAmount turns into null.
          paidAmount: { type: SchemaType.STRING },
          tipAmount: { type: SchemaType.STRING },
          payerName: { type: SchemaType.STRING },
          payeeName: { type: SchemaType.STRING },
          payeeHandle: { type: SchemaType.STRING },
          channel: { type: SchemaType.STRING },
          transactionDate: { type: SchemaType.STRING },
          upiTransactionId: { type: SchemaType.STRING },
          referenceIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confidence: { type: SchemaType.STRING },
          ocrIssues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: [
          "paidAmount",
          "tipAmount",
          "payerName",
          "payeeName",
          "payeeHandle",
          "channel",
          "transactionDate",
          "upiTransactionId",
          "referenceIds",
          "confidence",
          "ocrIssues",
        ],
      },
    },
  });

  const { base64, mimeType } = await imageUrlToBase64(ctx, imageUrl);

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64,
        mimeType,
      },
    },
    {
      text: [
        "Extract the following from this payment screenshot as JSON:",
        "{",
        "  \"paidAmount\": number|null,",
        "  \"tipAmount\": number,",
        "  \"payerName\": string|null,",
        "  \"payeeName\": string|null,",
        "  \"payeeHandle\": string|null,",
        "  \"channel\": \"upi\"|\"wallet\"|\"card\"|\"netbanking\"|\"unknown\",",
        "  \"transactionDate\": string|null,",
        "  \"upiTransactionId\": string|null,",
        "  \"referenceIds\": string[],",
        "  \"confidence\": \"high\"|\"medium\"|\"low\",",
        "  \"ocrIssues\": string[]",
        "}",
        "Rules:",
        "- paidAmount is the amount actually debited, exactly as printed (e.g. \"55\" or",
        "  \"₹55.00\"). Use an empty string if the amount is not visible at all.",
        "  Never substitute the expected or billed amount for the amount paid.",
        "- tipAmount is any extra amount above the visible billed amount; empty string or 0 if none.",
        "- payerName is who SENT the money (the source account/wallet holder).",
        "  The person named next to 'to' is the RECIPIENT, not the payer - put that in payeeName.",
        "- payeeName is the person/organisation who RECEIVED the money.",
        "- payeeHandle is the receiving UPI id or wallet handle including the @suffix, or null.",
        "- channel is 'wallet' for app-to-app or wallet transfers, 'upi' for a UPI collect/pay QR,",
        "  'card' or 'netbanking' for those rails, and 'unknown' if it cannot be told apart.",
        "- transactionDate is an ISO-8601 date string if visible, else null.",
        "- upiTransactionId is the UPI reference/UTR if one is shown, else null.",
        "- referenceIds lists every id shown, including TXN IDs and UTRs.",
        "- confidence is high only if the amount and both names are clearly legible.",
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
    payeeName: unknown;
    payeeHandle: unknown;
    channel: unknown;
    transactionDate: unknown;
    upiTransactionId: unknown;
    referenceIds: unknown;
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

  const paidAmount = toAmount(parsed.paidAmount);
  const tipAmount = toAmount(parsed.tipAmount) ?? 0;
  // Empty strings are how the schema expresses "not visible".
  const nonEmpty = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };
  const payerName = nonEmpty(parsed.payerName);
  const payeeName = nonEmpty(parsed.payeeName);
  const payeeHandle = nonEmpty(parsed.payeeHandle);
  const channel = typeof parsed.channel === "string" ? parsed.channel : "unknown";
  const referenceIds = Array.isArray(parsed.referenceIds)
    ? parsed.referenceIds.filter((id): id is string => typeof id === "string")
    : [];
  const transactionDate = nonEmpty(parsed.transactionDate);
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

  // The destination handle is the real question, not the rail. App wallets such
  // as FamApp (@fam) are genuine UPI PSPs, so a transfer to the studio handle
  // is valid proof even when the sender's app calls it a wallet transfer.
  // What matters is whether the money was sent to *this* studio.
  if (payeeHandle && !studioUpiId) {
    stillNeeded.push(
      `Paid to “${payeeHandle}” but Eden has no UPI ID configured yet — set one under Website settings before approving.`,
    );
  } else if (payeeHandle && studioUpiId && !sameUpiHandle(payeeHandle, studioUpiId)) {
    stillNeeded.push(
      `Paid to “${payeeHandle}” instead of the studio UPI ID “${studioUpiId}” — the money has not reached Eden.`,
    );
  } else if (!payeeHandle && channel === "unknown") {
    stillNeeded.push(
      "Could not read the receiving UPI handle — ask the client to open the transaction details and screenshot the “Paid to” line.",
    );
  }

  if (referenceIds.length === 0) {
    stillNeeded.push(
      "No UPI reference or transaction ID is visible — ask for the transaction details screen, not just the confirmation banner.",
    );
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
      payeeName,
      payeeHandle,
      channel,
      referenceIds,
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
    readFailed: false,
  };
}

/**
 * Compares two UPI handles case-insensitively.
 *
 * Apps often render the payee with or without the surrounding name, and some
 * show the handle split across two lines, so surrounding whitespace and stray
 * whitespace inside the handle are ignored.
 */
function sameUpiHandle(a: string, b: string): boolean {
  const norm = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  return norm(a) === norm(b);
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
  payeeName,
  payeeHandle,
  channel,
  referenceIds,
  transactionDate,
  confidence,
  paidBelowTip,
  isSpeedPay,
}: {
  order: Doc<"orders">;
  paidAmount: number | null;
  tipAmount: number;
  payerName: string | null;
  payeeName: string | null;
  payeeHandle: string | null;
  channel: string;
  referenceIds: string[];
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
    parts.push(`from ${payerName}`);
  }

  if (payeeHandle || payeeName) {
    parts.push(`to ${payeeHandle ?? payeeName}`);
  }

  if (channel && channel !== "unknown") {
    parts.push(`via ${channel}`);
  }

  if (referenceIds.length > 0) {
    parts.push(`ref ${referenceIds.slice(0, 2).join(", ")}`);
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

/**
 * Sniffs the real image format from its magic bytes.
 *
 * The upload path accepts any `image/*` and the compressor returns the original
 * bytes untouched when a screenshot is already small, so a PNG or WEBP routinely
 * arrives labelled as JPEG. Telling the vision model a PNG is a JPEG makes it
 * fail to decode the receipt, which reads as "amount not legible" rather than as
 * a broken image.
 */
function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return "image/png";
  }
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length > 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  return "image/jpeg";
}

async function imageUrlToBase64(
  ctx: MutationCtx,
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Cannot download proof image: HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error("Proof image is too large (max 10 MB).");
  }
  const bytes = new Uint8Array(buffer);
  // Chunked so a multi-megabyte screenshot cannot blow the argument limit of a
  // single reduce.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return { base64: btoa(binary), mimeType: sniffImageMime(bytes) };
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
