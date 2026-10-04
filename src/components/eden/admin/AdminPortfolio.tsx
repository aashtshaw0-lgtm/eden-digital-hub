import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CloudUpload, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AdminPortfolio() {
  const items = useQuery(api.portfolio.list);
  const generateUploadUrl = useMutation(api.portfolio.generateUploadUrl);
  const add = useMutation(api.portfolio.add);
  const remove = useMutation(api.portfolio.remove);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  const uploadFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => /^image\/(jpeg|png)$/.test(f.type));
    if (files.length === 0) {
      toast.error("Only JPEG and PNG images are supported.");
      return;
    }
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = (await res.json()) as { storageId: string };
        await add({
          storageId: storageId as never,
          title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    toast.success("Portfolio updated");
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "clay-inset flex cursor-pointer flex-col items-center gap-2 rounded-2xl px-4 py-10 text-center transition-all",
          dragging && "ring-2 ring-primary/60",
        )}
      >
        {uploading > 0 ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : (
          <CloudUpload className="size-6 text-primary" />
        )}
        <p className="text-sm font-medium">
          {uploading > 0 ? `Uploading ${uploading}…` : "Drag & drop images here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">JPEG or PNG — goes straight to the homepage gallery.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => void uploadFiles(e.target.files)}
        />
      </div>

      {items === undefined ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="clay aspect-[4/3] animate-pulse opacity-60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="clay p-8 text-center text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <figure key={item._id} className="clay group relative overflow-hidden">
              {item.url && !item.url.startsWith("blob:") ? (
                <img src={item.url} alt={item.title} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="clay-inset flex aspect-[4/3] items-center justify-center rounded-none border-0 text-xs text-muted-foreground">
                  {item.title}
                </div>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  // Deleting is unrecoverable and the file bytes go with it, so
                  // it is confirmed rather than one stray tap away.
                  if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
                  try {
                    await remove({ id: item._id as never });
                    toast.success("Deleted");
                  } catch {
                    toast.error("Delete failed");
                  }
                }}
                // Always visible on touch screens, where there is no hover to reveal it.
                // This was effectively invisible on mobile, which is where a
                // wrongly uploaded image most needs deleting.
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-foreground opacity-100 shadow transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 className="size-4" />
              </button>
              <figcaption className="truncate px-3 py-2 text-xs text-muted-foreground">
                {item.title}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
