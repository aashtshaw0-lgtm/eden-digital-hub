import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";

async function viewer(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/** Client: opens (or reuses) their active support session. */
export const startSession = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await viewer(ctx);
    if (!user) throw new Error("Sign in to chat with a manager.");
    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_client", (q) => q.eq("clientId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("chatSessions", {
      clientId: user._id,
      status: "active",
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    });
  },
});

export const mySession = query({
  args: {},
  handler: async (ctx) => {
    const user = await viewer(ctx);
    if (!user) return null;
    return (
      (await ctx.db
        .query("chatSessions")
        .withIndex("by_client", (q) => q.eq("clientId", user._id))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first()) ?? null
    );
  },
});

/** Live message thread — readable by the session owner or an admin. */
export const getMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const user = await viewer(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) return [];
    if (!user) throw new Error("Unauthorized to read this conversation.");
    // RBAC: the session owner, or a manager / super owner.
    const r = user.role ?? "customer";
    const isAdmin = r === "manager" || r === "super_owner";
    if (session.clientId !== user._id && !isAdmin) {
      throw new Error("Unauthorized to read this conversation.");
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_session_created", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();
  },
});

/** Anyone in the session can post; managers see their replies live. */
export const sendMessage = mutation({
  args: { sessionId: v.id("chatSessions"), content: v.string() },
  handler: async (ctx, { sessionId, content }) => {
    const user = await viewer(ctx);
    const session = await ctx.db.get(sessionId);
    if (!user || !session) throw new Error("Unauthorized.");
    const r = user.role ?? "customer";
    const isAdmin = r === "manager" || r === "super_owner";
    if (session.clientId !== user._id && !isAdmin) {
      throw new Error("Unauthorized to post in this conversation.");
    }
    const trimmed = content.trim();
    if (!trimmed) return null;
    await ctx.db.insert("messages", {
      sessionId,
      senderId: user._id,
      senderName: user.name ?? user.email ?? "Guest",
      senderRole: session.clientId === user._id ? "client" : "manager",
      content: trimmed.slice(0, 2000),
      createdAt: Date.now(),
    });
    const patch: { lastMessageAt: number; lastMessage: string; status?: "active" } = {
      lastMessageAt: Date.now(),
      lastMessage: trimmed.slice(0, 120),
    };
    if (session.status === "resolved" && session.clientId === user._id) {
      patch.status = "active";
    }
    await ctx.db.patch(sessionId, patch);
    return null;
  },
});

/** Admin inbox: every session with the client's identity, newest activity first. */
export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const sessions = await ctx.db.query("chatSessions").collect();
    return await Promise.all(
      sessions.map(async (session) => {
        const client = await ctx.db.get(session.clientId);
        return {
          _id: session._id,
          status: session.status ?? "active",
          createdAt: session.createdAt,
          lastMessageAt: session.lastMessageAt,
          lastMessage: session.lastMessage,
          clientEmail: client?.email ?? "unknown",
          clientName: client?.name ?? client?.email ?? "Guest",
        };
      }),
    );
  },
});

export const setSessionStatus = mutation({
  args: { sessionId: v.id("chatSessions"), status: v.union(v.literal("active"), v.literal("resolved")) },
  handler: async (ctx, { sessionId, status }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(sessionId, { status });
    return null;
  },
});
