import { cn } from "@/lib/utils";
import { motion, stagger, useAnimate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Words fade and un-blur into place one after another — but only once the
 * block has actually been scrolled into view, and not at all for visitors who
 * asked their OS for reduced motion (they get the finished sentence).
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
  const scope = useRef<HTMLDivElement>(null);
  const inView = useInView(scope, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [run, animate] = useAnimate();

  const wordList = words.split(" ");

  useEffect(() => {
    if (!inView || reduced) return;
    void run(
      "span",
      { opacity: 1, filter: "blur(0px)" },
      { duration, delay: stagger(step) },
    );
    // `run` is stable per scope in framer-motion; re-running on scope changes
    // would replay the animation, so only the trigger signals are depended on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, duration, step]);

  return (
    <div
      ref={scope}
      className={cn(
        "text-base leading-relaxed text-muted-foreground sm:text-lg",
        className,
      )}
    >
      {wordList.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          className={reduced ? "inline" : "inline-block"}
          {...(reduced
            ? {}
            : {
                initial: { opacity: 0, filter: "blur(10px)" },
                // The animation above drives the spans; nothing else to set.
              })}
        >
          {word}{" "}
        </motion.span>
      ))}
    </div>
  );
}