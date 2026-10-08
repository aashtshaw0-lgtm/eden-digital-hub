/**
 * The site's copy deck.
 *
 * Every string the public site renders comes from here. Each entry carries the
 * wording the site ships with, so the defaults are the single source of truth
 * for both the page components (`t("home.work.title")`) and the admin editor
 * (which renders one input per field, grouped by page).
 *
 * Adding a new editable string is a one-line change: add it to a group below
 * and call `t("your.key")` where it should appear. Overrides live in the
 * `siteContent` table in Convex; keys with no row render the default here.
 */

export interface ContentField {
  key: string;
  label: string;
  /** Shipped wording. Shown as the input placeholder and used when unset. */
  default: string;
  type?: "text" | "textarea";
  hint?: string;
}

export interface ContentGroup {
  id: string;
  title: string;
  description?: string;
  fields: ContentField[];
}

/** Brand + company identity. `brand.name` is the company name, used sitewide. */
export const BRAND_FIELDS: ContentField[] = [
  {
    key: "brand.name",
    label: "Company / studio name",
    default: "Studio",
    hint: "Drives the browser tab, footer, legal pages and everywhere the studio is named.",
  },
  { key: "brand.tagline", label: "Tagline", default: "Digital design & management" },
  { key: "brand.heroBadge", label: "Home badge", default: "Design & management studio" },
  { key: "brand.footerNote", label: "Footer note", default: "Crafted slowly, delivered fast." },
  { key: "brand.madeBy", label: "Footer credit line", default: "Made by H.A.I.O.S" },
];

