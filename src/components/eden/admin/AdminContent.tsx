import { api } from "@/convex/_generated/api";
import { CONTENT_DEFAULTS, CONTENT_FIELDS, CONTENT_GROUPS } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, RotateCcw, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const inputCls =
  "clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40";

/**
 * The words on the site.
 *
 * Every editable string is declared once in `@/lib/content`, grouped by page.
 * The editor renders straight from that list, so a new field added there shows
 * up here automatically — no editor changes needed.
 *
 * A field left at its shipped wording is *deleted* from the database rather
 * than stored, which is what makes "Reset to shipped wording" exact and keeps
 * the table holding only real edits.
 */
export function AdminContent() {
  const overrides = useQuery(api.content.list);

  // The form keeps local drafts and resyncs by remounting (keyed on the stored
  // overrides) — the same pattern the brand settings form uses.
  const formKey = useMemo(() => JSON.stringify(overrides ?? {}), [overrides]);

  return <ContentForm key={formKey} overrides={overrides ?? {}} />;
}

function ContentForm({ overrides }: { overrides: Record<string, string> }) {
  const setMany = useMutation(api.content.setMany);
  const resetContent = useMutation(api.content.reset);

  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CONTENT_FIELDS.map((f) => [f.key, overrides[f.key] ?? f.default]),
    ),
  );
  const [activeGroup, setActiveGroup] = useState(CONTENT_GROUPS[0]?.id ?? "brand");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const editedCount = CONTENT_FIELDS.filter((f) => overrides[f.key]?.trim()).length;

  const searching = query.trim().length > 0;
  const needle = query.trim().toLowerCase();

  const visibleFields = useMemo(() => {
    if (searching) {
      return CONTENT_FIELDS.filter(
        (f) =>
          f.label.toLowerCase().includes(needle) ||
          f.key.toLowerCase().includes(needle) ||
          (draft[f.key] ?? "").toLowerCase().includes(needle),
      );
    }
    return CONTENT_FIELDS.filter((f) => f.groupId === activeGroup);
  }, [searching, needle, activeGroup, draft]);

  const setField = (key: string, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const resetField = (field: { key: string; default: string }) =>
    setField(field.key, field.default);

  const save = async () => {
    setSaving(true);
    try {
      // Only real changes are written: a field back at its shipped wording, if
      // it was overridden before, is sent empty so the mutation clears the row.
      const entries = CONTENT_FIELDS.flatMap((f) => {
        const next = (draft[f.key] ?? "").trim();
        const shipped = (CONTENT_DEFAULTS[f.key] ?? "").trim();
        const hadOverride = Boolean(overrides[f.key]?.trim());
        if (next === shipped) {
          return hadOverride ? [{ key: f.key, value: "" }] : [];
        }
        return [{ key: f.key, value: next }];
      });

      if (entries.length === 0) {
        toast.info("Nothing to save — every word matches the shipped copy.");
        return;
      }
      await setMany({ entries });
      toast.success("Copy saved — live on the site now.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the copy.");
    } finally {
      setSaving(false);
    }
  };

  const resetEverything = async () => {
    setResetting(true);
    try {
      await resetContent({});
      toast.success("Every word is back to the shipped copy.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the copy.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="clay flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Words &amp; copy</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every sentence on the public site, grouped by page. Change anything and it goes
            live the moment you save — no code needed.
          </p>
        </div>
        <span className="clay-sm shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {editedCount === 0
            ? "All wording is the shipped copy"
            : `${editedCount} ${editedCount === 1 ? "edit" : "edits"} saved`}
        </span>
      </div>

      <div className="clay space-y-4 p-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search every word on the site…"
            className={cn(inputCls, "pl-10")}
          />
        </label>

        {!searching && (
          <div className="flex flex-wrap gap-2">
            {CONTENT_GROUPS.map((group) => {
              const groupEdits = group.fields.filter((f) => overrides[f.key]?.trim()).length;
              return (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={cn(
                    "clay-sm tap rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                    activeGroup === group.id && "bg-primary text-primary-foreground",
                  )}
                >
                  {group.title}
                  {groupEdits > 0 && (
                    <span className="ml-1.5 tabular-nums opacity-70">·{groupEdits}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {visibleFields.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleFields.map((field) => {
              const value = draft[field.key] ?? "";
              const overridden = Boolean(overrides[field.key]?.trim());
              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {field.label}
                    </span>
                    {searching && (
                      <span className="text-[10px] text-muted-foreground/70">
                        {field.groupTitle}
                      </span>
                    )}
                    {overridden && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Check className="size-2.5" /> edited
                      </span>
                    )}
                    {value.trim() !== field.default.trim() && (
                      <button
                        onClick={() => resetField(field)}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="size-3" /> shipped wording
                      </button>
                    )}
                  </div>
                  {field.type === "textarea" ? (
                    <textarea
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      rows={3}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className={inputCls}
                    />
                  )}
                  {field.hint && (
                    <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save copy
        </button>
        <button
          onClick={resetEverything}
          disabled={resetting || editedCount === 0}
          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Reset every word
        </button>
      </div>
    </div>
  );
}
