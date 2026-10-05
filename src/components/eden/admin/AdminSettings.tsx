import { api } from "@/convex/_generated/api";
import { useSettings } from "@/context/SettingsProvider";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { CloudUpload, Loader2, Save } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const inputCls =
  "clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

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
    settings.socialLinks.instagram,
    settings.socialLinks.twitter,
    settings.socialLinks.behance,
    settings.socialLinks.linkedin,
  ].join("::");

  return <SettingsForm key={formKey} settings={settings} />;
}

function SettingsForm({ settings }: { settings: ReturnType<typeof useSettings> }) {
  const update = useMutation(api.settings.update);
  const generateUploadUrl = useMutation(api.settings.generateUploadUrl);
  const setQrImage = useMutation(api.settings.setQrImage);

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
  const [saving, setSaving] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="clay space-y-4 p-6">
        <h3 className="font-display text-lg font-semibold">Brand</h3>
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
              <span className="text-xs text-muted-foreground">{primaryColor}</span>
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
              <span className="text-xs text-muted-foreground">{backgroundColor}</span>
            </div>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Colors apply to the whole site instantly through CSS variables.
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
