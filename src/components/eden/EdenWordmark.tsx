import { cn } from "@/lib/utils";

/**
 * The studio wordmark: four torn-paper tiles spelling "Eden".
 *
 * Drawn as inline SVG rather than shipped as a bitmap so it stays crisp at any
 * size, inherits no external asset, and can be recoloured per tile without a
 * second file. Each tile is slightly rotated and its outline is a jagged
 * polygon, which is what gives the collage its torn-paper look.
 */
export function EdenWordmark({
  className,
  /** Show the "Digital design & management" strapline under the tiles. */
  withTagline = false,
}: {
  className?: string;
  withTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <svg
        viewBox="0 0 300 96"
        role="img"
        aria-label="Eden"
        className="h-auto w-full"
      >
        {/* E — black tile */}
        <g transform="rotate(-3 38 48)">
          <path
            d="M8 8 L68 4 L72 50 L69 92 L10 96 L5 52 Z"
            fill="#14110f"
          />
          <text
            x="38"
            y="76"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="72"
            fill="#f4efe6"
          >
            E
          </text>
        </g>

        {/* d — red tile */}
        <g transform="rotate(2.5 112 48)">
          <path
            d="M82 5 L142 8 L146 52 L143 93 L84 96 L80 50 Z"
            fill="#c0272d"
          />
          <text
            x="113"
            y="77"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="72"
            fill="#14110f"
          >
            d
          </text>
        </g>

        {/* e — cream tile */}
        <g transform="rotate(-2 188 48)">
          <path
            d="M158 4 L218 7 L221 51 L218 94 L159 92 L155 48 Z"
            fill="#e6d9c2"
          />
          <text
            x="188"
            y="77"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="72"
            fill="#a8242b"
          >
            e
          </text>
        </g>

        {/* n — navy tile */}
        <g transform="rotate(3 264 48)">
          <path
            d="M234 6 L294 4 L297 50 L294 93 L235 96 L231 52 Z"
            fill="#1e3a5f"
          />
          <text
            x="264"
            y="77"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="72"
            fill="#f4efe6"
          >
            n
          </text>
        </g>
      </svg>

      {withTagline && (
        <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Digital design &amp; management
        </span>
      )}
    </span>
  );
}

/**
 * A compact square version for places that need an icon-sized mark (favicon
 * fallbacks, avatar slots). Shows the E tile alone rather than the full
 * wordmark, which would be illegible below ~120px.
 */
export function EdenMonogram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label="Eden"
      className={cn("size-9", className)}
    >
      <rect width="96" height="96" rx="20" fill="#14110f" />
      <text
        x="48"
        y="73"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="72"
        fill="#f4efe6"
      >
        E
      </text>
    </svg>
  );
}