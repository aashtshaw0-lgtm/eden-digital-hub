import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * A gallery tile that behaves like a physical print under glass.
 *
 * Four layers sit at different depths inside one `preserve-3d` stack — the
 * frame, the artwork, the caption and the specular highlight — so the tile
 * genuinely rotates in 3D rather than being a flat image skewed with a
 * transform. Every value is a spring on a motion value, so pointer movement
 * drives the animation without ever re-rendering React.
 */

/** Rotation in degrees at the tile's corners. */
const MAX_TILT = 14;
/** Depth of each layer, in pixels. Larger = further from the viewer. */
const DEPTH_ART = 34;
const DEPTH_CAPTION = 62;
const DEPTH_SHEEN = 20;

export function Portfolio3D({
  url,
  title,
  onBroken,
  index = 0,
}: {
  url?: string;
  title: string;
  onBroken: () => void;
  /** Position in the grid, used to cascade the entrance. */
  index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Pointer position within the tile, normalised to -0.5..0.5.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // 0 while the pointer is away, 1 while it is over the tile.
  const hoverRaw = useMotionValue(0);

  // The springs are what make this read as an object with mass: the tile keeps
  // gliding briefly after the pointer stops, then settles instead of snapping.
  const sx = useSpring(px, { stiffness: 220, damping: 20, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 220, damping: 20, mass: 0.7 });
  const hover = useSpring(hoverRaw, { stiffness: 300, damping: 24 });

  const rotateY = useTransform(sx, [-0.5, 0.5], [-MAX_TILT, MAX_TILT]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [MAX_TILT, -MAX_TILT]);

  // Counter-parallax: the artwork shifts against the frame as the tile turns.
  const artX = useTransform(sx, [-0.5, 0.5], [22, -22]);
  const artY = useTransform(sy, [-0.5, 0.5], [22, -22]);
  const artScale = useTransform(hover, [0, 1], [1.04, 1.12]);

  // The tile lifts toward the viewer on hover, not just sideways. Combined with
  // the tilt this is what makes it read as a physical print rather than a
  // skewed image.
  const liftZ = useTransform(hover, [0, 1], [0, 34]);

  // The specular highlight tracks the pointer like light on glass.
  const sheenX = useTransform(sx, [-0.5, 0.5], ["20%", "80%"]);
  const sheenY = useTransform(sy, [-0.5, 0.5], ["14%", "86%"]);
  const sheenOpacity = useTransform(hover, [0, 1], [0, 0.85]);

  // The cast shadow slides opposite the tilt, which is what sells the height.
  const shadowX = useTransform(sx, [-0.5, 0.5], [-14, 14]);
  const shadowY = useTransform(sy, [-0.5, 0.5], [-10, 18]);
  

  // All of the above are built unconditionally at the top of the component;
  // `reduced` only decides whether they are applied, so no hook order can drift.
  const sheen = useTransform(
    [sheenX, sheenY],
    ([x, y]) =>
      `radial-gradient(65% 65% at ${x} ${y}, rgba(255,255,255,0.30), transparent 68%)`,
  );
  const shadowBlurPx = useTransform(hover, [0, 1], [16, 44]);
  // Hoisted: hooks cannot be called conditionally, and this renders inside a
  // `!reduced` branch.
  const shadowFilter = useTransform(
    shadowBlurPx,
    (b) => `blur(${b}px)`,
  );

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === "touch") return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    px.set(0);
    py.set(0);
    hoverRaw.set(0);
  };

  return (
    <div
      className="depth-3d"
      onPointerEnter={() => hoverRaw.set(1)}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {/* Cast shadow sits behind the tile and moves with it. */}
      {!reduced && (
        <motion.span
          aria-hidden
          style={{ x: shadowX, y: shadowY, filter: shadowFilter }}
          className="pointer-events-none absolute inset-x-2 -bottom-1 h-6 rounded-[50%] opacity-70 blur-lg"
        />
      )}

      <motion.figure
        ref={ref}
        style={
          reduced
            ? undefined
            : {
                rotateX,
                rotateY,
                z: liftZ,
                transformStyle: "preserve-3d" as const,
              }
        }
        // The entrance is a 3D flip-in: the tile arrives standing up, then
        // settles flat, which sets up the tilt before the pointer ever arrives.
        // The per-column delay cascades the grid instead of landing as one block.
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, rotateX: 22 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: "-70px" }}
        transition={{
          type: "spring",
          stiffness: 110,
          damping: 18,
          mass: 0.9,
          delay: reduced ? 0 : Math.min(index * 0.08, 0.6),
        }}
        className="clay group relative block overflow-hidden will-change-transform"
      >
        {url ? (
          <motion.img
            src={url}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={onBroken}
            style={
              reduced
                ? undefined
                : {
                    x: artX,
                    y: artY,
                    scale: artScale,
                    transform: `translateZ(${DEPTH_ART}px)`,
                  }
            }
            className="w-full object-cover"
          />
        ) : (
          <div
            style={reduced ? undefined : { transform: `translateZ(${DEPTH_ART}px)` }}
            className="clay-inset flex aspect-[4/3] items-center justify-center border-0"
          >
            <span className="font-display text-lg text-muted-foreground">{title}</span>
          </div>
        )}

        {/* Specular highlight, floating just above the artwork. */}
        {!reduced && (
          <motion.span
            aria-hidden
            style={{ background: sheen, opacity: sheenOpacity, transform: `translateZ(${DEPTH_SHEEN}px)` }}
            className="pointer-events-none absolute inset-0"
          />
        )}

        {/* Inner rim catches the light along the near edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.12)]"
        />

        {/* Caption sits furthest forward, so it appears to float above the print. */}
        <figcaption
          style={reduced ? undefined : { transform: `translateZ(${DEPTH_CAPTION}px)` }}
          className="pointer-events-none absolute inset-x-0 bottom-0 p-4"
        >
          {/* A light scrim keeps the title legible over any artwork without
              hiding it; the title itself still fades in on hover. */}
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="font-display relative translate-y-2 text-sm font-semibold text-white opacity-0 drop-shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            {title}
          </span>
        </figcaption>
      </motion.figure>
    </div>
  );
}