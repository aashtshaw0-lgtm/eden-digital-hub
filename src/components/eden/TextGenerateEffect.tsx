import { cn } from "@/lib/utils";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";

/**
 * Words fade and un-blur one after another — but only once the block has been
 * scrolled into view, and not at all for visitors whose OS asks for reduced
 * motion: they get the finished sentence.
 */
export function TextGenerateEffect({
  words,
  className,
  /** Seconds each word takes to settle. */
  duration = 0.5,
  /** Seconds between one word starting and the next. */
  step = 0.08,
}: {
  words: string;
  className?: string;
  duration?: number;
  step?: number;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <p
        className={cn(
          "text-base leading-relaxed text-muted-foreground sm:text-lg",
          className,
        )}
      >
        {words}
      </p>
    );
  }

  const wordList = words.split(" ");

  return (
    <motion.div
      className={cn(
        "text-base leading-relaxed text-muted-foreground sm:text-lg",
        className,
      )}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ hidden: {}, shown: {} }}
    >
      {wordList.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          variants={{
            hidden: {
              opacity: 0,
              filter: "blur(10px)",
            },
            shown: {
              opacity: 1,
              filter: "blur(0px)",
              transition: { duration, delay: idx * step },
            },
          }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.div>
  );
}