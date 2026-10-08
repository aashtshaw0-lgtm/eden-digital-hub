import { api } from "@/convex/_generated/api";
import { AdminBrandKit } from "@/components/eden/admin/AdminBrandKit";
import { useContent } from "@/context/ContentProvider";
import { useSettings } from "@/context/SettingsProvider";
import { cn } from "@/lib/utils";
import { useAction, useMutation } from "convex/react";
import { CloudUpload, Loader2, Palette, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const inputCls =
  "clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

// Preset colour combinations for quick switching (two-color themes)
const COLOR_THEMES = [
  {
    name: "Studio Original",
    primary: "#2f6b4f",
    background: "#f6f2ea",
    description: "Warm paper & botanical ink-green",
  },
  {
    name: "Warm Sunset",
    primary: "#c75d3c",
    background: "#fdf6f0",
    description: "Terracotta clay on cream",
  },
  {
    name: "Ocean Calm",
    primary: "#3a7d8c",
    background: "#f0f5f7",
    description: "Seafoam teal on soft blue-white",
  },
  {
    name: "Midnight Forest",
    primary: "#1a3a2f",
    background: "#f5f3f0",
    description: "Deep forest on warm white",
  },
  {
    name: "Royal Plum",
    primary: "#6b4f7a",
    background: "#f8f6fa",
    description: "Rich plum on lavender white",
  },
  {
    name: "Golden Hour",
    primary: "#b8862d",
    background: "#fdf8ed",
    description: "Warm gold on sunlit cream",
  },
  {
    name: "Charcoal & Clay",
    primary: "#8b7355",
    background: "#f2efe9",
    description: "Earthy taupe on stone",
  },
  {
    name: "Sage & Stone",
    primary: "#7a9b7e",
    background: "#f4f6f3",
    description: "Soft sage on pale green-white",
  },
];

// The four colour combos shown on the landing page. Each one maps to a
// primary + background pair stored in globalSettings, so picking a combo here
// is what re-themes the whole site.
const COLOR_COMBOS = [
  {
    id: "studio-original",
    name: "Studio Original",
    description: "Warm paper & botanical ink-green",
    primary: "#2f6b4f",
    background: "#f6f2ea",
  },
  {
    id: "plum-milk",
    name: "Plum & Milk",
    description: "Deep plum over warm cream",
    primary: "#381932",
    background: "#FFF3E6",
  },
  {
    id: "night-imperial",
    name: "Night & Imperial",
    description: "Near-black with a red-hot accent",
    primary: "#000F08",
    background: "#FB3640",
  },
  {
    id: "ghost-persian",
    name: "Ghost & Persian",
    description: "Pearl white over rich indigo",
    primary: "#F7F7FF",
    background: "#27187E",
  },
];

// Looks offered by the AI logo studio. `value` is what is sent as the style
// hint; `label` is the short chip shown in the console.
const AI_STYLES = [
  { label: "Minimal", value: "premium, modern, minimal" },
  { label: "Bold", value: "bold editorial, strong typography" },
  { label: "Vintage", value: "vintage badge, engraved linework" },
  { label: "Hand-drawn", value: "hand-drawn ink, organic strokes" },
  { label: "Monogram", value: "geometric monogram mark" },
  { label: "Botanical", value: "warm botanical illustration" },
];

/** Small live preview of the text/wordmark logo on a chosen surface. */
function WordmarkPreview({
  word,
  tagline,
  color,
}: {
  word: string;
  tagline: string;
  color: string;
}) {
  if (!word.trim()) {
    return (
      <span className="text-center text-[11px] text-muted-foreground">Your studio name</span>
    );
  }
  return (
    <span
      className="font-display inline-flex max-w-full flex-col items-center gap-0.5 leading-none"
      style={{ color }}
    >
      <span className="text-base font-semibold sm:text-lg">{word}</span>
      {tagline.trim() && (
        <span className="text-[9px] font-medium uppercase tracking-[0.18em] opacity-70">
          {tagline}
        </span>
      )}
    </span>
  );
}

export function AdminSettings() {
  const settings = useSettings();

  // The editable form below keeps local draft state. Remounting it on a
  // settings change (via `key`) is what resyncs the draft — doing that with a
  // useEffect would mean setState during an effect, which cascades renders.
  const formKey = [
    settings.primaryColor,
    settings.backgroundColor,
    settings.upiId,
    settings.heroLead,
    settings.heroMode,
    settings.heroAccent,
    settings.heroAccentWords.join("|"),
    settings.logoUrl,
    settings.logoDarkUrl,
    settings.logoMode,
    settings.brandWord,
    settings.brandTagline,
    settings.logoLightColor,
    settings.logoDarkColor,
    settings.socialLinks.instagram,
    settings.socialLinks.twitter,
    settings.socialLinks.behance,
    settings.socialLinks.linkedin,
  ].join("::");

  return <SettingsForm key={formKey} settings={settings} />;
}

function SettingsForm({ settings }: { settings: ReturnType<typeof useSettings> }) {
  const { t, brandName } = useContent();
  const update = useMutation(api.settings.update);
  const generateUploadUrl = useMutation(api.settings.generateUploadUrl);
  const generateLogo = useAction(api.ai.generateLogo);
  const setQrImage = useMutation(api.settings.setQrImage);
  const setLogoImage = useMutation(api.settings.setLogoImage);
  const clearLogo = useMutation(api.settings.clearLogo);
  const setLogoDarkImage = useMutation(api.settings.setLogoDarkImage);
  const clearLogoDark = useMutation(api.settings.clearLogoDark);    const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);

  // Logo mode: "image" (uploaded image) vs "text" (brand word mark).
  const [logoMode, setLogoMode] = useState<"image" | "text">(
    settings.logoMode ?? (settings.logoUrl ? "image" : "text"),
  );

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoDarkBusy, setLogoDarkBusy] = useState(false);
  // AI logo studio — the brief starts from the studio's own name and tagline.
  const [aiBrief, setAiBrief] = useState(() =>
    [brandName, t("brand.tagline")].filter(Boolean).join(" — "),
  );
  const [aiStyle, setAiStyle] = useState("premium, modern, minimal");
  const [aiBusy, setAiBusy] = useState<null | "light" | "dark">(null);
  const [removeLogoBusy, setRemoveLogoBusy] = useState(false);
  const [removeLogoDarkBusy, setRemoveLogoDarkBusy] = useState(false);
  const [brandWord, setBrandWord] = useState(settings.brandWord ?? "");
  const [brandTagline, setBrandTagline] = useState(settings.brandTagline ?? "");
  const [logoLightColor, setLogoLightColor] = useState(
    settings.logoLightColor ?? "#14110f",
  );
  const [logoDarkColor, setLogoDarkColor] = useState(
    settings.logoDarkColor ?? "#ffffff",
  );

  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [backgroundColor, setBackgroundColor] = useState(settings.backgroundColor);
  const [upiId, setUpiId] = useState(settings.upiId);
  const [instagram, setInstagram] = useState(settings.socialLinks.instagram);
  const [twitter, setTwitter] = useState(settings.socialLinks.twitter);
  const [behance, setBehance] = useState(settings.socialLinks.behance);
  const [linkedin, setLinkedin] = useState(settings.socialLinks.linkedin);
  const [heroLead, setHeroLead] = useState(settings.heroLead);
  const [heroMode, setHeroMode] = useState<"rotating" | "static">(settings.heroMode);
  const [heroAccent, setHeroAccent] = useState(settings.heroAccent);
  const [heroWords, setHeroWords] = useState(settings.heroAccentWords.join(", "));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    try {
      await update({
        primaryColor,
        backgroundColor,
        upiId,
        instagram,
        twitter,
        behance,
        linkedin,
        heroLead,
        heroMode,
        heroAccent,
        heroAccentWords: heroWords.split(","),
        logoMode,
        brandWord: brandWord || undefined,
        brandTagline: brandTagline || undefined,
        logoLightColor: logoLightColor || undefined,
        logoDarkColor: logoDarkColor || undefined,
      });
      toast.success("Website updated — live everywhere now.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadQr = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      toast.error("QR must be a PNG or JPEG image.");
      return;
    }
    setQrBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = (await res.json()) as { storageId: string };
      await setQrImage({ storageId: storageId as never });
      toast.success("QR image replaced");
    } catch {
      toast.error("QR upload failed");
    } finally {
      setQrBusy(false);
    }
  };

  const uploadLogo = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/^image\/(png|svg\+xml|avif|webp|jpeg|gif)$/.test(file.type)) {
      toast.error("Light logo must be a PNG, SVG, AVIF, WebP, JPEG or GIF image.");
      return;
    }
    setLogoBusy(true);
    try {
      const url = await generateUploadUrl();
      if (!url) {
        toast.error("Logo upload not available: storage may not be enabled on this deployment.");
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        toast.error(`Logo upload failed (HTTP ${res.status}).`);
        return;
      }
      const { storageId } = (await res.json()) as { storageId: string };
      await setLogoImage({ storageId: storageId as never });
      toast.success("Light logo uploaded — shown on light backgrounds.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Logo upload failed.",
      );
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setRemoveLogoBusy(true);
    try {
      await clearLogo();
      toast.success("Light logo removed — your wordmark is back.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove light logo.");
    } finally {
      setRemoveLogoBusy(false);
    }
  };

  const uploadLogoDark = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/^image\/(png|svg\+xml|avif|webp|jpeg|gif)$/.test(file.type)) {
      toast.error("Dark logo must be a PNG, SVG, AVIF, WebP, JPEG or GIF image.");
      return;
    }
    setLogoDarkBusy(true);
    try {
      const url = await generateUploadUrl();
      if (!url) {
        toast.error("Dark logo upload not available: storage may not be enabled on this deployment.");
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        toast.error(`Dark logo upload failed (HTTP ${res.status}).`);
        return;
      }
      const { storageId } = (await res.json()) as { storageId: string };
      await setLogoDarkImage({ storageId: storageId as never });
      toast.success("Dark logo uploaded — shown on dark backgrounds.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Dark logo upload failed.",
      );
    } finally {
      setLogoDarkBusy(false);
    }
  };

  /**
   * Draws a logo with the image model and writes it straight into the logo
   * slot. The brief defaults to the studio's own name + tagline, so hitting
   * generate with an empty box still produces something on-brand.
   */
  const runLogoAi = async (variant: "light" | "dark") => {
    const brief =
      aiBrief.trim() ||
      [brandName, brandTagline || settings.brandTagline, t("brand.tagline")]
        .filter(Boolean)
        .join(" — ");
    setAiBusy(variant);
    try {
      await generateLogo({ brief, variant, style: aiStyle });
      toast.success(
        variant === "dark"
          ? "Dark-variant logo generated and applied."
          : "Logo generated and applied across the whole site.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logo generation failed.");
    } finally {
      setAiBusy(null);
    }
  };

  const removeLogoDark = async () => {
    setRemoveLogoDarkBusy(true);
    try {
      await clearLogoDark();
      toast.success("Dark logo removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove dark logo.");
    } finally {
      setRemoveLogoDarkBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="clay space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Brand</h3>
          <button
            onClick={() => {
              setPrimaryColor(settings.primaryColor);
              setBackgroundColor(settings.backgroundColor);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to saved
          </button>
        </div>

        {/* Studio logo — an uploaded image, or a wordmark drawn from your own words. */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Studio logo
            </span>
            <div className="clay-sm ml-auto flex rounded-full p-0.5">
              {(["image", "text"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setLogoMode(mode);
                    if (mode === "image" && !settings.logoUrl) logoRef.current?.click();
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                    logoMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === "image" ? "Image" : "Wordmark"}
                </button>
              ))}
            </div>
          </div>

          {logoMode === "image" ? (
          <>
          <div className="flex gap-3">
            <div className="clay-inset flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Current logo" className="h-full w-full object-contain" />
              ) : (
                <span className="px-4 text-center text-xs text-muted-foreground">
                  No logo yet
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">                  <button
                onClick={() => logoFile ? uploadLogo(logoFile) : logoRef.current?.click()}
                disabled={logoBusy}
                className="clay-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {logoBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4 text-primary" />}
                {logoFile ? "Replace existing logo" : "Upload logo"}
              </button>
              <button
                onClick={removeLogo}
                disabled={!settings.logoUrl || removeLogoBusy}
                className="flex items-center gap-2 rounded-xl border border-red-200/70 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {removeLogoBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Remove logo
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/svg+xml,image/avif,image/webp,image/jpeg,image/gif"
                hidden
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">
                When an image logo is set, the studio mark is replaced by it everywhere — home,
                footer and browser tab.
              </p>
            </div>
          </div>

          {/* AI logo studio — the image model draws a logo straight into the slot. */}
          <div className="clay-inset space-y-3 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <Wand2 className="size-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                AI logo studio
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Describe the studio and the model draws a logo into the slot above — no designer, no
              file juggling.
            </p>
            <textarea
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              rows={3}
              placeholder={`${brandName} — a hand-drawn digital design studio, leaf and pen nib`}
              className={inputCls}
            />
            <div className="flex flex-wrap gap-1.5">
              {AI_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setAiStyle(s.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    aiStyle === s.value
                      ? "bg-primary text-primary-foreground"
                      : "clay-sm text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void runLogoAi("light")}
                disabled={aiBusy !== null}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
              >
                {aiBusy === "light" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Generate logo
              </button>
              <button
                onClick={() => void runLogoAi("dark")}
                disabled={aiBusy !== null}
                className="clay-sm inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {aiBusy === "dark" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Dark variant
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Generation takes a few seconds and applies the result immediately.
            </p>
          </div>
          </>
          ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Logo word or sentence
              </span>
              <input
                value={brandWord}
                onChange={(e) => setBrandWord(e.target.value)}
                placeholder={brandName}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Line under the word (optional)
              </span>
              <input
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
                placeholder={t("brand.tagline")}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Colour on light
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={logoLightColor}
                    onChange={(e) => setLogoLightColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-xl border border-border bg-transparent p-1"
                  />
                  <span className="font-mono text-xs text-muted-foreground">{logoLightColor}</span>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Colour on dark
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={logoDarkColor}
                    onChange={(e) => setLogoDarkColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-xl border border-border bg-transparent p-1"
                  />
                  <span className="font-mono text-xs text-muted-foreground">{logoDarkColor}</span>
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">On light backgrounds</p>
                <div className="flex h-20 items-center justify-center rounded-2xl border bg-white p-3">
                  <WordmarkPreview
                    word={brandWord}
                    tagline={brandTagline}
                    color={logoLightColor}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">On dark backgrounds</p>
                <div className="flex h-20 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900 p-3">
                  <WordmarkPreview
                    word={brandWord}
                    tagline={brandTagline}
                    color={logoDarkColor}
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Leave the word empty to use the studio name from
              <span className="font-medium"> Words &amp; copy</span>. Click “Save settings” to publish it.
            </p>
          </div>
          )}
        </div>

        {/* Dark-mode logo variant — shown on dark surfaces when set. */}
        {logoMode === "image" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dark-mode logo
            </span>
            <span className="text-[11px] text-muted-foreground">
              Optional variant for dark backgrounds (PNG, SVG, AVIF, WebP, JPEG or GIF)
            </span>
          </div>
          <div className="flex gap-3">
            <div className="clay-inset flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
              {settings.logoDarkUrl ? (
                <img src={settings.logoDarkUrl} alt="Dark-mode logo" className="h-full w-full object-contain" />
              ) : (
                <span className="px-4 text-center text-xs text-muted-foreground">
                  No dark logo yet
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => logoDarkFile ? uploadLogoDark(logoDarkFile) : logoDarkRef.current?.click()}
                disabled={logoDarkBusy}
                className="clay-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {logoDarkBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4 text-primary" />}
                {logoDarkFile ? "Replace dark logo" : "Upload dark logo"}
              </button>
              <button
                onClick={removeLogoDark}
                disabled={!settings.logoDarkUrl || removeLogoDarkBusy}
                className="flex items-center gap-2 rounded-xl border border-red-200/70 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-400 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                {removeLogoDarkBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Remove dark logo
              </button>
              <input
                ref={logoDarkRef}
                type="file"
                accept="image/png,image/svg+xml,image/avif,image/webp,image/jpeg,image/gif"
                hidden
                onChange={(e) => setLogoDarkFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">
                When set, this is used on dark surfaces; the light logo is still used on light backgrounds.
                Upload one here, or generate one with the AI studio above.
              </p>
            </div>
          </div>
        </div>
        )}

        {/* AI brand kit — colour pairs, taglines and logo words from one brief. */}
        <AdminBrandKit
          currentPrimary={primaryColor}
          currentBackground={backgroundColor}
          onApplyPalette={(primary, background) => {
            setPrimaryColor(primary);
            setBackgroundColor(background);
          }}
          onApplyTagline={setBrandTagline}
          onApplyBrandWord={setBrandWord}
        />

        {/* Quick colour themes — two-color preset swatches */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick colour themes
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COLOR_THEMES.map((theme) => {
              const isActive = theme.primary === primaryColor && theme.background === backgroundColor;
              return (
                <button
                  key={theme.name}
                  onClick={() => {
                    setPrimaryColor(theme.primary);
                    setBackgroundColor(theme.background);
                  }}
                  className={cn(
                    "group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition",
                    isActive
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/60 bg-card hover:border-primary/30 hover:bg-secondary/50",
                  )}
                  title={`${theme.name}: ${theme.description}`}
                >
                  {/* Preview */}
                  <div className="flex h-10 w-full flex-col rounded-lg overflow-hidden">
                    <div
                      className="h-1/2"
                      style={{ backgroundColor: theme.primary }}
                    />
                    <div
                      className="h-1/2"
                      style={{ backgroundColor: theme.background }}
                    />
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}>
                    {theme.name}
                  </span>
                  {isActive && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Click a theme to preview. Colours update instantly but won't save until you click "Save settings".
          </p>
        </div>

        {/* Colour combination picker — 4 cards matching the landing showcase */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Colour combination
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_COMBOS.map((combo) => {
              const isActive =
                combo.primary.toLowerCase() === primaryColor.toLowerCase() &&
                combo.background.toLowerCase() === backgroundColor.toLowerCase();
              return (
                <button
                  key={combo.id}
                  onClick={() => {
                    setPrimaryColor(combo.primary);
                    setBackgroundColor(combo.background);
                  }}
                  className={cn(
                    "group relative flex gap-3 overflow-hidden rounded-xl border p-3 transition",
                    isActive
                      ? "border-primary/60 ring-2 ring-primary/40"
                      : "border-border/60 bg-card hover:border-primary/30 hover:bg-secondary/40",
                  )}
                  title={`${combo.name}: ${combo.description}`}
                >
                  {/* Combo swatch: primary on top, background on bottom */}
                  <div className="mt-1 flex h-14 w-14 shrink-0 flex-col rounded-lg shadow-inner sm:mt-0 sm:mx-0 sm:mt-0">
                    <div style={{ backgroundColor: combo.primary }} className="h-1/2" />
                    <div style={{ backgroundColor: combo.background }} className="h-1/2" />
                  </div>
                  <div className="min-w-0 flex flex-1 flex-col">
                    <span className={cn(
                      "text-sm font-semibold",
                      isActive ? "text-primary" : "text-foreground",
                    )}>
                      {combo.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{combo.description}</span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {combo.primary}
                      </span>
                      <span className="text-[10px] text-muted-foreground">+</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {combo.background}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Pick a colour combination to preview it here and on the live site. The four combos match the cards on the home page.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Primary color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-transparent p-1"
              />
              <span className="text-xs text-muted-foreground font-mono">{primaryColor}</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Background color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-transparent p-1"
              />
              <span className="text-xs text-muted-foreground font-mono">{backgroundColor}</span>
            </div>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          These two colors power the whole site through CSS variables. The colour-combination cards above set both at once.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">UPI ID</span>
          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} className={inputCls} placeholder="your_upi@bank" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Instagram URL</span>
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={inputCls} placeholder="https://instagram.com/…" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Twitter / X URL</span>
            <input value={twitter} onChange={(e) => setTwitter(e.target.value)} className={inputCls} placeholder="https://x.com/…" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Behance URL</span>
            <input value={behance} onChange={(e) => setBehance(e.target.value)} className={inputCls} placeholder="https://behance.net/…" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">LinkedIn URL</span>
            <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className={inputCls} placeholder="https://linkedin.com/company/…" />
          </label>
        </div>
      </section>

      <section className="clay space-y-4 p-6">
        <div>
          <h3 className="font-display text-lg font-semibold">Home screen headline</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The green words in the big headline on the home screen.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Text before the green words
          </span>
          <input
            value={heroLead}
            onChange={(e) => setHeroLead(e.target.value)}
            className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Style
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["rotating", "static"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setHeroMode(mode)}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm font-medium capitalize transition",
                  heroMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "clay-sm text-muted-foreground hover:text-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {heroMode === "rotating"
              ? "The green words cycle every few seconds."
              : "The green words stay put — use the field below."}
          </p>
        </div>

        {heroMode === "static" ? (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Green words
            </span>
            <input
              value={heroAccent}
              onChange={(e) => setHeroAccent(e.target.value)}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Words to cycle through (comma separated, up to 8)
            </span>
            <textarea
              value={heroWords}
              onChange={(e) => setHeroWords(e.target.value)}
              rows={2}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        )}

        <p className="text-xs text-muted-foreground">
          Preview:{" "}
          <span className="font-display text-emerald-700 dark:text-emerald-400">
            {heroLead} {heroMode === "static" ? heroAccent : heroWords.split(",")[0]?.trim()}
          </span>
        </p>

        <div className="h-px bg-border/60" />

        <h3 className="font-display text-lg font-semibold">Payment QR</h3>
        <div className="clay-inset mx-auto flex aspect-square w-48 items-center justify-center overflow-hidden rounded-2xl">
          {settings.qrImageUrl ? (
            <img src={settings.qrImageUrl} alt="Current QR" className="size-full object-contain p-2" />
          ) : (
            <span className="px-6 text-center text-xs text-muted-foreground">No QR uploaded yet</span>
          )}
        </div>
        <button
          onClick={() => qrRef.current?.click()}
          disabled={qrBusy}
          className="clay-inset flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {qrBusy ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4 text-primary" />}
          Upload new QR (PNG / JPEG)
        </button>
        <input
          ref={qrRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => void uploadQr(e.target.files?.[0])}
        />
      </section>

      <div className="lg:col-span-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save settings
        </button>
      </div>
    </div>
  );
}
