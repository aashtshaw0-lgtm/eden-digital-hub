import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export function AdminInbox() {
  const sessions = useQuery(api.chat.listSessions);
  const [activeId, setActiveId] = useState<Id<"chatSessions"> | null>(null);
  const sendMessage = useMutation(api.chat.sendMessage);
  const setSessionStatus = useMutation(api.chat.setSessionStatus);
  const [reply, setReply] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions?.find((s) => s._id === activeId) ?? null;
  const messages = useQuery(
    api.chat.getMessages,
    activeId ? { sessionId: activeId } : "skip",
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length, activeId]);

  useEffect(() => {
    if (!activeId && sessions && sessions.length > 0) {
      const firstActive = sessions.find((s) => s.status === "active") ?? sessions[0];
      setActiveId(firstActive._id);
    }
  }, [sessions, activeId]);

  const sorted = [...(sessions ?? [])].sort(
    (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
  );

  const send = async () => {
    if (!active || !reply.trim()) return;
    const text = reply;
    setReply("");
    try {
      await sendMessage({ sessionId: active._id, content: text });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* Sessions */}
      <div className="clay max-h-[60vh] overflow-y-auto p-2">
        {sorted.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No chat sessions yet.</p>
        ) : (
          sorted.map((s) => (
            <button
              key={s._id}
              onClick={() => setActiveId(s._id)}
              className={cn(
                "mb-1.5 block w-full rounded-xl px-3.5 py-3 text-left transition-colors",
                s._id === activeId ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-secondary/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{s.clientName}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    s.status === "active"
                      ? "bg-emerald-600/15 text-emerald-700"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {s.status}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {s.lastMessage ?? s.clientEmail}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Thread */}
      <div className="clay flex max-h-[60vh] min-h-[320px] flex-col">
        {active ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{active.clientName}</p>
                <p className="text-[11px] text-muted-foreground">{active.clientEmail}</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await setSessionStatus({
                      sessionId: active._id,
                      status: active.status === "resolved" ? "active" : "resolved",
                    });
                    toast.success(active.status === "resolved" ? "Reopened" : "Marked resolved");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Update failed");
                  }
                }}
                className="clay-sm inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {active.status === "resolved" ? (
                  <>
                    <CheckCheck className="size-3.5" /> Reopen
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" /> Mark resolved
                  </>
                )}
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages?.map((m) => (
                <div
                  key={m._id}
                  className={cn("flex", m.senderRole === "manager" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                      m.senderRole === "manager"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "clay-sm rounded-bl-md",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {messages?.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No messages yet — say hi.
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-center gap-2 border-t border-border/60 p-3"
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply to the client…"
                className="clay-inset min-w-0 flex-1 rounded-full px-4 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!reply.trim()}
                className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <p className="m-auto text-sm text-muted-foreground">Select a conversation.</p>
        )}
      </div>
    </div>
  );
}
