import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/rbac";
import { enforceRateLimit } from "./lib/rateLimit";

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

/**
 * Whether a user id belongs to the studio side of the conversation.
 *
 * Role, not session ownership: a manager replying inside their own support
 * session is still the studio, and keying off ownership mislabels those
 * replies as client messages.
 */
function isStudioRole(role: string | undefined): boolean {
  return role === "manager" || role === "super_owner";
}

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
    const isAdmin = isStudioRole(r);
    if (session.clientId !== user._id && !isAdmin) {
      throw new Error("Unauthorized to read this conversation.");
    }
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_session_created", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();

    // The side is re-derived from each sender's actual role on read, so any
    // message stored under the old ownership-based rule corrects itself
    // without a migration.
    const roleCache = new Map<string, boolean>();
    return await Promise.all(
      rows.map(async (message) => {
        let studio = false;
        if (message.senderId) {
          const key = message.senderId;
          const cached = roleCache.get(key);
          if (cached === undefined) {
            const sender = await ctx.db.get(message.senderId);
            studio = isStudioRole(sender?.role);
            roleCache.set(key, studio);
          } else {
            studio = cached;
          }
        }
        return { ...message, senderRole: studio ? "manager" : "client" };
      }),
    );
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
    const isAdmin = isStudioRole(r);
    if (session.clientId !== user._id && !isAdmin) {
      throw new Error("Unauthorized to post in this conversation.");
    }
    const trimmed = content.trim();
    if (!trimmed) return null;
    // Abuse protection: managers included, so a compromised admin can't flood either.
    await enforceRateLimit(ctx, { name: "chatSend", key: user._id, max: 20, windowMs: 60_000 });
    await ctx.db.insert("messages", {
      sessionId,
      senderId: user._id,
      senderName: user.name ?? user.email ?? "Guest",
      // Role decides the side of the thread, so a manager replying in their own
      // session does not render as a client message.
      senderRole: isAdmin ? "manager" : "client",
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
