/**
 * The handover export.
 *
 * Written for whoever takes the studio over next: a successor owner, a new
 * manager, or the studio's own accountant on a Tuesday. Everything in here is
 * generated from what the console actually knows — the configured domain, the
 * tab list, the order states — so the document can never drift away from the
 * running build the way a hand-written wiki page does.
 *
 * It also emits the two files that cannot be generated at build time because
 * they have to name the studio's real domain: `sitemap.xml` and `robots.txt`.
 *
 * No DOM access here — the download itself lives in the component, so this
 * module stays pure and testable.
 */
import { siteOrigin } from "./site";

/** One row of the generated sitemap. `priority`/`changefreq` are the shipped values. */
export interface PublicRoute {
  path: string;
  changefreq: "weekly" | "monthly" | "yearly";
  priority: string;
}

/**
 * The indexable storefront routes, in the order a crawler should meet them.
 * `/admin`, `/checkout` and `/portal` are deliberately absent: they are signed
 * in or private, and robots.txt disallows them.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/services", changefreq: "weekly", priority: "0.9" },
  { path: "/products", changefreq: "weekly", priority: "0.8" },
  { path: "/credits", changefreq: "monthly", priority: "0.6" },
  { path: "/legal", changefreq: "yearly", priority: "0.3" },
  { path: "/legal?tab=privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/legal?tab=terms", changefreq: "yearly", priority: "0.3" },
  { path: "/legal?tab=refunds", changefreq: "yearly", priority: "0.3" },
];

/**
 * The sitemap for one origin. Returns an empty string when no domain is
 * configured — writing a sitemap without a domain would mean inventing one,
 * which is the bug this whole exercise removed.
 */
export function buildSitemap(rawOrigin?: string | null): string {
  const origin = siteOrigin(rawOrigin);
  if (!origin) return "";

  const urls = PUBLIC_ROUTES.map(
    (route) => `  <url>
    <loc>${origin}${route.path}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}${route.path}" />
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>
`;
}

/**
 * robots.txt for one origin. The private routes are the same list the app
 * itself keeps out of the console, and the Sitemap line must be absolute —
 * which is why it needs the domain.
 */
export function buildRobots(rawOrigin?: string | null): string {
  const origin = siteOrigin(rawOrigin);
  const sitemapLine = origin ? `Sitemap: ${origin}/sitemap.xml` : "Sitemap: /sitemap.xml";
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /checkout
Disallow: /portal

${sitemapLine}
`;
}

export interface HandoverInput {
  brandName: string;
  /** Studio's public origin, as configured in the console. May be empty. */
  siteUrl?: string;
  /** Epoch ms the document was generated. */
  generatedAt: number;
  tabs: readonly { label: string; body: string }[];
  orderStates: readonly { state: string; meaning: string }[];
  tables: readonly { name: string; holds: string }[];
  steps: readonly string[];
}

const bullet = (text: string) => `- ${text}`;

/**
 * The document itself: plain Markdown, so it reads in any editor, survives a
 * paste into email or Notion, and prints cleanly.
 */
export function buildHandoverDoc(input: HandoverInput): string {
  const { brandName, siteUrl, generatedAt, tabs, orderStates, tables, steps } = input;
  const origin = siteOrigin(siteUrl);
  const when = new Date(generatedAt).toISOString().slice(0, 10);
  const sitemap = buildSitemap(origin);
  const robots = buildRobots(origin);

  const domainSection = origin
    ? `The site's public address is **${origin}**. It is stored in the console
(Website tab → Domain and search), not in the source, and it drives the
canonical links, the OpenGraph tags, the structured data and the two files
below.

If the domain changes: update it in the Website tab, then replace
\`public/sitemap.xml\` and \`public/robots.txt\` with the copies at the end of
this document and re-deploy. Nothing else needs touching.`
    : `**No domain is configured yet.** Until one is set in the console (Website
tab → Domain and search), canonical and OpenGraph links fall back to whatever
address the page is served from — correct for a preview, wrong for the live
site. Set the domain, then replace \`public/sitemap.xml\` and
\`public/robots.txt\` with the copies at the end of this document.`;

  const domainFiles = origin
    ? `
Replace \`public/sitemap.xml\` with:

\`\`\`xml
${sitemap.trimEnd()}
\`\`\`

Replace \`public/robots.txt\` with:

\`\`\`text
${robots.trimEnd()}
\`\`\`
`
    : `
Once a domain is set, this document will carry a matching \`sitemap.xml\` and
\`robots.txt\` for it. Download it again after saving the domain.
`;

  return `# ${brandName} — handover

Generated ${when} from the console at /admin.

## What you are inheriting

${brandName} runs on two halves: the public storefront clients see, and the
console behind it. A single app and a single database — there is no separate
backend server to operate.

- Public storefront: / · /services · /products · /credits · /legal
- Clients: /auth · /portal · /checkout
- Staff: /admin (managers and the owner only; kept out of search engines)
- AI support: the chat bubble answers first, a human can be pulled in, and both
  land in the same inbox in the console.

## The console, tab by tab

${tabs.map((tab) => `### ${tab.label}\n\n${tab.body}`).join("\n\n")}

## The life of an order

A client picks a service tier, answers the intake questions, and is shown the
UPI ID and QR to pay. Only a human moves an order:

${orderStates.map((row) => bullet(`**${row.state}** — ${row.meaning}`)).join("\n")}

## Payments, receipts and what counts as proof

Money arrives by UPI, so a screenshot has to be checkable. The client is asked
for one showing all five of: who was paid, the amount, the date and time, a
success status, and a UPI reference or UTR.

- Set the UPI ID and payment QR in the Website tab. Until then the readiness
  check warns that clients are being asked to pay an account that does not
  exist.
- With an AI key connected the receipt is read automatically. Without one the
  studio still works — every amount can be typed in by hand.
- "Amount not read" is **not** "paid nothing". An unread screenshot is shown as
  unread and left out of the collected total rather than counted as zero.

## Who can see what

- **Everyone** browses and buys. Signed-in clients get a portal with their own
  orders and chat.
- **Managers** open the whole console except Roles.
- **Super owner** additionally manages roles, and is the account whose email
  matches the studio-owner setting.

Every admin action is re-checked on the server, so hiding the console is
convenience, not the security boundary.

## Two kinds of money

- **Service orders** arrive through checkout with an intake form.
- **Product sales** are handmade goods. Each sale writes its own row, splitting
  the amount into the maker's share, the studio's share and the site
  commission — using the rates stored on the product when it was saved, so
  changing a rate later cannot rewrite history.

## Where the data lives

One hosted database you already own, with these tables:

${tables.map((table) => bullet(`\`${table.name}\` — ${table.holds}`)).join("\n")}

Uploaded images are files in the same database's storage; the tables above only
hold references to them.

## Domain, search and the two generated files

${domainSection}

## Handover checklist

${steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

---

## Files to deploy

${domainFiles}
`;
}
