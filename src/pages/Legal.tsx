import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { Banknote, Cookie, FileText, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router";

const LAST_UPDATED = "October 4, 2026";

const TABS = [
  { key: "privacy", label: "Privacy Policy", icon: ShieldCheck },
  { key: "terms", label: "Terms & Conditions", icon: FileText },
  { key: "cookies", label: "Cookie Policy", icon: Cookie },
  { key: "refunds", label: "Refund & Cancellation", icon: Banknote },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((t) => t.key === value);
}

export default function Legal() {
  useSeo({
    title: "Privacy, Terms & Policies | Eden - Digital Design & Management",
    description:
      "How Eden handles your data, cookies, orders and refunds — written in plain language.",
  });

  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "privacy";

  const selectTab = (key: TabKey) => {
    setParams({ tab: key }, { replace: true });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">The fine print, minus the fine print</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Policies & legalities
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Everything below applies to every order placed through Eden. Last updated {LAST_UPDATED}.
        </p>
      </header>

      <nav
        aria-label="Policy sections"
        className="clay mt-10 flex flex-wrap items-center gap-1 rounded-2xl p-1.5"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
              tab === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>

      <article key={tab} className="mt-8 space-y-8">
        {tab === "privacy" && <Privacy />}
        {tab === "terms" && <Terms />}
        {tab === "cookies" && <Cookies />}
        {tab === "refunds" && <Refunds />}
      </article>

      <footer className="clay-sm mt-12 rounded-2xl p-5 text-center text-sm text-muted-foreground">
        Questions about any of this? Email{" "}
        <a href="mailto:edenartservices@gmail.com" className="font-medium text-primary hover:underline">
          edenartservices@gmail.com
        </a>{" "}
        or open the live chat — a human replies.
      </footer>
    </main>
  );
}

/* ── Shared bits ─────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="clay rounded-2xl p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="ml-1 list-disc space-y-1.5 pl-4">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/* ── Privacy Policy ──────────────────────────────────────── */

function Privacy() {
  return (
    <>
      <Section title="What we collect">
        <p>When you browse, order or chat with us, we collect only what the work needs:</p>
        <Bullets
          items={[
            "Account details — your name and email address when you sign in.",
            "Order briefs — the intake answers (project details, links, references) you submit with an order.",
            "Contact details — the WhatsApp number you give us so we can reach you about the work.",
            "Reference files — anything you upload for a designer to look at.",
            "Chat messages — your conversations with our studio assistant and live managers.",
            "Basic technical records — sign-in timestamps and order history kept for accounting.",
          ]}
        />
      </Section>
      <Section title="How we use it">
        <Bullets
          items={[
            "To deliver the service you paid for — sharing briefs and files with the designer assigned to your order.",
            "To support you — replying to chats, calls and emails about your order.",
            "To keep the platform safe — rate limiting and abuse prevention on orders and chat.",
            "We never sell your personal data, and we don't run advertising trackers.",
          ]}
        />
      </Section>
      <Section title="Where it lives">
        <p>
          Eden runs on managed cloud infrastructure (Convex for the database, files and
          authentication). Your data is stored there with encryption in transit and at rest. Only
          Eden team members with an admin role can view order details, and only to do the work.
        </p>
      </Section>
      <Section title="Your choices">
        <p>
          You can ask for a copy of your data or request deletion of your account and order
          history at any time — email{" "}
          <a className="font-medium text-primary hover:underline" href="mailto:edenartservices@gmail.com">
            edenartservices@gmail.com
          </a>
          . We'll action requests within 30 days, keeping only what tax and accounting rules
          require us to keep (like completed invoices).
        </p>
      </Section>
    </>
  );
}

/* ── Terms & Conditions ──────────────────────────────────── */

function Terms() {
  return (
    <>
      <Section title="The service">
        <p>
          Eden is a design and management studio. Every service on the storefront (logos, posters,
          commercial design, thumbnails, banners, event planning, social media management) is sold
          in three transparent tiers — Basic, Pro and Premium — with the deliverables listed on
          each tier before you pay.
        </p>
      </Section>
      <Section title="Orders & payment">
        <Bullets
          items={[
            "Placing an order means the brief you submit is accurate and complete — revisions caused by a brief change may count against the tier's revision rounds.",
            "Payment happens over UPI at checkout. An order is confirmed once payment is verified and its status moves from pending to approved.",
            "Delivery timelines shown on each tier start from approval of the order, not from payment.",
          ]}
        />
      </Section>
      <Section title="Ownership & portfolio rights">
        <Bullets
          items={[
            "On full payment, the final deliverables for your order are yours to use for your business.",
            "Eden retains the right to display delivered work in our portfolio unless you ask us in writing not to (just say so in the brief or over chat).",
            "You confirm that any material you upload (logos, photos, copy) is yours to share, and Eden isn't liable for claims arising from materials you provided.",
          ]}
        />
      </Section>
      <Section title="Fair use & conduct">
        <p>
          Don't submit unlawful, infringing or abusive content, and don't attempt to overload the
          platform (automated flooding, scraping, or thousands of junk orders). We rate-limit
          actions and may refuse service for abuse.
        </p>
      </Section>
      <Section title="Liability">
        <p>
          Eden's total liability for any order is limited to the amount paid for that order. We
          aren't liable for indirect losses (lost profits, missed events) beyond re-delivering or
          refunding the affected work as covered in the Refund Policy.
        </p>
      </Section>
      <Section title="Governing law">
        <p>
          These terms are governed by the laws of India, and disputes fall under the exclusive
          jurisdiction of Indian courts. We'll always try to sort things out over chat first.
        </p>
      </Section>
    </>
  );
}

/* ── Cookie Policy ───────────────────────────────────────── */

function Cookies() {
  return (
    <>
      <Section title="Cookies & local storage we use">
        <p>Eden is deliberately light on tracking. We use only what keeps the site working:</p>
        <Bullets
          items={[
            "Essential — your sign-in session, so you stay logged in securely.",
            "Essential — your cart (eden.cart.v1), so items survive a refresh.",
            "Preference — your cookie-consent choice (eden.cookie-consent.v1), so we stop asking.",
          ]}
        />
      </Section>
      <Section title="What we don't use">
        <p>
          No advertising cookies, no cross-site trackers, no social-media pixels. Portfolio images
          are served from Unsplash's CDN, which may set its own technical headers when loading
          images, but we send it nothing about you.
        </p>
      </Section>
      <Section title="Managing cookies">
        <p>
          You can clear cookies and local storage any time from your browser settings — you'll
          just be signed out and your cart will empty. Your consent choice can be changed from the
          "Cookie settings" link in the footer of any page.
        </p>
      </Section>
    </>
  );
}

/* ── Refund & Cancellation ───────────────────────────────── */

function Refunds() {
  return (
    <>
      <Section title="Cancelling before work starts">
        <p>
          If your order is still pending or hasn't been picked up by a designer, you can cancel
          for a full refund — message us on chat or email{" "}
          <a className="font-medium text-primary hover:underline" href="mailto:edenartservices@gmail.com">
            edenartservices@gmail.com
          </a>{" "}
          with your order details.
        </p>
      </Section>
      <Section title="After work has started">
        <Bullets
          items={[
            "Once a designer has begun, we refund the portion of work not yet done — calculated fairly and agreed with you before we process it.",
            "If a delivered concept misses the brief, use the revision rounds included in your tier. Those are free.",
            "Approved final deliverables are non-refundable.",
          ]}
        />
      </Section>
      <Section title="Ongoing services">
        <p>
          For monthly services (social media management, thumbnail packs), cancel before the next
          billing cycle and the following month won't be charged. The current month is already in
          production and isn't refunded.
        </p>
      </Section>
      <Section title="How refunds are paid">
        <p>
          Refunds go back to the UPI account you paid from, within 5–7 business days of the
          refund being confirmed. We'll keep you posted in chat the whole way.
        </p>
      </Section>
    </>
  );
}
