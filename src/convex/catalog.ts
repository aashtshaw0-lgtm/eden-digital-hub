import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Public catalog: every service with its Basic/Pro/Premium tiers. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").withIndex("by_slug").collect();
    const sorted = services.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return await Promise.all(
      sorted.map(async (service) => {
        const tiers = await ctx.db
          .query("serviceTiers")
          .withIndex("by_service", (q) => q.eq("serviceId", service._id))
          .collect();
        return {
          ...service,
          tiers: tiers.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        };
      }),
    );
  },
});

const SEED_SERVICES = [
  {
    name: "Logo Design",
    slug: "logo-design",
    category: "design",
    tagline: "A mark that carries your whole story.",
    sortOrder: 1,
    tiers: [
      { name: "Basic", basePrice: 1499, sortOrder: 1, deliverables: ["1 logo concept", "PNG + JPG exports", "2 revision rounds", "3-day delivery"] },
      { name: "Pro", basePrice: 3999, sortOrder: 2, deliverables: ["3 logo concepts", "Vector source files (AI/SVG)", "Colour + mono variants", "5 revision rounds", "5-day delivery"] },
      { name: "Premium", basePrice: 7999, sortOrder: 3, deliverables: ["Unlimited concepts until it clicks", "Full brand mark suite", "Mini brand sheet (fonts & colours)", "Social avatar pack", "Priority delivery"] },
    ],
  },
  {
    name: "Poster Design",
    slug: "poster-design",
    category: "design",
    tagline: "Print-worthy posters that stop the scroll.",
    sortOrder: 2,
    tiers: [
      { name: "Basic", basePrice: 799, sortOrder: 1, deliverables: ["1 poster design", "Print-ready PDF", "1 revision round", "2-day delivery"] },
      { name: "Pro", basePrice: 1499, sortOrder: 2, deliverables: ["2 poster directions", "Social + print sizes", "Source file", "3 revision rounds"] },
      { name: "Premium", basePrice: 2499, sortOrder: 3, deliverables: ["3 poster directions", "Full campaign kit (story, feed, print)", "Motion poster variant", "Unlimited revisions"] },
    ],
  },
  {
    name: "Commercial Design",
    slug: "commercial-design",
    category: "design",
    tagline: "Ads, packaging and campaign visuals that sell.",
    sortOrder: 3,
    tiers: [
      { name: "Basic", basePrice: 2499, sortOrder: 1, deliverables: ["1 commercial creative", "Ad-ready formats", "2 revision rounds"] },
      { name: "Pro", basePrice: 5999, sortOrder: 2, deliverables: ["3 commercial creatives", "A/B variants", "Copy polish included", "Source files"] },
      { name: "Premium", basePrice: 9999, sortOrder: 3, deliverables: ["Full campaign suite (10+ assets)", "Art direction call", "Packaging-ready dielines", "Priority turnaround"] },
    ],
  },
  {
    name: "YouTube Thumbnails",
    slug: "youtube-thumbnails",
    category: "design",
    tagline: "Thumbnails engineered for the click.",
    sortOrder: 4,
    tiers: [
      { name: "Basic", basePrice: 499, sortOrder: 1, deliverables: ["1 custom thumbnail", "CTR-focused layout", "1 revision round", "24h delivery"] },
      { name: "Pro", basePrice: 899, sortOrder: 2, deliverables: ["3 thumbnail options", "Title text treatment", "Source PSD", "2 revision rounds"] },
      { name: "Premium", basePrice: 1499, sortOrder: 3, deliverables: ["5 thumbnails / month", "Channel-consistent template", "A/B test variants", "Priority 12h delivery"] },
    ],
  },
  {
    name: "Event Banners",
    slug: "event-banners",
    category: "design",
    tagline: "Backdrops, standees and digital banners.",
    sortOrder: 5,
    tiers: [
      { name: "Basic", basePrice: 999, sortOrder: 1, deliverables: ["1 banner design", "Standard size", "Print-ready file", "2 revisions"] },
      { name: "Pro", basePrice: 1999, sortOrder: 2, deliverables: ["3 banner sizes", "Backdrop + standee set", "Source files", "3 revisions"] },
      { name: "Premium", basePrice: 3499, sortOrder: 3, deliverables: ["Full event identity", "All print + digital sizes", "Stage backdrop & photo-wall", "On-call designer during the event"] },
    ],
  },
  {
    name: "Event Planning",
    slug: "event-planning",
    category: "events",
    tagline: "Concept to curtain-call, handled.",
    sortOrder: 6,
    tiers: [
      { name: "Basic", basePrice: 14999, sortOrder: 1, deliverables: ["Event concept & moodboard", "Vendor shortlist", "Run-of-show document", "Up to 50 guests"] },
      { name: "Pro", basePrice: 34999, sortOrder: 2, deliverables: ["Full planning & vendor management", "Venue coordination", "Decor & branding oversight", "Up to 200 guests", "Day-of coordination"] },
      { name: "Premium", basePrice: 74999, sortOrder: 3, deliverables: ["White-glove end-to-end production", "Artist & vendor negotiations", "Stage, AV & hospitality design", "Up to 500 guests", "Dedicated event manager"] },
    ],
  },
  {
    name: "Social Media Management",
    slug: "social-media-management",
    category: "management",
    tagline: "A feed that grows while you sleep.",
    sortOrder: 7,
    tiers: [
      { name: "Basic", basePrice: 9999, sortOrder: 1, deliverables: ["8 posts / month", "2 platforms", "Monthly content calendar", "Basic analytics report"] },
      { name: "Pro", basePrice: 19999, sortOrder: 2, deliverables: ["16 posts / month", "3 platforms", "Reels & story packs", "Community management", "Bi-weekly strategy calls"] },
      { name: "Premium", basePrice: 39999, sortOrder: 3, deliverables: ["30 posts / month", "All platforms", "Full video editing unit", "Paid-ads creative", "Dedicated manager + weekly reporting"] },
    ],
  },
];

const SEED_PORTFOLIO = [
  { title: "Aurora Coffee — Brand Identity", url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200&auto=format&fit=crop" },
  { title: "Solstice Records — Poster Series", url: "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?q=80&w=900&auto=format&fit=crop" },
  { title: "Nova Launch — Event Banner", url: "https://images.unsplash.com/photo-1531058020387-3be344556be6?q=80&w=1200&auto=format&fit=crop" },
  { title: "Fieldnotes — Editorial Design", url: "https://images.unsplash.com/photo-1493421419110-74f4e85ba126?q=80&w=900&auto=format&fit=crop" },
  { title: "Meridian — Thumbnail Pack", url: "https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?q=80&w=1200&auto=format&fit=crop" },
  { title: "Halo Fitness — Campaign", url: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=900&auto=format&fit=crop" },
];

/** Idempotent seed — safe to call on every app load; inserts only when empty. */
export const seedIfEmpty = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const servicesCount = (await ctx.db.query("services").collect()).length;
    if (servicesCount === 0) {
      for (const s of SEED_SERVICES) {
        const { tiers, ...service } = s;
        const serviceId = await ctx.db.insert("services", service);
        for (const t of tiers) {
          await ctx.db.insert("serviceTiers", { ...t, serviceId });
        }
      }
    }
    const portfolioCount = (await ctx.db.query("portfolioImages").collect()).length;
    if (portfolioCount === 0) {
      for (const p of SEED_PORTFOLIO) {
        await ctx.db.insert("portfolioImages", { ...p, createdAt: Date.now() });
      }
    }
    return null;
  },
});
