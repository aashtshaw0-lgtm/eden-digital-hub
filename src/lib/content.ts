const content = [
  {
    id: "site",
    title: "Site settings",
    description: "Brand colours, logo and every link you change here are woven into the site, the console and the email.",
    fields: [
      {
        key: "brand.name",
        label: "Brand name",
        default: "Eden",
      },
      {
        key: "brand.tagline",
        label: "Tagline",
        default: "A studio for digital design and management.",
      },
      {
        key: "brand.heroBadge",
        label: "Hero badge",
        default: "Design & management studio",
      },
      {
        key: "brand.footerNote",
        label: "Footer note",
        default: "Every hand-drawn piece is also a working deliverable you can hand over, revise and be done with.",
      },
      {
        key: "brand.madeBy",
        label: "Made by",
        default: "The studio",
      },
    ],
  },
  {
    id: "home",
    title: "Home / landing page",
    description:
      "Every string on the landing page: headlines, chips, stats, section titles and the copy above the hero.",
    fields: [
      {
        key: "home.eyebrow",
        label: "Eyebrow",
        default: "Design & management studio",
      },
      {
        key: "home.heroBadge",
        label: "Hero badge",
        default: "Design & management studio",
      },
      {
        key: "home.heroSubtitle",
        label: "Hero subtitle",
        type: "textarea",
        default: "One studio for logos, posters, thumbnails, banners and full event or social execution — every piece drawn by hand, with three honest tiers on each service and a real person one click away.",
      },
      {
        key: "home.heroTitle",
        label: "Hero headline",
        default: "We make the web feel human.",
      },
      {
        key: "home.heroLead",
        label: "Hero lead",
        default: "Made to move.",
      },
      {
        key: "home.heroMode",
        label: "Hero accent mode",
        default: "rotating",
      },
      {
        key: "home.heroAccent",
        label: "Hero accent",
        default: "by hand",
      },
      {
        key: "home.heroAccentWords",
        label: "Hero accent words",
        default: "by hand,that converts,with care",
      },
      {
        key: "home.hero.ctaServices",
        label: "Main button",
        default: "Explore services",
      },
      {
        key: "home.hero.ctaWork",
        label: "Second button",
        default: "See our work",
      },
      {
        key: "home.hero.ctaProducts",
        label: "Third button",
        default: "See handmade pieces",
      },
      {
        key: "home.chip.1",
        label: "Chip 1",
        default: "7 services",
      },
      {
        key: "home.chip.2",
        label: "Chip 2",
        default: "3 transparent tiers",
      },
      {
        key: "home.chip.3",
        label: "Chip 3",
        default: "UPI checkout",
      },
      {
        key: "home.chip.4",
        label: "Chip 4",
        default: "Live manager chat",
      },
      {
        key: "home.chip.5",
        label: "Chip 5",
        default: "Handmade shelf",
      },
      {
        key: "home.work.title",
        label: "Work section title",
        default: "Selected work",
      },
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
        type: "textarea",
        default: "Pick a service, pick a tier, brief us in one form.",
      },
      {
        key: "home.services.cta",
        label: "Services section link",
        default: "View all services",
      },
      {
        key: "home.stat.1",
        label: "Stat 1 label",
        default: "Services on the shelf",
      },
      {
        key: "home.stat.2",
        label: "Stat 2 label",
        default: "Pieces shipped",
      },
      {
        key: "home.stat.3",
        label: "Stat 3 label",
        default: "Tiers per service",
      },
    ],
  },
  {
    id: "nav",
    title: "Navigation & footer",
    description: "Labels in the floating menu and in the footer.",
    fields: [
      { key: "nav.home", label: "Home", default: "Home" },
      { key: "nav.services", label: "Services", default: "Services" },
      { key: "nav.products", label: "Products", default: "Products" },
      { key: "nav.portal", label: "Portal", default: "Portal" },
      { key: "nav.checkout", label: "Checkout", default: "Checkout" },
      { key: "nav.credits", label: "Credits", default: "Credits" },
      { key: "nav.privacy", label: "Privacy", default: "Privacy" },
      { key: "nav.terms", label: "Terms", default: "Terms" },
      { key: "nav.console", label: "Admin console", default: "Console" },
    ],
  },
  {
    id: "cookies",
    title: "Cookie banner",
    description: "The consent bar shown on a visitor's first visit.",
    fields: [
      {
        key: "cookies.title",
        label: "Title",
        default: "A short note on cookies",
      },
      {
        key: "cookies.body",
        label: "Body",
        type: "textarea",
        default:
          "We only store what the site needs to work — your session, your cart and this choice. No advertising or third-party tracking.",
      },
      {
        key: "cookies.linkLabel",
        label: "Policy link",
        default: "Read the cookie policy",
      },
      { key: "cookies.accept", label: "Accept button", default: "That's fine" },
      {
        key: "cookies.necessary",
        label: "Necessary-only button",
        default: "Necessary only",
      },
    ],
  },
  {
    id: "chat",
    title: "Chat",
    description: "The assistant, the manager thread and the sign-in prompt.",
    fields: [
      { key: "chat.chooser.title", label: "Chooser title", default: "How can we help?" },
      { key: "chat.instant.name", label: "Assistant name", default: "Ask the studio AI" },
      {
        key: "chat.instant.desc",
        label: "Assistant description",
        type: "textarea",
        default: "Pricing, timelines and what's in each tier — answered instantly.",
      },
      { key: "chat.manager.name", label: "Manager name", default: "Talk to a manager" },
      {
        key: "chat.manager.desc",
        label: "Manager description",
        type: "textarea",
        default: "A real person from the studio, usually within the hour.",
      },
      {
        key: "chat.greeting",
        label: "Opening message",
        type: "textarea",
        default:
          "Hi — I can walk you through the services, tiers and timelines. What are you making?",
      },
      { key: "chat.assistant.title", label: "Assistant thread title", default: "Studio assistant" },
      {
        key: "chat.assistant.subtitle",
        label: "Assistant thread subtitle",
        default: "Instant answers on services and pricing",
      },
      {
        key: "chat.error",
        label: "Error message",
        default: "That didn't go through. Try once more in a moment.",
      },
      {
        key: "chat.placeholder",
        label: "Input placeholder",
        default: "Ask about a service, tier or timeline…",
      },
      { key: "chat.connecting", label: "Connecting note", default: "Connecting you to the studio…" },
      {
        key: "chat.hello",
        label: "Empty thread note",
        type: "textarea",
        default:
          "Hi — you're through to the studio. Tell us what you need and {brand} will reply here.",
      },
      { key: "chat.signin.title", label: "Sign-in title", default: "Sign in to chat" },
      {
        key: "chat.signin.subtitle",
        label: "Sign-in subtitle",
        default: "One account, one thread",
      },
      {
        key: "chat.signin.body",
        label: "Sign-in body",
        type: "textarea",
        default:
          "The assistant and the studio both keep your conversation on your account, so sign in first and nothing gets lost.",
      },
      { key: "chat.manager.title", label: "Manager thread title", default: "Studio manager" },
      {
        key: "chat.manager.subtitle",
        label: "Manager thread subtitle",
        default: "Usually replies within the hour",
      },
      {
        key: "chat.manager.subtitleResolved",
        label: "Resolved thread subtitle",
        default: "This thread is closed — start a new one any time",
      },
    ],
  },
  {
    id: "services",
    title: "Services page",
    description: "Headlines for the services listing and the brief sheet.",
    fields: [
      { key: "services.title", label: "Page title", default: "Services & tiers" },
      {
        key: "services.subtitle",
        label: "Page subtitle",
        type: "textarea",
        default: "Every service has three honest tiers. Pick one and brief us in a single form.",
      },
      { key: "services.from", label: "Price prefix", default: "From" },
      { key: "services.cat.all", label: "Filter: all", default: "Everything" },
      { key: "services.cat.design", label: "Filter: design", default: "Design" },
      { key: "services.cat.events", label: "Filter: events", default: "Events" },
      { key: "services.cat.management", label: "Filter: management", default: "Management" },
      { key: "services.tiersBadge", label: "Tiers badge", default: "tiers" },
      { key: "sheet.chooseHeading", label: "Sheet: choose tier", default: "Choose a tier" },
      { key: "sheet.intakeHeading", label: "Sheet: brief heading", default: "Brief us" },
      { key: "sheet.backToTiers", label: "Sheet: back link", default: "Back to tiers" },
      { key: "sheet.contact", label: "Sheet: contact heading", default: "Where should we reach you?" },
      { key: "sheet.references", label: "Sheet: references heading", default: "References" },
      { key: "sheet.eventDetails", label: "Sheet: event heading", default: "Event details" },
      { key: "sheet.channels", label: "Sheet: channels heading", default: "Where should this be published?" },
    ],
  },
  {
    id: "checkout",
    title: "Checkout",
    description: "Cart, tip, UPI payment and the thank-you screen.",
    fields: [
      { key: "checkout.title", label: "Page title", default: "Checkout" },
      {
        key: "checkout.subtitle",
        label: "Page subtitle",
        default: "Pay by UPI, then attach the screenshot so we can start.",
      },
      { key: "checkout.tipHeading", label: "Tip heading", default: "Add a tip" },
      { key: "checkout.payHeading", label: "Payment heading", default: "Pay by UPI" },
      {
        key: "checkout.payBody",
        label: "Payment body",
        type: "textarea",
        default: "Scan the code or pay to the UPI ID below, then attach your payment screenshot.",
      },
      { key: "checkout.doneTitle", label: "Success title", default: "Order placed" },
      {
        key: "checkout.doneBody",
        label: "Success body",
        type: "textarea",
        default: "We've got your brief and your payment proof. You'll see progress in your portal.",
      },
      { key: "checkout.emptyTitle", label: "Empty cart title", default: "Your cart is empty" },
      {
        key: "checkout.emptyBody",
        label: "Empty cart body",
        type: "textarea",
        default: "Pick a service tier or a handmade piece, and it will show up here.",
      },
      { key: "checkout.emptyCta", label: "Empty cart button", default: "Browse services" },
    ],
  },
  {
    id: "portal",
    title: "Client portal",
    description: "The signed-in view of a client's orders.",
    fields: [
      {
        key: "portal.welcome",
        label: "Welcome line",
        default: "Here's everything you've ordered from the studio.",
      },
      { key: "portal.adminLink", label: "Console link", default: "Open the console" },
      { key: "portal.signOut", label: "Sign-out button", default: "Sign out" },
      { key: "portal.ordersTitle", label: "Orders heading", default: "Your orders" },
      {
        key: "portal.empty",
        label: "Empty state",
        type: "textarea",
        default: "No orders yet — the first piece is the fun one.",
      },
      { key: "portal.emptyCta", label: "Empty state button", default: "Start with a service" },
    ],
  },
  {
    id: "products",
    title: "Handmade shelf",
    description: "The products page.",
    fields: [
      { key: "products.eyebrow", label: "Eyebrow", default: "Handmade shelf" },
      { key: "products.title", label: "Page title", default: "Pieces you can own" },
      {
        key: "products.subtitle",
        label: "Page subtitle",
        type: "textarea",
        default: "One-off objects and prints from the studio, packed and shipped by hand.",
      },
      { key: "products.madeWith", label: "Made-with label", default: "Made with" },
      { key: "products.madeWithPrefix", label: "Made-with prefix", default: "Made with" },
      { key: "products.byStudio", label: "Made by studio", default: "Made by the studio" },
      { key: "products.empty", label: "Empty state", default: "Nothing on the shelf right now." },
      { key: "products.emptyCta", label: "Empty state button", default: "See the services" },
    ],
  },
  {
    id: "credits",
    title: "Studio credits",
    description: "The clients wall. {premium} and {legendary} are filled in from the tiers.",
    fields: [
      { key: "credits.eyebrow", label: "Eyebrow", default: "Studio credits" },
      { key: "credits.title", label: "Page title", default: "Made together" },
      {
        key: "credits.subtitle",
        label: "Page subtitle",
        type: "textarea",
        default:
          "Clients who've spent {premium} with the studio — and the {legendary} circle beyond that.",
      },
      { key: "credits.count.one", label: "One piece", default: "piece" },
      { key: "credits.count.many", label: "Many pieces", default: "pieces" },
      {
        key: "credits.empty",
        label: "Empty state",
        type: "textarea",
        default: "No credits yet. The first commission past {premium} lands here.",
      },
      { key: "credits.emptyCta", label: "Empty state button", default: "See the services" },
    ],
  },
  {
    id: "legal",
    title: "Legal pages",
    description: "Privacy, terms, cookies and refunds. {brand} is filled in automatically.",
    fields: [
      { key: "legal.eyebrow", label: "Eyebrow", default: "The fine print" },
      { key: "legal.title", label: "Page title", default: "Policies" },
      {
        key: "legal.body",
        label: "Intro paragraph",
        type: "textarea",
        default:
          "{brand} keeps this page short on purpose: plain language, no surprises. If anything here is unclear, ask us in the chat and we'll answer it.",
      },
      { key: "legal.privacy.title", label: "Privacy tab", default: "Privacy" },
      {
        key: "legal.privacy.description",
        label: "Privacy summary",
        type: "textarea",
        default: "What {brand} stores, why it stores it, and how to have it removed.",
      },
      { key: "legal.terms.title", label: "Terms tab", default: "Terms" },
      {
        key: "legal.terms.description",
        label: "Terms summary",
        type: "textarea",
        default: "How briefs, revisions, timelines and delivery work at {brand}.",
      },
      { key: "legal.cookies.title", label: "Cookies tab", default: "Cookies" },
      {
        key: "legal.cookies.description",
        label: "Cookies summary",
        type: "textarea",
        default: "The handful of things {brand} stores in your browser, and nothing more.",
      },
      { key: "legal.refunds.title", label: "Refunds tab", default: "Refunds" },
      {
        key: "legal.refunds.description",
        label: "Refunds summary",
        type: "textarea",
        default: "When {brand} refunds a commission, and when it can't.",
      },
    ],
  },
  {
    id: "notFound",
    title: "404 page",
    description: "Shown when a link no longer resolves.",
    fields: [
      { key: "notFound.title", label: "Title", default: "This page went missing" },
      {
        key: "notFound.body",
        label: "Body",
        type: "textarea",
        default: "The link may be old, or the piece may have moved. The studio is still here.",
      },
      { key: "notFound.home", label: "Home button", default: "Back home" },
      { key: "notFound.services", label: "Services button", default: "See services" },
    ],
  },
  {
    id: "seo",
    title: "Titles & search snippets",
    description: "Browser tab titles and the description search engines show.",
    fields: [
      { key: "seo.home.title", label: "Home title", default: "A design & management studio" },
      {
        key: "seo.home.description",
        label: "Home description",
        type: "textarea",
        default:
          "Logos, posters, thumbnails, banners and full campaign execution, drawn by hand with three transparent tiers and a real manager one click away.",
      },
      { key: "seo.services.title", label: "Services title", default: "Services & tiers" },
      {
        key: "seo.services.description",
        label: "Services description",
        type: "textarea",
        default: "Every service in three transparent tiers, briefed in one form and paid by UPI.",
      },
      { key: "seo.products.title", label: "Products title", default: "Handmade pieces" },
      {
        key: "seo.products.description",
        label: "Products description",
        type: "textarea",
        default: "One-off objects and prints from the studio shelf, packed and shipped by hand.",
      },
      { key: "seo.credits.title", label: "Credits title", default: "Studio credits" },
      {
        key: "seo.credits.description",
        label: "Credits description",
        type: "textarea",
        default: "The clients and collaborators who've made work with the studio.",
      },
      { key: "seo.portal.title", label: "Portal title", default: "Your portal" },
      {
        key: "seo.portal.description",
        label: "Portal description",
        type: "textarea",
        default: "Your orders, briefs and progress in one place.",
      },
      { key: "seo.checkout.title", label: "Checkout title", default: "Checkout" },
      {
        key: "seo.checkout.description",
        label: "Checkout description",
        type: "textarea",
        default: "Pay by UPI and send your payment proof to start the brief.",
      },
    ],
  },
];

const defaults: Record<string, string> = {};
const groups: Record<string, { id: string; label: string; fields: typeof content[number]["fields"] }> = {};

for (const group of content) {
  groups[group.id] = { id: group.id, label: group.title, fields: group.fields };
  for (const field of group.fields) {
    defaults[field.key] = field.default;
  }
}

export const CONTENT_FIELDS = content.flatMap((g) => g.fields);
export const CONTENT_GROUPS = Object.values(groups);
export const CONTENT_DEFAULTS = defaults;

function fillTokens(text: string, tokens?: Record<string, string>): string {
  if (!tokens) return text;
  return text.replace(/\{tooltip\}|\{\w+\}/g, (match) =>
    tokens[match.slice(1, -1)] ?? match,
  );
}

function contentDefault(key: string): string {
  const text = defaults[key];
  return text ?? "";
}

export { fillTokens, contentDefault };

export interface EdenContent {
  overrides: Record<string, string>;
  t: (key: string, tokens?: Record<string, string>) => string;
  isCustom: (key: string) => boolean;
  brandName: string;
}
