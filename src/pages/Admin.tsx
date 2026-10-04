import { AdminInbox } from "@/components/eden/admin/AdminInbox";
import { AdminOrders } from "@/components/eden/admin/AdminOrders";
import { AdminPortfolio } from "@/components/eden/admin/AdminPortfolio";
import { AdminSettings } from "@/components/eden/admin/AdminSettings";
import { AdminCalculator } from "@/components/eden/admin/AdminCalculator";
import { AdminCredits } from "@/components/eden/admin/AdminCredits";
import { AdminServices } from "@/components/eden/admin/AdminServices";
import { AdminRoles } from "@/components/eden/admin/AdminRoles";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { useState } from "react";

const TABS: { key: string; label: string; superOnly?: boolean }[] = [
  { key: "orders", label: "Orders" },
  { key: "credits", label: "Credits" },
  { key: "inbox", label: "Live Inbox" },
  { key: "portfolio", label: "Portfolio" },
  { key: "services", label: "Services" },
  { key: "website", label: "Website" },
  { key: "calculator", label: "Profit Split" },
  { key: "roles", label: "Roles", superOnly: true },
];

export default function Admin() {
  useSeo({ title: `Eden Console | Eden - Digital Design & Management` });
  const { user } = useAuth();
  const role = useQuery(api.users.myRole);
  const [tab, setTab] = useState<string>("orders");

  const visibleTabs = TABS.filter((t) => !t.superOnly || role === "super_owner");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Invisible CMS
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Eden Console
        </h1>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "clay-sm rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key && "bg-primary text-primary-foreground ring-2 ring-primary/50",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "orders" && <AdminOrders />}
      {tab === "credits" && <AdminCredits />}
      {tab === "inbox" && <AdminInbox />}
      {tab === "portfolio" && <AdminPortfolio />}
      {tab === "services" && <AdminServices />}
      {tab === "website" && <AdminSettings />}
      {tab === "calculator" && <AdminCalculator />}
      {tab === "roles" && role === "super_owner" && (
        <AdminRoles myUserId={user?._id ? String(user._id) : undefined} />
      )}
    </main>
  );
}
