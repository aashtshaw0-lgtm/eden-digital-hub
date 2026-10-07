import { useSettings } from "@/context/SettingsProvider";
import { cn } from "@/lib/utils";
import { EdenWordmark } from "./EdenWordmark";

export function SiteLogo({
  className,
  variant = "light",
  imgProps = {},
  fallbackProps = {},
}: {
  className?: string;
  variant?: "light" | "dark";
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  fallbackProps?: Parameters<typeof EdenWordmark>[0];
}) {
  const { logoUrl, logoDarkUrl } = useSettings();

  const asset = variant === "dark" && logoDarkUrl ? logoDarkUrl : logoUrl;
  const hadLightLogo = Boolean(logoUrl);
  const hadDarkLogo = Boolean(logoDarkUrl);

  if (!asset && !hadLightLogo && !hadDarkLogo) {
    return <EdenWordmark className={cn(undefined, className)} {...fallbackProps} />;
  }

  return (
    <img
      src={asset ?? logoUrl ?? logoDarkUrl}
      alt="Studio logo"
      className={cn("h-auto w-full object-contain", className)}
      {...imgProps}
      loading="eager"
    />
  );
}
