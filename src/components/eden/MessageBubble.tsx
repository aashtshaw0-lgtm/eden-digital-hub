import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * One message bubble, shared by the client chat and the admin inbox.
 *
 * The side is decided by *who is looking*, never by the sender's stored role:
 * your own messages always sit on the right and everyone else's on the left.
 * Keying off role breaks the moment the studio owner is also the person
 * testing their own chat — every message would resolve to "studio" and the
 * thread would collapse into a single column.
 */

export type BubbleSide = "mine" | "theirs";

export function MessageBubble({
  side,
  text,
  senderName,
  createdAt,
  index = 0,
}: {
  side: BubbleSide;
  text: string;
  /** Shown above the other party's messages so it's always clear who spoke. */
  senderName?: string;
  createdAt?: number;
  /** Small stagger so a burst of messages cascades instead of snapping in. */
  index?: number;
}) {
  const isMine = side === "mine";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        // Cap the delay: a long thread should not keep late messages waiting.
        delay: Math.min(index * 0.035, 0.28),
      }}
      className={cn("flex", isMine ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex max-w-[85%] flex-col gap-1", isMine ? "items-end" : "items-start")}>
        {!isMine && senderName && (
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {senderName}
          </span>
        )}

        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            isMine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "clay-sm rounded-bl-md text-foreground",
          )}
        >
          {text}
        </div>

        {createdAt !== undefined && (
          <time
            dateTime={new Date(createdAt).toISOString()}
            className="px-1 text-[10px] tabular-nums text-muted-foreground/70"
          >
            {new Date(createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        )}
      </div>
    </motion.div>
  );
}