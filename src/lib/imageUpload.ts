/**
 * Getting a proof image into Convex storage.
 *
 * The normal route is a signed storage upload URL, but that is a cross-origin
 * POST and can be blocked when the app runs inside an embedding preview frame.
 * Rather than leaving the client stuck on "fetch failed", this compresses the
 * photo and ships the bytes through an action instead.
 */

/** Max width/height we keep — screenshots are text, so this stays legible. */
const MAX_EDGE = 1600;
/** Convex documents are capped near 1 MB, so keep the payload well under. */
const TARGET_BYTES = 420_000;

/**
 * Downscales and re-encodes an image so it fits a transport limit.
 * Returns the original bytes untouched if it is already small enough.
 */
export async function compressImage(file: File): Promise<ArrayBuffer | null> {
  if (file.size <= TARGET_BYTES) {
    return file.arrayBuffer();
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null; // Not a decodable image; let the caller report it.
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= TARGET_BYTES) {
      return blob.arrayBuffer();
    }
  }
  return null;
}

export type UploadResult =
  | { ok: true; storageId: string; viaFallback: boolean }
  | { ok: false; reason: string; detail?: string };

/**
 * Uploads a proof image, trying the signed URL first and falling back to bytes.
 *
 * `getUploadUrl` and `sendBytes` are injected because the surrounding flow
 * differs per caller (checkout creates the order, the portal attaches to one).
 */
export async function uploadProofImage(
  file: File,
  hooks: {
    getUploadUrl: () => Promise<string>;
    sendBytes: (bytes: ArrayBuffer) => Promise<string>;
  },
): Promise<UploadResult> {
  try {
    const url = await hooks.getUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    if (res.ok) {
      const { storageId } = (await res.json()) as { storageId: string };
      return { ok: true, storageId, viaFallback: false };
    }
    console.warn("[uploadProofImage] upload URL rejected:", res.status);
  } catch (err) {
    // Network-level failure: blocked by an iframe, offline, or DNS.
    console.warn("[uploadProofImage] storage upload failed, sending bytes:", err);
  }

  // Fallback route.
  try {
    const bytes = await compressImage(file);
    if (!bytes) {
      return { ok: false, reason: "That file couldn't be read as an image." };
    }
    const storageId = await hooks.sendBytes(bytes);
    return { ok: true, storageId, viaFallback: true };
  } catch (err) {
    console.error("[uploadProofImage] byte fallback failed:", err);
    return {
      ok: false,
      reason:
        "We couldn't upload that screenshot. Try a smaller image, or send it to us on WhatsApp.",
      detail: String(err),
    };
  }
}