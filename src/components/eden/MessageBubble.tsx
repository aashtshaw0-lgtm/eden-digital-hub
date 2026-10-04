import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * One message bubble, shared by the client chat and the admin inbox.
 *
 * The two views previously carried their own inline markup and their own idea
 * of which side a message belongs to. Centralising it means the client always
 * sees the studio on the left and their own words on the right, while the
 * manager sees their replies on the right — so the two threads read as mirror
 * images of each other and can never accidentally agree on a side by accident.
 */

export type BubbleSide = "studio" | "client";

export function MessageBubble({
  side,
  text,
  senderName,
  createdAt,
  index = 0,
}: {
  side: BubbleSide;
  text: string;
  /** Shown above studio messages so the client always knows who is typing. */
  senderName?: string;
  createdAt?: number;
  /** Small stagger so a burst of messages cascades instead of snapping in. */
  index?: number;
}) {
  const isStudio = side === "studio";

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
      className={cn("flex", isStudio ? "justify-start" : "justify-end")}
    >
      <div className={cn("flex max-w-[85%] flex-col gap-1", isStudio ? "items-start" : "items-end")}>
        {isStudio && senderName && (
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {senderName}
          </span>
        )}

        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            isStudio
              ? "clay-sm rounded-bl-md text-foreground"
              : "rounded-br-md bg-primary text-primary-foreground",
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