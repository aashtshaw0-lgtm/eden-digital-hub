import { api } from "@/convex/_generated/api";
import { useContent } from "@/context/ContentProvider";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { Check, Loader2, Palette, Sparkles, Type } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BrandKit {
  palettes: { name: string; description: string; primary: string; background: string }[];
  taglines: string[];
  brandWords: string[];
}

/**
 * AI brand kit.
 *
 * Asks the model for a small set of directions — colour pairs, taglines and
 * logo words — and lets the studio drop any of them into the form with one
 * click. Nothing is written to the database here: the panel only fills the
 * drafts, so pressing "Save settings" is still the single commit point.
 */
export function AdminBrandKit({
  currentPrimary,
  currentBackground,
  onApplyPalette,
  onApplyTagline,
  onApplyBrandWord,
}: {
  currentPrimary: string;
  currentBackground: string;
  onApplyPalette: (primary: string, background: string) => void;
  onApplyTagline: (text: string) => void;
  onApplyBrandWord: (text: string) => void;
}) {
  const { t, brandName } = useContent();
  const buildKit = useAction(api.ai.brandKit);
  const [brief, setBrief] = useState("");
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const result = await buildKit({
        brief: brief.trim() || `${brandName} — ${t("brand.tagline")}`,
        currentPrimary,
        currentBackground,
      });
      if (result.palettes.length === 0 && result.taglines.length === 0) {
        toast.error("The model didn't return anything usable. Try a longer brief.");
        return;
      }
      setKit(result);
      toast.success("Brand kit ready — pick the parts you like.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build a brand kit.");
    } finally {
      setBusy(false);
    }
  };

  const mark = (label: string) => {
    setApplied(label);
    toast.success("Added to the form — click Save settings to publish.");
  };

  const empty = !kit;

  return (
    <div className="clay-inset space-y-3 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AI brand kit
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Describe the studio and get colour pairs, taglines and logo words sized for this site.
        Nothing is saved until you press Save settings.
      </p>

      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={2}
        placeholder={`${brandName} — a hand-drawn design & event studio, warm and editorial`}
        className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />

      <button
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {empty ? "Build a brand kit" : "Build another"}
      </button>

      {kit && (
        <div className="space-y-4 pt-1">
          {kit.palettes.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Palette className="size-3" /> Colour directions
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {kit.palettes.map((p) => {
                  const key = `palette:${p.primary}${p.background}`;
                  const isApplied = applied === key;
                  const isActive =
                    p.primary.toLowerCase() === currentPrimary.toLowerCase() &&
                    p.background.toLowerCase() === currentBackground.toLowerCase();
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        onApplyPalette(p.primary, p.background);
                        mark(key);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-2.5 text-left transition",
                        isActive || isApplied
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/60 hover:border-primary/30",
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-lg shadow-inner">
                        <span className="h-1/2" style={{ backgroundColor: p.primary }} />
                        <span className="h-1/2" style={{ backgroundColor: p.background }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold">{p.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {p.description}
                        </span>
                      </span>
                      {isApplied && <Check className="size-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {kit.taglines.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Type className="size-3" /> Taglines
              </p>
              <div className="flex flex-wrap gap-1.5">
                {kit.taglines.map((line) => {
                  const key = `tagline:${line}`;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        onApplyTagline(line);
                        mark(key);
                      }}
                      className={cn(
                        "clay-sm rounded-full px-3 py-1.5 text-[11px] transition-colors",
                        applied === key ? "bg-primary text-primary-foreground" : "hover:text-primary",
                      )}
                    >
                      {line}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {kit.brandWords.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Logo words
              </p>
              <div className="flex flex-wrap gap-1.5">
                {kit.brandWords.map((word) => {
                  const key = `word:${word}`;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        onApplyBrandWord(word);
                        mark(key);
                      }}
                      className={cn(
                        "clay-sm rounded-full px-3 py-1.5 text-[11px] transition-colors",
                        applied === key ? "bg-primary text-primary-foreground" : "hover:text-primary",
                      )}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
