import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useContent } from "@/context/ContentProvider";
import { useSettings } from "@/context/SettingsProvider";
import { buildHandoverDoc, buildRobots, buildSitemap } from "@/lib/handover";
import {
  ArrowRight,
  BookOpenCheck,
  Coins,
  CreditCard,
  Download,
  FileCode2,
  Handshake,
  KeyRound,
  Palette,
  ScrollText,
  ShoppingBag,
  Users,
} from "lucide-react";

/** Saves a generated string to disk without touching the DOM outside the click. */
function download(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const secondaryBtn =
  "clay-sm inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

/**
 * The console's own manual.
 *
 * Written to be read by someone who did not build this — the studio owner
 * handing the business (and this machine) to a successor, or a new manager on
 * day one. Every sentence describes behaviour that actually ships: the order
 * states, the proof rules, the role gates and the table names all come from the
 * code in this repository, not from a plan.
 */
const TABS: { tab: string; label: string; body: string }[] = [
  {
    tab: "orders",
    label: "Orders",
    body: "Every service order with the client's name and email, their intake answers, and the payment screenshot they uploaded. Approve it, reject it with a reason the client sees, refund it, or mark it complete. This is the only place a payment is confirmed.",
  },
  {
    tab: "credits",
    label: "Credits",
    body: "The public contributors wall. A tip over ₹100 makes someone premium, over ₹500 legendary; marketing credits (sponsors, press, people who helped) can be added by hand and carry no amount.",
  },
  {
    tab: "coupons",
    label: "Coupons",
    body: "Discount codes: flat rupees or a percentage, optionally capped by total uses, by uses per client, by an email allow-list, or by an expiry date. Pausing a code keeps its redemption history.",
  },
  {
    tab: "inbox",
    label: "Live chat",
    body: "Client conversations from the site's chat bubble. Clients can ask the AI assistant first and ask for a human when they want one; both land in the same thread here.",
  },
  {
    tab: "portfolio",
    label: "Portfolio",
    body: "The images on the public masonry. Upload, title and remove them here — the landing page reads this list directly.",
  },
  {
    tab: "services",
    label: "Services",
    body: "The catalogue clients buy from: each service, its tagline, and its three tiers with prices and deliverable lists. Prices here are what checkout charges and what the landing page quotes.",
  },
  {
    tab: "products",
    label: "Products & people",
    body: "Handmade products for sale, and the collaborators who make them. A product can name one maker and record their share of each sale at the moment it is saved.",
  },
  {
    tab: "website",
    label: "Website",
    body: "The look and the money plumbing: theme colours, the site logo and wordmark, the UPI ID and payment QR clients are shown, hero copy, social links, and a readiness check that warns when payments cannot actually be received yet.",
  },
  {
    tab: "words",
    label: "Words & copy",
    body: "Every public sentence can be overridden from here without a deploy. Only keys you change are stored; everything else keeps its built-in default.",
  },
  {
    tab: "calculator",
    label: "Profit split",
    body: "What each collaborator earned, computed from product sales rows rather than from today's prices — so renegotiating a rate never rewrites past earnings.",
  },
  {
    tab: "roles",
    label: "Roles",
    body: "Grant or remove manager access. Visible to the super owner only, and the super owner cannot demote themselves by accident.",
  },
];

const ORDER_STATES: { state: string; meaning: string }[] = [
  {
    state: "pending",
    meaning:
      "Default for a new order. It sits here until a human approves or rejects it, whether or not a receipt has arrived.",
  },
  {
    state: "approved",
    meaning:
      "The studio has accepted the work. Payment may still be outstanding — the board shows what was collected against what is due.",
  },
  {
    state: "completed",
    meaning: "Delivered and settled. Kept in the book for history and for the revenue trend.",
  },
  {
    state: "rejected",
    meaning:
      "Declined. The reason typed in the Orders tab is shown to the client on their portal.",
  },
];

const TABLES: { name: string; holds: string }[] = [
  { name: "orders", holds: "Service orders, their intake answers and status." },
  { name: "paymentProofs", holds: "One row per uploaded receipt, with the UTR or transaction id when typed." },
  { name: "paymentReviews", holds: "The read of each receipt: amount, what is still missing, risk flags." },
  { name: "services / serviceTiers", holds: "The catalogue and its three price tiers." },
  { name: "products / collaborators / productSales", holds: "Handmade goods, their makers, and a row per sale with each share." },
  { name: "credits / coupons / couponRedemptions", holds: "The contributors wall, discount codes, and exact redemption counts." },
  { name: "chatSessions / messages", holds: "Live support conversations." },
  { name: "portfolioImages", holds: "Gallery images (files live in Convex storage)." },
  { name: "globalSettings / siteContent", holds: "The studio's branding, money settings and every copy override." },
  { name: "users", holds: "Accounts, with the role that decides console access." },
];

/**
 * The handover checklist. Shared by the page and the exported document on
 * purpose — the two must never disagree about what is left to do.
 */
const HANDOVER_STEPS: string[] = [
  "Set the studio's real name and copy in Words & copy, so nothing public still reads like a template.",
  "Upload the logo and pick theme colours in the Website tab.",
  "Put in the real UPI ID and payment QR, then check the readiness warning is gone.",
  "Keep the AI key connected in the Keys/API keys tab if you want receipts read automatically; the studio works without it, just by hand.",
  "Add every manager in the Roles tab, and set the owner's email as the studio owner so the top-level role follows the account.",
  "Read the Legal pages as the new owner — they are written for a small Indian design studio and may need your own entity's wording.",
  "Set the site's own domain in the Website tab → Domain and search, then download sitemap.xml and robots.txt from this tab and drop them over the ones in public/.",
  "Hand over the accounts themselves: the Convex deployment, the AI key, and the host's login. The database is the business — without those, this machine cannot take orders.",
];

export function AdminGuide({ onJump }: { onJump?: (tab: string) => void }) {
  const { brandName } = useContent();
  const { siteUrl } = useSettings();
  const hasDomain = Boolean(siteUrl?.trim());

  // Everything below is generated from what this console actually knows, so the
  // exported document can never describe a version of the studio that is not
  // the one running.
  const exportDoc = () =>
    download(
      `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "studio"}-handover.md`,
      buildHandoverDoc({
        brandName,
        siteUrl,
        generatedAt: Date.now(),
        tabs: TABS,
        orderStates: ORDER_STATES,
        tables: TABLES,
        steps: HANDOVER_STEPS,
      }),
      "text/markdown",
    );

  return (
    <div className="space-y-5">
      <section className="clay rounded-[1.35rem] p-6">
        <span className="tint flex size-10 items-center justify-center rounded-2xl">
          <BookOpenCheck className="size-5" />
        </span>
        <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight">
          What everything here does
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {brandName} runs on two halves: the public storefront that clients see,
          and the console you are standing in. The storefront cannot invent
          anything — every service, price, image, sentence and theme colour on the
          public site is read from this console. Nothing below is a placeholder;
          it describes the build you are holding.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Public: / · /services · /products</Badge>
          <Badge variant="secondary">Clients: /auth · /portal · /checkout</Badge>
          <Badge variant="secondary">You: /admin</Badge>
          <Badge variant="secondary">Legal: /legal · /credits</Badge>
        </div>
      </section>

      <section className="clay rounded-[1.35rem] p-6">
        <span className="tint flex size-10 items-center justify-center rounded-2xl">
          <Download className="size-5" />
        </span>
        <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight">
          Take it with you
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The whole page below, as one Markdown file you can print, email or hand
          to whoever runs this next — written from the settings this console
          actually holds, so it cannot describe a version of {brandName} that is
          not the one running.
        </p>

        {!hasDomain && (
          <p className="clay-inset mt-3 rounded-xl px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            No domain is set yet, so the sitemap and robots files stay relative.
            Add the studio's address in the Website tab → Domain and search to
            get both with it filled in.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportDoc}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
          >
            <Download className="size-4" />
            Download handover doc (.md)
          </button>
          <button
            type="button"
            disabled={!hasDomain}
            onClick={() => download("sitemap.xml", buildSitemap(siteUrl), "application/xml")}
            className={secondaryBtn}
          >
            <FileCode2 className="size-4" />
            Download sitemap.xml
          </button>
          <button
            type="button"
            onClick={() => download("robots.txt", buildRobots(siteUrl))}
            className={secondaryBtn}
          >
            <FileCode2 className="size-4" />
            Download robots.txt
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Drop the two files over the copies in <code className="font-mono">public/</code>{" "}
          before you deploy. The Markdown already contains both, so a single
          download is enough to hand the whole thing over.
        </p>
      </section>

      <Accordion type="multiple" defaultValue={["tour"]} className="space-y-3">
        <AccordionItem value="tour" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <ScrollText className="size-4 text-primary" />
              Every tab, and what it is for
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-3">
              {TABS.map((item) => (
                <li key={item.tab} className="clay-inset rounded-xl px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onJump?.(item.tab)}
                    className="group flex items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    {item.label}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="orders" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <ShoppingBag className="size-4 text-primary" />
              The life of an order
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              A client picks a service tier, answers the intake questions, and is
              shown the studio's UPI ID and QR to pay. The order then moves
              through four states — only a human moves it:
            </p>
            <ul className="space-y-2">
              {ORDER_STATES.map((row) => (
                <li key={row.state} className="flex flex-wrap items-baseline gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {row.state}
                  </Badge>
                  <span className="flex-1 text-xs leading-relaxed text-muted-foreground">
                    {row.meaning}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Rejecting asks for a reason, and that reason is shown to the client —
              so write it as something they should read.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="payments" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <CreditCard className="size-4 text-primary" />
              Payments, receipts and what counts as proof
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Money arrives by UPI, so the studio needs a screenshot that can be
              checked. The client is asked for one that shows all five of: who was
              paid, the amount, the date and time, a success status, and a UPI
              reference or UTR. The success banner alone is not enough, and the
              client is told that before they upload.
            </p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="font-semibold text-foreground">Set the UPI ID and QR</strong> in
                the Website tab. Until then the readiness check warns that clients
                are being asked to pay an account that does not exist.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Reads are automatic when they can be.</strong>{" "}
                With an AI key connected (Keys/API keys tab) the receipt is read and
                the amount is filled in for you.
              </li>
              <li>
                <strong className="font-semibold text-foreground">"Amount not read" is not "paid nothing".</strong>{" "}
                An unread screenshot is shown as unread and is left out of the
                collected total — never silently counted as zero. Type the amount in
                yourself and it stays typed in.
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="roles" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <KeyRound className="size-4 text-primary" />
              Who can see what
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="font-semibold text-foreground">Everyone</strong> browses the
                catalogue and buys; signed-in clients also get a portal with their own
                orders and a chat thread.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Managers</strong> open the whole
                console except Roles. Every admin action is re-checked on the server,
                so the console being hidden is convenience, not the security boundary.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Super owner</strong> additionally
                manages roles. The owner account is the one whose email matches the
                studio-owner setting in the Keys/API keys tab; it is promoted
                automatically on sign-in and cannot be demoted from the console.
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Outsiders are not merely blocked, they are bounced off the route, and
              /admin is kept out of search engines and the sitemap.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="money" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <Coins className="size-4 text-primary" />
              Two kinds of money, and who gets a cut
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="font-semibold text-foreground">Service orders</strong> come
                through checkout with an intake form, and land in Orders.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Product sales</strong> are
                handmade goods. Each sale writes its own row, splitting the amount into
                the maker's share, the studio's share, and the site commission — using
                the rates stored on the product when it was saved, so changing a rate
                later cannot rewrite history.
              </li>
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The Profit split tab adds those rows up per person. A product can name
              one maker; there is no second or third partner on a single product.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="brand" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <Palette className="size-4 text-primary" />
              Brand, words and legal pages
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                <strong className="font-semibold text-foreground">Website tab</strong> sets the
                theme colours, the logo (image or wordmark) and the money details. The
                colours apply to the whole site live, including this console.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Words &amp; copy</strong> holds
                the public sentences, including the studio's own name — set it there
                once and the tab title, footer, legal pages and hero all follow it.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Legal</strong> publishes
                privacy, terms, refunds and cookie policies written for this shop, and
                the cookie banner is wired to them.
              </li>
              <li>
                <strong className="font-semibold text-foreground">Your own domain</strong>{" "}
                is set in the Website tab (Domain and search). Canonical links,
                the social preview card, the structured data and the generated
                sitemap all follow it — nothing in the build hardcodes an
                address, so a preview or staging copy correctly points at
                itself until a domain is chosen.
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="data" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <Users className="size-4 text-primary" />
              Where the data actually lives
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Everything is stored in this app's own Convex deployment — one hosted
              database, no separate server to operate. Uploaded images are files in
              Convex storage; the tables below only hold references to them.
            </p>
            <ul className="space-y-2">
              {TABLES.map((table) => (
                <li key={table.name} className="flex flex-wrap items-baseline gap-2">
                  <code className="rounded-md bg-secondary/60 px-1.5 py-0.5 font-mono text-[11px]">
                    {table.name}
                  </code>
                  <span className="flex-1 text-xs leading-relaxed text-muted-foreground">
                    {table.holds}
                  </span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="handover" className="clay rounded-[1.35rem] px-5">
          <AccordionTrigger className="font-display text-base hover:no-underline">
            <span className="flex items-center gap-2.5">
              <Handshake className="size-4 text-primary" />
              Handing the studio to someone else
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              {HANDOVER_STEPS.map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Nothing in the console is destructive by accident: orders keep their
              history, coupons keep their redemptions, and sales keep the split they
              were made under.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
