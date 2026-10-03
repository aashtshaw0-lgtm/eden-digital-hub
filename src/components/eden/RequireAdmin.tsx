import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { RequireAuth } from "@/components/RequireAuth";

/**
 * Role-based guard for the invisible CMS: signed-in managers / super owners
 * only. Everyone else is bounced home — the admin surface simply doesn't
 * exist for them (server mutations enforce the same policy).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth
      redirectImmediately
      title="The console is invite-only"
      description="Sign in with an account that has manager or owner access."
    >
      <AdminRoleGate>{children}</AdminRoleGate>
    </RequireAuth>
  );
}

function AdminRoleGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const role = useQuery(api.users.myRole, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && role === undefined)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (role !== "manager" && role !== "super_owner") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
