import { useSettings } from "@/context/SettingsProvider";
import { cn } from "@/lib/utils";
import { EdenWordmark } from "./EdenWordmark";

export function SiteLogo({
  className,
  imgProps = {},
  fallbackProps = {},
}: {
  className?: string;
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  fallbackProps?: Parameters<typeof EdenWordmark>[0];
}) {
  const { logoUrl } = useSettings();
  const hasLogo = Boolean(logoUrl);

  return (
    <>
      {hasLogo ? (
        <img
          src={logoUrl}
          alt="Studio logo"
          className={cn("h-auto w-full object-contain", className)}
          {...imgProps}
          loading="eager"
        />
      ) : (
        <EdenWordmark className={cn(undefined, className)} {...fallbackProps} />
      )}
    </>
  );
}
