import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AdminRoles({ myUserId }: { myUserId?: string }) {
  const users = useQuery(api.users.listAll);
  const setRole = useMutation(api.users.setRole);

  if (users === undefined) {
    return <div className="clay h-64 animate-pulse opacity-60" />;
  }

  return (
    <div className="clay overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3.5 font-medium">User</th>
            <th className="px-5 py-3.5 font-medium">Joined</th>
            <th className="px-5 py-3.5 font-medium">Role</th>
            <th className="px-5 py-3.5 text-right font-medium">Manager</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u._id === myUserId;
            const isProtected = u.role === "super_owner";
            const busy = false;
            return (
              <tr key={u._id} className="border-b border-border/50 last:border-0">
                <td className="px-5 py-3.5">
                  <span className="font-medium">
                    {u.name ?? "—"} {isSelf && <span className="text-muted-foreground">(you)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    {u.role === "super_owner" && <Crown className="size-3.5 text-amber-500" />}
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    disabled={isSelf || isProtected}
                    onClick={async () => {
                      try {
                        await setRole({ userId: u._id as never, role: u.role === "manager" ? "customer" : "manager" });
                        toast.success(u.role === "manager" ? "Manager removed" : "Manager assigned");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Change failed");
                      }
                    }}
                    className={
                      isSelf || isProtected
                        ? "cursor-not-allowed rounded-full bg-muted px-3.5 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
                        : u.role === "manager"
                          ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                          : "rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium text-secondary-foreground"
                    }
                    title={isSelf ? "You can't change your own role" : isProtected ? "Protected role" : "Toggle manager"}
                  >
                    {busy ? <Loader2 className="size-3 animate-spin" /> : u.role === "manager" ? "Remove" : "Assign"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
