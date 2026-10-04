import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Fades content up as it enters the viewport.
 *
 * One shared transition (a single spring, not a per-call one) keeps every
 * section on the site feeling like the same hand made it. Using
 * `whileInView` with a negative margin means the animation finishes just
 * before the element is properly on screen, so nothing is seen mid-flight.
 *
 * Honours `prefers-reduced-motion` by rendering the content immediately.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  /** Seconds. Use sparingly — long cascades feel sluggish. */
  delay?: number;
  /** Travel distance in pixels. */
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        type: "spring",
        stiffness: 140,
        damping: 22,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}