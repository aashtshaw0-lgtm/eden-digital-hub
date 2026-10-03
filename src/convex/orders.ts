import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

/** Short-lived upload URL for intake reference files (signed-in clients). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to attach reference files.");
    return await ctx.storage.generateUploadUrl();
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

/** Every order with client identity — admin board. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").collect();
    return await Promise.all(
      orders.map(async (order) => {
        const client = await ctx.db.get(order.clientId);
        return {
          ...order,
          clientAccountEmail: client?.email ?? order.clientEmail,
          clientAccountName: client?.name,
        };
      }),
    );
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
