import { useContent } from "@/context/ContentProvider";
import { useSettings } from "@/context/SettingsProvider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const WORD_SIZE = {
  sm: "text-lg sm:text-xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-5xl",
} as const;

const TAG_SIZE = {
  sm: "text-[9px]",
  md: "text-[11px]",
  lg: "text-[11px] sm:text-xs",
} as const;

/**
 * The studio's logo, wherever it appears.
 *
 * Two sources, no built-in fallback mark:
 *  1. the uploaded image (`logoMode: "image"`, or unset with an image present)
 *  2. the wordmark — `brandWord` when set, otherwise the studio's own name
 *     (`brand.name`), so the header always carries *your* words and never a
 *     hardcoded one.
 *
 * When neither exists the component renders nothing rather than inventing a
 * mark for the studio.
 *
 * A consumer can pin the surface with `variant`; without it the component
 * follows the document's dark-mode class, so the text logo recolours itself.
 */
export function SiteLogo({
  className,
  variant,
  size = "md",
  imgProps = {},
}: {
  className?: string;
  variant?: "light" | "dark";
  size?: keyof typeof WORD_SIZE;
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
}) {
  const { brandName } = useContent();
  const {
    logoUrl,
    logoDarkUrl,
    logoMode,
    brandWord,
    brandTagline,
    logoLightColor,
    logoDarkColor,
  } = useSettings();

  // Which surface the text logo should be coloured for.
  const [surface, setSurface] = useState<"light" | "dark">(
    variant === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    if (variant) {
      setSurface(variant === "dark" ? "dark" : "light");
      return;
    }
    // Default detection: follow the document's dark-mode class if present.
    const check = () => {
      setSurface(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    };
    check();
    const onChange = () => check();
    document.addEventListener("color-scheme-change", onChange);
    return () => document.removeEventListener("color-scheme-change", onChange);
  }, [variant]);

  // The studio's own word — the explicit logo word wins, otherwise the name.
  const word = (brandWord ?? "").trim() || brandName.trim();
  const hasWord = word.length > 0;
  const onDark = surface === "dark";
  const imageSrc = (onDark && logoDarkUrl) || logoUrl || null;

  // An explicit choice in the console wins; otherwise an uploaded image is
  // preferred over the wordmark, matching the console's own default.
  const useImage = logoMode === "text" ? false : Boolean(imageSrc);

  if (useImage && imageSrc) {
    return (
      <img
        src={imageSrc}
        alt="Studio logo"
        className={cn("h-auto w-full object-contain", className)}
        {...imgProps}
        loading="eager"
      />
    );
  }

  if (hasWord) {
    return (
      <span
        className={cn(
          "font-display inline-flex max-w-full flex-col items-center gap-0.5 leading-none text-balance",
          className,
        )}
        style={{ color: (onDark ? logoDarkColor : logoLightColor) || undefined }}
      >
        <span className={cn("font-semibold", WORD_SIZE[size])}>{word}</span>
        {brandTagline && (
          <span
            className={cn(
              "font-medium uppercase tracking-[0.18em] text-muted-foreground",
              TAG_SIZE[size],
            )}
          >
            {brandTagline}
          </span>
        )}
      </span>
    );
  }

  // Nothing configured yet — render nothing rather than a placeholder mark.
  return null;
}
