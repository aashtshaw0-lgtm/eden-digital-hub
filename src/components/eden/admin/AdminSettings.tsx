import { api } from "@/convex/_generated/api";
import { useSettings } from "@/context/SettingsProvider";
import { useMutation } from "convex/react";
import { CloudUpload, Loader2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const inputCls =
  "clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export function AdminSettings() {
  const settings = useSettings();
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
  const [saving, setSaving] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  // Sync the editable form fields whenever the CMS settings row changes
  // (e.g. after a save, or when another admin tab edits it).
  useEffect(() => {
    setPrimaryColor(settings.primaryColor);
    setBackgroundColor(settings.backgroundColor);
    setUpiId(settings.upiId);
    setInstagram(settings.socialLinks.instagram);
    setTwitter(settings.socialLinks.twitter);
    setBehance(settings.socialLinks.behance);
    setLinkedin(settings.socialLinks.linkedin);
  }, [
    settings.primaryColor,
    settings.backgroundColor,
    settings.upiId,
    settings.socialLinks,
  ]);

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
