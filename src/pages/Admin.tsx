import { AdminInbox } from "@/components/eden/admin/AdminInbox";
import { AdminOrders } from "@/components/eden/admin/AdminOrders";
import { AdminPortfolio } from "@/components/eden/admin/AdminPortfolio";
import { AdminSettings } from "@/components/eden/admin/AdminSettings";
import { AdminContent } from "@/components/eden/admin/AdminContent";
import { AdminCalculator } from "@/components/eden/admin/AdminCalculator";
import { AdminCredits } from "@/components/eden/admin/AdminCredits";
import { AdminCoupons } from "@/components/eden/admin/AdminCoupons";
import { AdminServices } from "@/components/eden/admin/AdminServices";
import { AdminProducts } from "@/components/eden/admin/AdminProducts";
import { AdminRoles } from "@/components/eden/admin/AdminRoles";
import { useContent } from "@/context/ContentProvider";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { useState } from "react";

const TABS: { key: string; label: string; superOnly?: boolean }[] = [
  { key: "orders", label: "Orders" },
  { key: "credits", label: "Credits" },
  { key: "coupons", label: "Coupons" },
  { key: "inbox", label: "Live chat" },
  { key: "portfolio", label: "Portfolio" },
  { key: "services", label: "Services" },
  { key: "products", label: "Products & people" },
  { key: "website", label: "Website" },
  { key: "words", label: "Words & copy" },
  { key: "calculator", label: "Profit split" },
  { key: "roles", label: "Roles", superOnly: true },
];

export default function Admin() {
  const { t, brandName } = useContent();
  useSeo({ title: `${brandName} console | ${t("nav.console")}`, noIndex: true });
  const { user } = useAuth();
  const role = useQuery(api.users.myRole);
  const [tab, setTab] = useState<string>("orders");

  const visibleTabs = TABS.filter(
    (t) => !t.superOnly || role === "super_owner",
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Invisible back office
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {brandName} console
        </h1>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "clay-sm tap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key && "bg-primary text-primary-foreground ring-2 ring-primary/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "orders" && <AdminOrders />}
      {tab === "credits" && <AdminCredits />}
      {tab === "coupons" && <AdminCoupons />}
      {tab === "inbox" && <AdminInbox />}
      {tab === "portfolio" && <AdminPortfolio />}
      {tab === "services" && <AdminServices />}
      {tab === "products" && <AdminProducts />}
      {tab === "website" && <AdminSettings />}
      {tab === "words" && <AdminContent />}
      {tab === "calculator" && <AdminCalculator />}
      {tab === "roles" && role === "super_owner" && (
        <AdminRoles myUserId={user?._id ? String(user._id) : undefined} />
      )}
    </main>
  );
}
