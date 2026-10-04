import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * A gallery tile that tilts in 3D toward the pointer.
 *
 * Every value runs through a spring on a motion value rather than React state,
 * so pointer movement never triggers a render — the tilt stays at 60fps even
 * with a full grid of tiles on screen. On touch devices (no hover) the spring
 * rests at 0 and the card simply lifts on tap.
 */

/** Maximum rotation in degrees at the card's corners. */
const MAX_TILT = 12;
/** How far the artwork shifts against the frame, in pixels. */
const PARALLAX = 14;

function usePrefersReducedMotion(): boolean {
  // Read once per mount; the listener only matters for OS-level changes, which
  // the reduced-motion block in index.css already handles visually.
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Portfolio3D({
  url,
  title,
  onBroken,
}: {
  url?: string;
  title: string;
  onBroken: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  // Normalised -0.5..0.5 pointer position within the card.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  // Spring smoothing is what makes this read as a physical object rather than
  // a cursor-following image: the card keeps gliding briefly after the pointer
  // stops, then settles.
  const springConfig = { stiffness: 260, damping: 22, mass: 0.6 };
  const sx = useSpring(px, springConfig);
  const sy = useSpring(py, springConfig);

  const rotateY = useTransform(sx, [-0.5, 0.5], [-MAX_TILT, MAX_TILT]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [MAX_TILT, -MAX_TILT]);

  const shineX = useTransform(sx, [-0.5, 0.5], ["18%", "82%"]);
  const shineY = useTransform(sy, [-0.5, 0.5], ["12%", "88%"]);
  const artX = useTransform(sx, [-0.5, 0.5], [PARALLAX, -PARALLAX]);
  const artY = useTransform(sy, [-0.5, 0.5], [PARALLAX, -PARALLAX]);

  const lift = useSpring(0, { stiffness: 300, damping: 20 });

  // Hoisted out of the JSX: hooks must not be called conditionally, and this
  // one builds a gradient that follows the pointer.
  const shine = useTransform(
    [shineX, shineY],
    ([x, y]) =>
      `radial-gradient(60% 60% at ${x} ${y}, rgba(255,255,255,0.22), transparent 70%)`,
  );

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === "touch") return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
    lift.set(1);
  };

  const handleLeave = () => {
    px.set(0);
    py.set(0);
    lift.set(0);
  };

  return (
    <div
      className="depth-3d"
      onPointerEnter={() => lift.set(1)}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <motion.figure
        ref={ref}
        style={
          reduced
            ? undefined
            : { rotateX, rotateY, transformStyle: "preserve-3d" }
        }
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="clay group relative block overflow-hidden will-change-transform"
      >
        {url ? (
          <motion.img
            src={url}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={onBroken}
            style={reduced ? undefined : { x: artX, y: artY, scale: 1.06 }}
            className="w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="clay-inset flex aspect-[4/3] items-center justify-center border-0">
            <span className="font-display text-lg text-muted-foreground">{title}</span>
          </div>
        )}

        {/* Specular highlight that tracks the pointer — sells the tilt as a
            physical surface catching light rather than a flat image skewing. */}
        {!reduced && (
          <motion.span
            aria-hidden
            style={{ background: shine }}
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}

        {/* Depth frame that separates from the artwork as it tilts. */}
        {!reduced && (
          <motion.span
            aria-hidden
            style={{ opacity: lift, zIndex: 2 }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
          />
        )}

        <figcaption
          style={{ transform: "translateZ(30px)" }}
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t",
            "from-black/75 to-transparent p-4 opacity-0 transition duration-300",
            "group-hover:translate-y-0 group-hover:opacity-100",
          )}
        >
          <span className="text-sm font-medium text-white">{title}</span>
        </figcaption>
      </motion.figure>
    </div>
  );
}