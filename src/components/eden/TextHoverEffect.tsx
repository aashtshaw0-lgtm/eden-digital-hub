import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

/**
 * A big outlined word that draws itself in, then fills with a warm gradient
 * exactly where the cursor rests.
 *
 * Three layers share the same geometry so they register perfectly:
 *  1. the outlined text that animates in and softens on hover,
 *  2. the gradient stops, always rendered,
 *  3. the same text stroked with that gradient, revealed through a radial mask
 *     that follows the pointer.
 *
 * `textLength` keeps the word centred in the viewBox whatever title length the
 * console allows, so it never overflows the 300×100 box.
 */
export function TextHoverEffect({
  text,
  /** Mask-follow animation, in seconds. */
  duration = 0.45,
  className,
}: {
  text: string;
  duration?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `text-gradient-${uid}`;
  const maskId = `text-mask-${uid}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setMaskPosition({
      cx: `${((cursor.x - rect.left) / rect.width) * 100}%`,
      cy: `${((cursor.y - rect.top) / rect.height) * 100}%`,
    });
  }, [cursor]);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={text}
      viewBox="0 0 300 100"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full select-none", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="20" y1="40" x2="280" y2="70">
          <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
          <stop offset="35%" style={{ stopColor: "#c75d3c" }} />
          <stop offset="70%" style={{ stopColor: "#b8862d" }} />
          <stop offset="100%" style={{ stopColor: "#3a7d8c" }} />
        </linearGradient>

        <motion.radialGradient
          id={maskId}
          gradientUnits="userSpaceOnUse"
          r="34%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: reduced ? 0 : duration, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>

        <mask id={`${maskId}-rect`}>
          <rect x="0" y="0" width="300" height="100" fill={`url(#${maskId})`} />
        </mask>
      </defs>

      {/* Outline layer: draws itself in once, then softens on hover. */}
      <motion.text
        x="150"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength={264}
        lengthAdjust="spacingAndGlyphs"
        pathLength={1}
        strokeWidth={0.5}
        fill="transparent"
        strokeDasharray={reduced ? undefined : 1}
        initial={reduced ? undefined : { strokeDashoffset: 1 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{
          duration: reduced ? 0 : 2.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.01em",
          stroke: "var(--border)",
          opacity: hovered ? 0.6 : 0.4,
          transition: "opacity 400ms ease",
        }}
      >
        {text}
      </motion.text>

      {/* Gradient layer: revealed only where the cursor is. */}
      <text
        x="150"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength={264}
        lengthAdjust="spacingAndGlyphs"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={0.7}
        mask={`url(#${maskId}-rect)`}
        aria-hidden
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.01em",
          opacity: hovered ? 1 : 0,
          transition: "opacity 400ms ease",
        }}
      >
        {text}
      </text>
    </svg>
  );
}