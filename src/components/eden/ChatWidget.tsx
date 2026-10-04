import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUp, Bot, MessagesSquare, Sparkles, X } from "lucide-react";
import { MessageBubble } from "@/components/eden/MessageBubble";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";


type Mode = "closed" | "choose" | "ai" | "manager";

export function ChatWidget() {
  const [mode, setMode] = useState<Mode>("closed");

  return (
    <>
      <AnimatePresence>
        {mode !== "closed" && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass fixed bottom-20 right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl sm:right-6"
          >
            {mode === "choose" && <Chooser onPick={setMode} onClose={() => setMode("closed")} />}
            {mode === "ai" && <AiChat onBack={() => setMode("choose")} />}
            {mode === "manager" && <ManagerChat onBack={() => setMode("choose")} />}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setMode((m) => (m === "closed" ? "choose" : "closed"))}
        className="clay fixed bottom-4 right-4 z-50 flex size-14 items-center justify-center rounded-full text-primary shadow-xl sm:bottom-6 sm:right-6"
        aria-label={mode === "closed" ? "Open chat" : "Close chat"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode === "closed" ? "chat" : "x"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {mode === "closed" ? <MessagesSquare className="size-6" /> : <X className="size-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}

function Chooser({
  onPick,
  onClose,
}: {
  onPick: (m: Mode) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold">How can we help?</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <button
        onClick={() => onPick("ai")}
        className="clay-sm clay-press flex items-start gap-3 p-4 text-left"
      >
        <span className="tint flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold">Eden Assistant (Instant)</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Pricing, tiers and turnaround — answered in seconds.
          </span>
        </span>
      </button>
      <button
        onClick={() => onPick("manager")}
        className="clay-sm clay-press flex items-start gap-3 p-4 text-left"
      >
        <span className="tint flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Bot className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold">Talk to Manager (Live)</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            A real human on a live channel — for quotes & custom work.
          </span>
        </span>
      </button>
    </div>
  );
}

interface Msg {
  role: "user" | "model";
  text: string;
}

function AiChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "model",
      text: "Hi, I'm Eden's assistant 🌿 Ask me about our services, tiers or pricing — I know the full menu.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const askAi = useAction(api.ai.assistantReply);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await askAi({ history: next });
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "I hit a snag — please try again, or use 'Talk to Manager' for a human." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChatShell title="Eden Assistant" subtitle="Instant · always on" onBack={onBack} scrollRef={scrollRef}>
      {messages.map((m, i) => (
        <Bubble key={i} index={i} fromAi={m.role === "model"} text={m.text} />
      ))}
      {busy && (
        <div className="flex gap-1 px-2 py-1">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              className="size-1.5 rounded-full bg-primary/60"
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: d * 0.15 }}
            />
          ))}
        </div>
      )}
      <ChatInput value={input} onChange={setInput} onSend={send} disabled={busy} />
    </ChatShell>
  );
}

function ManagerChat({ onBack }: { onBack: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useQuery(api.chat.mySession, isAuthenticated ? {} : "skip");
  const startSession = useMutation(api.chat.startSession);
  const sendMessage = useMutation(api.chat.sendMessage);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Guards against firing the mutation twice while the first is in flight.
  // A ref (not state) because this is not rendered.
  const startingRef = useRef(false);

  // "Starting" is derived from the session not existing yet, so no state has
  // to be set from inside the effect.
  const hasSession = session !== null;

  useEffect(() => {
    if (!isAuthenticated || hasSession || startingRef.current) return;
    startingRef.current = true;
    void startSession().finally(() => {
      startingRef.current = false;
    });
  }, [isAuthenticated, hasSession, startSession]);

  const messages = useQuery(
    api.chat.getMessages,
    session ? { sessionId: session._id } : "skip",
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  if (!isAuthenticated) {
    return (
      <ChatShell title="Live Manager" subtitle="Live · human" onBack={onBack} scrollRef={scrollRef}>
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <span className="tint flex size-12 items-center justify-center rounded-2xl">
            <Bot className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Sign in so the manager knows who they're talking to — your chat history stays in your portal.
          </p>
          <button
            onClick={() => navigate(`/auth?returnTo=${encodeURIComponent(location.pathname)}`)}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm"
          >
            Sign in to chat
          </button>
        </div>
      </ChatShell>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || !session) return;
    setInput("");
    try {
      await sendMessage({ sessionId: session._id, content: text });
    } catch (err) {
      // Rate limiter and permission errors come back as thrown errors — put the
      // message back so nothing the client typed is lost.
      setInput(text);
      toast.error(err instanceof Error ? err.message : "Message failed to send.");
    }
  };

  return (
    <ChatShell
      title="Live Manager"
      subtitle={session?.status === "resolved" ? "Resolved · send to reopen" : "Live · usually replies fast"}
      onBack={onBack}
      scrollRef={scrollRef}
    >
      {messages === undefined ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">Connecting…</p>
      ) : messages.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Say hello — {user?.email ?? "you"} are chatting with the Eden team.
        </p>
      ) : (
        messages.map((m, i) => (
          <MessageBubble
            key={m._id}
            side={m.senderRole === "manager" ? "studio" : "client"}
            text={m.content}
            senderName={m.senderRole === "manager" ? "Eden studio" : undefined}
            createdAt={m.createdAt}
            index={i}
          />
        ))
      )}
      <ChatInput value={input} onChange={setInput} onSend={send} disabled={!session} />
    </ChatShell>
  );
}

function ChatShell({
  title,
  subtitle,
  onBack,
  scrollRef,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground" aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function Bubble({
  fromAi,
  text,
  index,
}: {
  fromAi: boolean;
  text: string;
  index?: number;
}) {
  // Assistant replies read as the studio's voice, so they use the same
  // left-hand bubble as a manager's reply.
  return (
    <MessageBubble side={fromAi ? "studio" : "client"} text={text} index={index} />
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="flex items-center gap-2 border-t border-border/60 p-3"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a message…"
        className="clay-inset min-w-0 flex-1 rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity disabled:opacity-40"
        aria-label="Send"
      >
        <ArrowUp className="size-4" />
      </button>
    </form>
  );
}
