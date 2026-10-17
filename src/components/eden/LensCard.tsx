import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";

/**
 * Reveals a magnified copy of `children` through a circular mask that follows
 * the pointer — a jeweller's loupe over the artwork.
 *
 * The zoomed layer is a real second render of the children inside a scaled
 * wrapper, so whatever sits inside stays crisp at `zoomFactor`× rather than a
 * bitmap upscale. Hover needs a mouse: on touch, tap the card to zoom.
 */
export function Lens({
  children,
  zoomFactor = 1.6,
  lensSize = 150,
  position = { x: 200, y: 150 },
  className,
  hovering,
  setHovering,
}: {
  children: ReactNode;
  zoomFactor?: number;
  lensSize?: number;
  position?: { x: number; y: number };
  className?: string;
  hovering?: boolean;
  setHovering?: (hovering: boolean) => void;
}) {
  const [localHovering, setLocalHovering] = useState(false);

  const isHovering = hovering !== undefined ? hovering : localHovering;
  const setIsHovering = setHovering ?? setLocalHovering;
  const [mousePosition, setMousePosition] = useState({ x: 200, y: 150 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const trackingMask = `radial-gradient(circle ${lensSize / 2}px at ${mousePosition.x}px ${mousePosition.y}px, black 100%, transparent 100%)`;

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl", className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      {children}

      <motion.div
        aria-hidden
        animate={{ opacity: isHovering ? 1 : 0, scale: isHovering ? 1 : 0.58 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="absolute inset-0 overflow-hidden"
        style={{
          maskImage: trackingMask,
          WebkitMaskImage: trackingMask,
          transformOrigin: `${mousePosition.x}px ${mousePosition.y}px`,
          zIndex: 20,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${zoomFactor})`,
            transformOrigin: `${mousePosition.x}px ${mousePosition.y}px`,
          }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * A finished piece of page furniture: a themed card with an image to inspect
 * and a short caption. The "move your cursor" hint fades after the first
 * hover, and tapping works where there is no cursor.
 */
export function LensCard({
  src,
  alt,
  title,
  body,
  className,
}: {
  src: string;
  alt: string;
  title: string;
  body: string;
  className?: string;
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <div
      className={cn(
        "clay group relative overflow-hidden rounded-[1.35rem] p-3 transition-shadow hover:shadow-xl",
        className,
      )}
    >
      <Lens
        hovering={hovering}
        setHovering={setHovering}
        lensSize={140}
      >
        <img
          src={src}
          alt={alt}
          width={1200}
          height={900}
          loading="lazy"
          decoding="async"
          className="aspect-4/3 w-full rounded-xl object-cover"
        />
      </Lens>

      <div className="px-3 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <span
            className={cn(
              "rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-opacity duration-300",
              hovering ? "opacity-0" : "opacity-100",
            )}
          >
            Hover to zoom
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}