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
  v.literal("rejected"),
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
      /** Landing hero copy, editable from the admin console. */
      heroLead: v.optional(v.string()),
      /** "rotating" cycles the accent words; "static" shows heroAccent once. */
      heroMode: v.optional(v.union(v.literal("rotating"), v.literal("static"))),
      heroAccent: v.optional(v.string()),
      /** Words the rotating accent cycles through. */
      heroAccentWords: v.optional(v.array(v.string())),
      upiId: v.optional(v.string()),
      qrStorageId: v.optional(v.id("_storage")),
      /** Site logo (PNG/SVG/AVIF/WebP). Empty means the built Eden wordmark is used. */
      logoStorageId: v.optional(v.id("_storage")),
      /** Dark-mode variant of the site logo (optional). When set, shown on dark surfaces. */
      logoDarkStorageId: v.optional(v.id("_storage")),
      /** When no image logo is set, this word is rendered as the logo mark. */
      brandWord: v.optional(v.string()),
      /** Optional tagline shown under the brand word. */
      brandTagline: v.optional(v.string()),
      /** Logo text color for light backgrounds. */
      logoLightColor: v.optional(v.string()),
      /** Logo text color for dark backgrounds. */
      logoDarkColor: v.optional(v.string()),
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
      /** Why an admin declined this order, shown to the client. */
      rejectionReason: v.optional(v.string()),
      /** Money returned to the client, if any. */
      refundedAmount: v.optional(v.number()),
      refundedAt: v.optional(v.number()),
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

    // ── Handmade products + the people who make them with the studio ──
    /**
     * A person the studio collaborates with on a product. `sharePercent` is the
     * slice of each sale that goes to them; the studio keeps the remainder.
     */
    collaborators: defineTable({
      name: v.string(),
      /** Shown on the public product page, e.g. "@kita.studio". */
      handle: v.optional(v.string()),
      /** Short line about what they make. */
      bio: v.optional(v.string()),
      /** Default cut for their products, 0-100. */
      sharePercent: v.optional(v.number()),
      /** Contact the studio uses to pay them out. Never shown publicly. */
      payoutEmail: v.optional(v.string()),
      active: v.optional(v.boolean()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_name", ["name"]),

    /**
     * A physical product the studio sells, optionally made with a collaborator.
     *
     * `collaboratorId` is a single id, so a product can name at most **one**
     * maker — there is no way to attach a second or third person.
     *
     * `collaboratorSharePercent` and `webOwnerSharePercent` are snapshotted onto
     * the product so renegotiating a rate later never rewrites the split on
     * sales that already happened.
     */
    products: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      /** Selling price in rupees, what the customer actually pays. */
      price: v.number(),
      /** Optional maker. Undefined means the studio makes it alone. */
      collaboratorId: v.optional(v.id("collaborators")),
      /** Snapshot of the maker's cut at the time this product was saved. */
      collaboratorSharePercent: v.optional(v.number()),
      /** Snapshot of the site commission at the time this product was saved. */
      webOwnerSharePercent: v.optional(v.number()),
      imageStorageId: v.optional(v.id("_storage")),
      /** "live" shows it in the storefront; "draft" hides it. */
      status: v.optional(v.union(v.literal("draft"), v.literal("live"))),
      createdAt: v.number(),
    })
      .index("by_status_created", ["status", "createdAt"])
      .index("by_collaborator", ["collaboratorId"]),

    /**
     * One row per sale of a product, so what each collaborator earned is a fact
     * in the database rather than a number recomputed from whatever the product
     * happens to be priced at today.
     *
     * The three shares always sum to `gross`.
     */
    productSales: defineTable({
      productId: v.id("products"),
      productName: v.string(),
      collaboratorId: v.optional(v.id("collaborators")),
      collaboratorName: v.optional(v.string()),
      /** What the customer paid. */
      gross: v.number(),
      /** Rupees owed to the maker for this sale. */
      collaboratorShare: v.number(),
      /** What the studio kept. */
      studioShare: v.number(),
      /** Rupees owed to the web owner. */
      webOwnerShare: v.optional(v.number()),
      orderId: v.optional(v.id("orders")),
      createdAt: v.number(),
    })
      .index("by_collaborator_created", ["collaboratorId", "createdAt"])
      .index("by_created", ["createdAt"]),

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
      /** UPI reference / UTR the client typed in alongside the screenshot. */
      utr: v.optional(v.string()),
      /** App-level transaction ID shown in the payment app's detail view. */
      txnId: v.optional(v.string()),
      /** Amount the client claims they paid. Read from the screenshot by the studio. */
      declaredAmount: v.optional(v.number()),
      /** Name of the person who made the payment. Read from the screenshot by the studio. */
      payerName: v.optional(v.string()),
      uploadedAt: v.number(),
    }).index("by_order", ["orderId"]),

    // Studio review of a payment proof: what is still missing + risk signals
    paymentReviews: defineTable({
      proofId: v.id("paymentProofs"),
      summary: v.optional(v.string()),
      stillNeeded: v.optional(v.array(v.string())),
      paidAmount: v.optional(v.number()),
      expectedAmount: v.optional(v.number()),
      tipAmount: v.optional(v.number()),
      isSpeedPay: v.optional(v.boolean()),
      /**
       * True when the vision call could not produce a usable amount. The board
       * must show "amount not read" in this case — never treat a failed read as
       * a client who paid nothing.
       */
      readFailed: v.optional(v.boolean()),
      /**
       * Set when a human read the receipt and typed the amount in, rather than
       * the vision model doing it. A studio-recorded amount must never be
       * silently thrown away by a later re-scan.
       */
      recordedBy: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
    }).index("by_proof", ["proofId"]),

    // credit ledger — names + greatness descriptions editable by admin
    credits: defineTable({
      name: v.string(),
      /** Short "greatness" line shown on the credits page, e.g. "Legendary support". */
      greatness: v.optional(v.string()),
      /**
       * Contribution behind the tier gate. Never shown publicly — the credits
       * wall is about recognition, not receipts. Absent for marketing credits.
       */
      amount: v.optional(v.number()),
      /** Derived tier: "standard" (<100), "premium" (>=100), "legendary" (>=500). */
      tier: v.optional(v.string()),
      /**
       * "tip" for a real contribution, "marketing" for a goodwill credit the
       * studio gives out (sponsors, press, partners). Marketing entries carry
       * no amount and are labelled differently on the wall.
       */
      kind: v.optional(v.union(v.literal("tip"), v.literal("marketing"))),
      /** Order that earned this credit automatically, when tip-driven. */
      sourceOrderId: v.optional(v.id("orders")),
      /** True when the credit was created from a tip rather than by hand. */
      autoGranted: v.optional(v.boolean()),
      /**
       * Custom help text for marketing credits — lets admin describe what the
       * credit is for (e.g. "Gave food supplies to the studio kitchen"). Shown
       * on the public credits wall alongside greatness.
       */
      helpText: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_name", ["name"])
      .index("by_created", ["createdAt"])
      .index("by_source_order", ["sourceOrderId"]),

    // discount coupons — admin-issued, optionally restricted to named people
    coupons: defineTable({
      /** Uppercase code typed at checkout, e.g. "EDEN20". */
      code: v.string(),
      /** "flat" subtracts `value` rupees; "percent" takes `value`% off. */
      kind: v.union(v.literal("flat"), v.literal("percent")),
      /** Rupees for "flat", percentage 1-100 for "percent". */
      value: v.number(),
      /** Internal note, e.g. "launch week". Never shown to clients. */
      note: v.optional(v.string()),
      /** Total times this coupon may be used. Undefined means unlimited. */
      maxUses: v.optional(v.number()),
      /** Times a single client may use it. Undefined means once. */
      maxPerClient: v.optional(v.number()),
      /** When set, only these email addresses may redeem it. */
      allowedEmails: v.optional(v.array(v.string())),
      /** Set false to pause a coupon without deleting its history. */
      active: v.optional(v.boolean()),
      /** Epoch ms after which the coupon stops working. */
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_created", ["createdAt"]),

    // one row per redemption, so usage counts and per-client limits are exact
    couponRedemptions: defineTable({
      couponId: v.id("coupons"),
      userId: v.id("users"),
      /** Discount actually applied, in rupees, after the cap. */
      discount: v.number(),
      /** Order it was applied to, when known. */
      orderId: v.optional(v.id("orders")),
      createdAt: v.number(),
    })
      .index("by_coupon", ["couponId"])
      .index("by_coupon_user", ["couponId", "userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
