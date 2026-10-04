import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ── Eden roles (native, app-level RBAC — equivalent of the SQL user_role enum)
export const ROLES = {
  CUSTOMER: "customer",
  MANAGER: "manager",
  SUPER_OWNER: "super_owner",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.CUSTOMER),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.SUPER_OWNER),
);
export type Role = Infer<typeof roleValidator>;

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("completed"),
);
export type OrderStatus = Infer<typeof orderStatusValidator>;

export const chatStatusValidator = v.union(
  v.literal("active"),
  v.literal("resolved"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // profiles — linked 1:1 with auth users (equivalent of public.profiles)
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // do not remove
      isAnonymous: v.optional(v.boolean()), // do not remove
      role: v.optional(roleValidator), // defaults to "customer" via effectiveRole()
    }).index("email", ["email"]), // do not remove or modify

    // CMS singleton row (equivalent of public.global_settings id=1)
    globalSettings: defineTable({
      primaryColor: v.optional(v.string()),
      backgroundColor: v.optional(v.string()),
      upiId: v.optional(v.string()),
      qrStorageId: v.optional(v.id("_storage")),
      socialLinks: v.optional(
        v.object({
          instagram: v.optional(v.string()),
          twitter: v.optional(v.string()),
          behance: v.optional(v.string()),
          linkedin: v.optional(v.string()),
        }),
      ),
      updatedAt: v.optional(v.number()),
    }),

    // storefront
    services: defineTable({
      name: v.string(),
      slug: v.string(),
      category: v.string(), // "design" | "events" | "management"
      tagline: v.optional(v.string()),
      icon: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      sortOrder: v.optional(v.number()),
    }).index("by_slug", ["slug"]),

    serviceTiers: defineTable({
      serviceId: v.id("services"),
      name: v.string(), // Basic | Pro | Premium
      basePrice: v.number(),
      deliverables: v.array(v.string()),
      sortOrder: v.optional(v.number()),
    }).index("by_service", ["serviceId"]),

    // orders — requirements holds the dynamic intake form answers (JSONB equivalent)
    orders: defineTable({
      clientId: v.id("users"),
      serviceId: v.id("services"),
      tierId: v.id("serviceTiers"),
      serviceName: v.string(),
      tierName: v.string(),
      requirements: v.any(),
      clientName: v.string(),
      clientEmail: v.string(),
      clientWhatsapp: v.string(),
      totalPrice: v.number(),
      status: v.optional(orderStatusValidator),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
      .index("by_client", ["clientId"])
      .index("by_status_created", ["status", "createdAt"]),

    // hybrid chat — live manager conversations
    chatSessions: defineTable({
      clientId: v.id("users"),
      status: v.optional(chatStatusValidator),
      createdAt: v.optional(v.number()),
      lastMessageAt: v.optional(v.number()),
      lastMessage: v.optional(v.string()),
    })
      .index("by_client", ["clientId"])
      .index("by_status", ["status"]),

    messages: defineTable({
      sessionId: v.id("chatSessions"),
      senderId: v.optional(v.id("users")),
      senderName: v.optional(v.string()),
      senderRole: v.optional(v.string()), // "client" | "manager"
      content: v.string(),
      createdAt: v.optional(v.number()),
    }).index("by_session_created", ["sessionId", "createdAt"]),

    // portfolio gallery
    portfolioImages: defineTable({
      title: v.optional(v.string()),
      url: v.optional(v.string()), // external (seeded) or resolved storage URL
      storageId: v.optional(v.id("_storage")),
      createdAt: v.optional(v.number()),
    }),

    // abuse protection — one row per (limit name, caller key); count resets each window
    rateLimits: defineTable({
      name: v.string(), // which limit, e.g. "chatSend"
      key: v.string(), // caller identity, e.g. user id
      count: v.number(),
      windowStart: v.number(),
    }).index("by_name_key", ["name", "key"]),

    // payment proof uploaded by the client before marking an order paid
    paymentProofs: defineTable({
      orderId: v.id("orders"),
      storageId: v.id("_storage"),
      uploadedAt: v.number(),
    }).index("by_order", ["orderId"]),

    // AI review of a payment proof: what is still missing + risk signals
    paymentReviews: defineTable({
      proofId: v.id("paymentProofs"),
      summary: v.optional(v.string()),
      stillNeeded: v.optional(v.array(v.string())),
      paidAmount: v.optional(v.number()),
      expectedAmount: v.optional(v.number()),
      tipAmount: v.optional(v.number()),
      isSpeedPay: v.optional(v.boolean()),
      reviewedAt: v.optional(v.number()),
    }).index("by_proof", ["proofId"]),

    // credit ledger — names + greatness descriptions editable by admin
    credits: defineTable({
      name: v.string(),
      greatness: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_name", ["name"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
