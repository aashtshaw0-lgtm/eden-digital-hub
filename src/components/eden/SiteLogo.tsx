import { useSettings } from "@/context/SettingsProvider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { EdenWordmark } from "./EdenWordmark";

export function SiteLogo({
  className,
  variant,
  imgProps = {},
  fallbackProps = {},
}: {
  className?: string;
  variant?: "light" | "dark";
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  fallbackProps?: Parameters<typeof EdenWordmark>[0];
}) {
  const {
    logoUrl,
    logoDarkUrl,
    brandWord,
    brandTagline,
    logoLightColor,
    logoDarkColor,
  } = useSettings();

  // Pick which surface color the text logo should use.
  // A consumer may force it with `variant`; otherwise we detect dark mode.
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

  const logoTextColor =
    surface === "dark"
      ? logoDarkColor ?? ""
      : logoLightColor ?? "";

  // 1) Image logo wins when set.
  const imageSrc =
    (variant === "dark" && logoDarkUrl) || logoUrl || null;

  if (imageSrc) {
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

  // 2) Text/logo-word logo when a brand word is set.
  if (brandWord && brandWord.trim()) {
    return (
      <span
        className={cn(
          "inline-flex flex-col items-center gap-0.5 font-display leading-none text-balance",
          className,
        )}
        style={{
          color: logoTextColor || undefined,
        }}
      >
        <span className="text-2xl font-semibold sm:text-3xl">{brandWord}</span>
        {brandTagline && (
          <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
            {brandTagline}
          </span>
        )}
      </span>
    );
  }

  // 3) Last resort: the built Eden wordmark.
  return (
    <EdenWordmark className={cn(undefined, className)} {...fallbackProps} />
  );
}
