import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The studio's motion kit.
 *
 * Everything here is built from Framer Motion transforms and CSS keyframes — no
 * WebGL and no extra dependency — so the depth and parallax come from real
 * perspective transforms on real DOM nodes. That keeps it cheap on phones and
 * keeps every piece of text selectable and accessible.
 *
 * Each piece reads the brand colours from CSS variables (--primary /
 * --background), so re-theming from the console re-themes the motion too.
 */

/** Thin scroll progress bar pinned to the very top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.001,
  });
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[65] h-[3px] origin-left bg-gradient-to-r from-primary/10 via-primary to-primary/10"
    />
  );
}

/** Slow drifting colour field for hero and section backdrops. */
export function AuroraBackground({
  className,
  variant = "warm",
}: {
  className?: string;
  variant?: "warm" | "cool";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <span className={cn("aurora-blob", variant === "warm" ? "aurora-1" : "aurora-2")} />
      <span className="aurora-blob aurora-2" />
      <span className="aurora-blob aurora-3" />
      <span className="eden-grain" />
    </div>
  );
}

/**
 * Seamless horizontal marquee. Children are rendered twice inside two identical
 * halves, so translating the track by exactly -50% loops without a seam.
 */
export function Marquee({
  children,
  seconds = 38,
  reverse = false,
  className,
  itemClassName,
}: {
  children: ReactNode;
  /** Seconds for one full pass. Higher is slower. */
  seconds?: number;
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  const reduced = useReducedMotion();
  const half = (
    <div className={cn("flex shrink-0 items-center gap-8 pr-8", itemClassName)}>
      {children}
    </div>
  );
  return (
    <div
      className={cn(
        "marquee-mask group relative flex overflow-hidden",
        className,
      )}
    >
      <div
        className={cn("marquee-track flex w-max", !reduced && "group-hover:[animation-play-state:paused]")}
        style={
          reduced
            ? undefined
            : {
                animationDuration: `${seconds}s`,
                animationDirection: reverse ? "reverse" : "normal",
              }
        }
      >
        {half}
        {half}
      </div>
    </div>
  );
}

/**
 * Card that leans toward the pointer in real 3D, with a light spot that tracks
 * the cursor across its surface.
 */
export function TiltCard({
  children,
  className,
  /** Maximum rotation in degrees at the card's edge. */
  intensity = 9,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glare?: boolean;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(0, { stiffness: 220, damping: 22, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 220, damping: 22, mass: 0.6 });
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const [hovering, setHovering] = useState(false);

  if (reduced) return <div className={className}>{children}</div>;

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * intensity * 2);
    rotateX.set(-py * intensity * 2);
    setSpot({ x: (px + 0.5) * 100, y: (py + 0.5) * 100 });
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
    setHovering(false);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={move}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 900, transformStyle: "preserve-3d" }}
      className={cn("relative", className)}
    >
      {children}
      {glare && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: hovering ? 1 : 0,
            background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 62%)`,
          }}
        />
      )}
    </motion.div>
  );
}

/** Pulls its child gently toward the pointer — used on primary calls to action. */
export function Magnetic({
  children,
  className,
  strength = 10,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 260, damping: 20 });
  const y = useSpring(0, { stiffness: 260, damping: 20 });

  if (reduced) return <div className={cn("inline-flex", className)}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set(((e.clientX - rect.left) / rect.width - 0.5) * strength * 2);
        y.set(((e.clientY - rect.top) / rect.height - 0.5) * strength * 2);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x, y }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}

/** Counts a number up once it scrolls into view. */
export function CountUp({
  to,
  duration = 1.5,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      // Ease-out cubic: fast at the start, settling gently on the final digit.
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration, reduced]);

  const shown = reduced ? to : value;
  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/** Animated gradient text used for the single emphasised word in a headline. */
export function ShimmerText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{children}</span>;
  return (
    <span className={cn("shimmer-text", className)}>{children}</span>
  );
}

/** Rotating conic ring, wrapped around a small mark or avatar. */
export function OrbitRing({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("orbit-ring relative inline-flex", className)}>
      <span className="relative z-10">{children}</span>
    </span>
  );
}