export const CONTENT_GROUPS: ContentGroup[] = [
  {
    id: "brand",
    title: "Company & brand",
    description: "Rename the studio once here and it changes everywhere on the site.",
    fields: BRAND_FIELDS,
  },
  {
    id: "nav",
    title: "Navigation & footer links",
    fields: [
      { key: "nav.home", label: "Home", default: "Home" },
      { key: "nav.services", label: "Services", default: "Services" },
      { key: "nav.portal", label: "Portal", default: "Portal" },
      { key: "nav.products", label: "Handmade", default: "Handmade" },
      { key: "nav.credits", label: "Credits", default: "Credits" },
      { key: "nav.checkout", label: "Checkout", default: "Checkout" },
      { key: "nav.privacy", label: "Privacy", default: "Privacy" },
      { key: "nav.terms", label: "Terms", default: "Terms" },
      { key: "nav.console", label: "Console link", default: "Console" },
    ],
  },
  {
    id: "home",
    title: "Home page",
    fields: [
      {
        key: "home.hero.subtitle",
        label: "Hero paragraph",
        type: "textarea",
        default:
          "One studio for logos, posters, thumbnails, banners and full event or social execution — every piece drawn by hand, with three honest tiers on each service and a real person one click away.",
      },
      { key: "home.hero.ctaServices", label: "Main button", default: "Explore services" },
      { key: "home.hero.ctaWork", label: "Second button", default: "See our work" },
      { key: "home.hero.ctaProducts", label: "Third button", default: "See handmade pieces" },
      { key: "home.chip.1", label: "Chip 1", default: "7 services" },
      { key: "home.chip.2", label: "Chip 2", default: "3 transparent tiers" },
      { key: "home.chip.3", label: "Chip 3", default: "UPI checkout" },
      { key: "home.chip.4", label: "Chip 4", default: "Live manager chat" },
      { key: "home.chip.5", label: "Chip 5", default: "Handmade shelf" },
      { key: "home.work.title", label: "Work section title", default: "Selected work" },
      {
        key: "home.work.subtitle",
        label: "Work section subtitle",
        type: "textarea",
        default: "A few pieces that left the studio recently — drawn by hand, one brief at a time.",
      },
      {
        key: "home.services.title",
        label: "Services section title",
        default: "Everything we make & manage",
      },
      {
        key: "home.services.subtitle",
        label: "Services section subtitle",
        default: "Pick a service, pick a tier, brief us in one form.",
      },
      { key: "home.services.cta", label: "Services section link", default: "View all services" },
      { key: "home.stat.1", label: "Stat 1 label", default: "Services on the shelf" },
      { key: "home.stat.2", label: "Stat 2 label", default: "Pieces shipped" },
      { key: "home.stat.3", label: "Stat 3 label", default: "Tiers per service" },
    ],
  },
  {
    id: "services",
    title: "Services page",
    fields: [
      { key: "services.title", label: "Page title", default: "Services & tiers" },
      {
        key: "services.subtitle",
        label: "Page subtitle",
        type: "textarea",
        default:
          "Every service ships in three tiers — Basic, Pro, Premium. Tap a card to compare tiers and brief us through a short form.",
      },
      { key: "services.cat.all", label: "Filter: all", default: "All" },
      { key: "services.cat.design", label: "Filter: design", default: "Design" },
      { key: "services.cat.events", label: "Filter: events", default: "Events" },
      { key: "services.cat.management", label: "Filter: management", default: "Management" },
      { key: "services.tiersBadge", label: "Tier badge on each card", default: "3 tiers" },
      { key: "services.from", label: "Price prefix", default: "from" },
    ],
  },
  {
    id: "products",
    title: "Handmade shelf",
    fields: [
      { key: "products.eyebrow", label: "Small label", default: "Made by hand" },
      { key: "products.title", label: "Page title", default: "The handmade shelf" },
      {
        key: "products.subtitle",
        label: "Page subtitle",
        type: "textarea",
        default:
          "Pieces made in small batches, some by us and some with the people we work alongside. Every one is finished by a pair of hands rather than a production line.",
      },
      { key: "products.madeWith", label: "\"Made with\" heading", default: "Made with" },
      { key: "products.madeWithPrefix", label: "Made-with prefix on a piece", default: "Made with" },
      { key: "products.byStudio", label: "Label for studio-made pieces", default: "Made by the studio" },
      {
        key: "products.empty",
        label: "Empty shelf message",
        default: "Nothing on the shelf just yet — check back soon.",
      },
      { key: "products.emptyCta", label: "Empty shelf link", default: "See what we do design-wise" },
    ],
  },
  {
    id: "credits",
    title: "Credits page",
    fields: [
      { key: "credits.eyebrow", label: "Small label", default: "The people who carried us" },
      { key: "credits.title", label: "Page title", default: "Credits" },
      {
        key: "credits.subtitle",
        label: "Page subtitle",
        type: "textarea",
        default:
          "The studio runs on the people who back it. Tips of {premium} and above earn a premium credit, {legendary} and above earns legendary — and the bigger the contribution, the higher the name sits. Names are shown as a first name and last initial, and the amounts stay with us. Some entries here are goodwill credits we owe our thanks to rather than payments.",
        hint: "{premium} and {legendary} are replaced with the current tip thresholds.",
      },
      {
        key: "credits.empty",
        label: "Empty wall message",
        default: "No credits yet — the first tip above {premium} claims the wall.",
      },
      { key: "credits.emptyCta", label: "Empty wall link", default: "Start a brief" },
      { key: "credits.count.one", label: "Count label (one)", default: "name" },
      { key: "credits.count.many", label: "Count label (many)", default: "names" },
    ],
  },
  {
    id: "portal",
    title: "Customer portal",
    fields: [
      { key: "portal.welcome", label: "Welcome line", default: "Welcome back" },
      { key: "portal.ordersTitle", label: "Orders heading", default: "Order history" },
      {
        key: "portal.empty",
        label: "No-orders message",
        default: "No orders yet — your briefs will live here once you check out.",
      },
      { key: "portal.emptyCta", label: "No-orders link", default: "Start a first brief" },
      { key: "portal.adminLink", label: "Console link", default: "Admin console" },
      { key: "portal.signOut", label: "Sign-out button", default: "Sign out" },
    ],
  },
  {
    id: "chat",
    title: "Live chat & assistant",
    fields: [
      { key: "chat.chooser.title", label: "Chooser heading", default: "How can we help?" },
      {
        key: "chat.instant.name",
        label: "Instant option name",
        default: "Assistant (Instant)",
      },
      {
        key: "chat.instant.desc",
        label: "Instant option description",
        default: "Pricing, tiers and turnaround — answered in seconds.",
      },
      {
        key: "chat.manager.name",
        label: "Live option name",
        default: "Talk to Manager (Live)",
      },
      {
        key: "chat.manager.desc",
        label: "Live option description",
        default: "A real human on a live channel — for quotes & custom work.",
      },
      {
        key: "chat.greeting",
        label: "Assistant greeting",
        type: "textarea",
        default:
          "Hi, I'm the studio assistant 🌿 Ask me about our services, tiers or pricing — I know the full menu.",
      },
      { key: "chat.assistant.title", label: "Assistant panel title", default: "Assistant" },
      {
        key: "chat.assistant.subtitle",
        label: "Assistant panel subtitle",
        default: "Instant · always on",
      },
      { key: "chat.manager.title", label: "Manager panel title", default: "Live Manager" },
      {
        key: "chat.manager.subtitle",
        label: "Manager panel subtitle",
        default: "Live · usually replies fast",
      },
      {
        key: "chat.manager.subtitleResolved",
        label: "Manager subtitle when resolved",
        default: "Resolved · send to reopen",
      },
      { key: "chat.connecting", label: "Connecting line", default: "Connecting…" },
      {
        key: "chat.hello",
        label: "Empty thread line",
        default: "Say hello — {you} are chatting with the {brand} team.",
      },
      {
        key: "chat.error",
        label: "Assistant error line",
        type: "textarea",
        default: "I hit a snag — please try again, or use 'Talk to Manager' for a human.",
      },
      { key: "chat.signin.title", label: "Sign-in prompt title", default: "Sign in to chat" },
      {
        key: "chat.signin.subtitle",
        label: "Sign-in prompt subtitle",
        default: "One tap · stays in your portal",
      },
      {
        key: "chat.signin.body",
        label: "Sign-in prompt body",
        type: "textarea",
        default:
          "Sign in so your chat history and replies stay with your account — it takes a few seconds.",
      },
      { key: "chat.placeholder", label: "Message box placeholder", default: "Type a message…" },
    ],
  },
  {
    id: "sheet",
    title: "Service sheet (tiers & intake form)",
    fields: [
      { key: "sheet.chooseHeading", label: "Tier step label", default: "Choose your tier" },
      {
        key: "sheet.intakeHeading",
        label: "Intake step label",
        default: "Intake · tell us everything",
      },
      { key: "sheet.backToTiers", label: "Back link", default: "Back to tiers" },
      { key: "sheet.contact", label: "Contact section label", default: "Contact" },
      { key: "sheet.designBrief", label: "Design brief section", default: "Design brief" },
      { key: "sheet.references", label: "References section", default: "References (optional)" },
      { key: "sheet.eventDetails", label: "Event details section", default: "Event details" },
      { key: "sheet.channels", label: "Channels section", default: "Channels" },
    ],
  },
  {
    id: "cookies",
    title: "Cookie banner",
    fields: [
      {
        key: "cookies.title",
        label: "Banner heading",
        default: "Only the essential cookies here",
      },
      {
        key: "cookies.body",
        label: "Banner body (before the policy link)",
        type: "textarea",
        default:
          "We use local storage for your sign-in and cart — no ad trackers, no analytics pixels. Details in the",
      },
      { key: "cookies.linkLabel", label: "Policy link text", default: "Cookie Policy" },
      { key: "cookies.accept", label: "Accept button", default: "Accept all" },
      { key: "cookies.necessary", label: "Necessary button", default: "Necessary only" },
    ],
  },
  {
    id: "notFound",
    title: "Page not found",
    fields: [
      { key: "notFound.title", label: "Heading", default: "This page wandered off the path" },
      {
        key: "notFound.body",
        label: "Body",
        type: "textarea",
        default:
          "The link may be old, or the page never existed. Nothing is broken on your side — let's get you back to the good stuff.",
      },
      { key: "notFound.home", label: "Home button", default: "Back home" },
      { key: "notFound.services", label: "Services button", default: "Browse services" },
    ],
  },
  {
    id: "checkout",
    title: "Checkout",
    fields: [
      { key: "checkout.title", label: "Page title", default: "Checkout" },
      {
        key: "checkout.subtitle",
        label: "Page subtitle",
        default: "Pay by UPI, confirm, and we start immediately.",
      },
      { key: "checkout.emptyTitle", label: "Empty cart heading", default: "Your cart is empty" },
      {
        key: "checkout.emptyBody",
        label: "Empty cart body",
        default: "Pick a service and a tier — the brief takes two minutes.",
      },
      { key: "checkout.emptyCta", label: "Empty cart button", default: "Browse services" },
      { key: "checkout.tipHeading", label: "Tip section heading", default: "Add a tip" },
      { key: "checkout.payHeading", label: "Payment heading", default: "Scan & pay" },
      {
        key: "checkout.payBody",
        label: "Payment note",
        default: "Any UPI app — GPay, PhonePe, Paytm.",
      },
      {
        key: "checkout.doneTitle",
        label: "Order-received heading",
        default: "Order and proof received",
      },
      {
        key: "checkout.doneBody",
        label: "Order-received body",
        type: "textarea",
        default:
          "We've got your payment screenshot and UTR. The studio will confirm on WhatsApp — usually within a few minutes.",
      },
    ],
  },
  {
    id: "legal",
    title: "Legal pages",
    fields: [
      {
        key: "legal.eyebrow",
        label: "Small label",
        default: "The fine print, minus the fine print",
      },
      { key: "legal.title", label: "Page title", default: "Policies & legalities" },
      {
        key: "legal.body",
        label: "Page intro",
        default: "Everything below applies to every order placed through {brand}.",
      },
      { key: "legal.privacy.title", label: "Privacy tab title", default: "Privacy Policy" },
      { key: "legal.terms.title", label: "Terms tab title", default: "Terms & Conditions" },
      { key: "legal.cookies.title", label: "Cookies tab title", default: "Cookie Policy" },
      {
        key: "legal.refunds.title",
        label: "Refunds tab title",
        default: "Refunds & Cancellations",
      },
      {
        key: "legal.privacy.description",
        label: "Privacy description",
        type: "textarea",
        default:
          "How {brand} handles your personal data, what we collect, where it lives, and your rights.",
      },
      {
        key: "legal.terms.description",
        label: "Terms description",
        type: "textarea",
        default:
          "Terms of service for {brand}'s design and management services — orders, payments, ownership and fair use.",
      },
      {
        key: "legal.cookies.description",
        label: "Cookies description",
        type: "textarea",
        default: "What cookies {brand} uses, what we don't use, and how to manage your choices.",
      },
      {
        key: "legal.refunds.description",
        label: "Refunds description",
        type: "textarea",
        default:
          "How {brand} handles refunds and cancellations for one-off services and ongoing monthly plans.",
      },
    ],
  },
  {
    id: "seo",
    title: "Search listings (title & description)",
    description: "What Google shows for each page. The studio name is appended automatically.",
    fields: [
      { key: "seo.home.title", label: "Home title", default: "Digital Design & Management Studio" },
      {
        key: "seo.home.description",
        label: "Home description",
        type: "textarea",
        default:
          "Logos, posters, commercial designs, thumbnails and event banners — plus event planning and social media management. Handcrafted work, three transparent tiers, checkout in minutes.",
      },
      { key: "seo.services.title", label: "Services title", default: "Services & Pricing" },
      {
        key: "seo.services.description",
        label: "Services description",
        type: "textarea",
        default:
          "Transparent three-tier pricing for logo design, posters, commercial design, thumbnails, event banners, event planning and social media management.",
      },
      { key: "seo.products.title", label: "Handmade title", default: "Handmade Pieces" },
      {
        key: "seo.products.description",
        label: "Handmade description",
        type: "textarea",
        default:
          "Small-batch pieces made by hand in the studio and with the people we collaborate with. Every piece finished by a pair of hands, not a production line.",
      },
      { key: "seo.credits.title", label: "Credits title", default: "Credits — Supporters & Partners" },
      {
        key: "seo.credits.description",
        label: "Credits description",
        type: "textarea",
        default:
          "Meet the people who back the studio — premium and legendary supporters, sponsors, partners and press. The studio runs on the community that carries it.",
      },
      { key: "seo.portal.title", label: "Portal title", default: "My Orders & Profile" },
      {
        key: "seo.portal.description",
        label: "Portal description",
        type: "textarea",
        default:
          "Your portal — view and manage your orders, submit payment proofs, and track the status of your briefs.",
      },
      { key: "seo.checkout.title", label: "Checkout title", default: "Checkout" },
      {
        key: "seo.checkout.description",
        label: "Checkout description",
        type: "textarea",
        default: "Review your cart, pay over UPI and send your brief in one go.",
      },
      { key: "seo.legal.title", label: "Legal title", default: "Legal & Policies" },
    ],
  },
];

/** Flat key → shipped default map, derived from the groups above. */
export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(
  CONTENT_GROUPS.flatMap((group) => group.fields.map((f) => [f.key, f.default])),
);

/** All field definitions with their group attached — what the admin editor maps over. */
export const CONTENT_FIELDS: (ContentField & { groupId: string; groupTitle: string })[] =
  CONTENT_GROUPS.flatMap((group) =>
    group.fields.map((field) => ({ ...field, groupId: group.id, groupTitle: group.title })),
  );

/** The shipped wording for a key, falling back to the key itself when unknown. */
export function contentDefault(key: string): string {
  return CONTENT_DEFAULTS[key] ?? key;
}

/** Replaces `{token}` placeholders in a piece of copy. */
export function fillTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, token: string) => tokens[token] ?? match);
}
