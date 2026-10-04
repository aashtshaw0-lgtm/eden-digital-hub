import { api } from "@/convex/_generated/api";
import { useSettings } from "@/context/SettingsProvider";
import { inr } from "@/lib/format";
import { useMutation, useAction } from "convex/react";
import { uploadProofImage } from "@/lib/imageUpload";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Loader2, QrCode, ReceiptIndianRupee, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Asks a client for their payment proof.
 *
 * The studio receives money by UPI, but a screenshot only counts as proof when
 * it shows the receiving handle, the amount, the date, the status, and a UPI
 * reference. This card tells the client exactly that, shows them what to pay,
 * and uploads the receipt straight into the order the admin board reads.
 */
export function ProofRequest({
  orderId,
  amountDue,
  serviceLabel,
  onUploaded,
}: {
  orderId: Id<"orders">;
  /** Order total including any tip. */
  amountDue: number;
  serviceLabel?: string;
  onUploaded?: () => void;
}) {
  const { upiId, qrImageUrl } = useSettings();
  const generateProofUrl = useMutation(api.orders.generateProofUrl);
  const attachProof = useMutation(api.orders.attachProof);
  const storeProofBytes = useAction(api.orders.storeProofBytes);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      toast.success("UPI ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please select it manually.");
    }
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const upload = await uploadProofImage(file, {
        getUploadUrl: () => generateProofUrl({ orderId }),
        sendBytes: (bytes) => storeProofBytes({ bytes }),
      });
      if (!upload.ok) throw new Error(upload.reason);
      await attachProof({ orderId, storageId: upload.storageId as Id<"_storage"> });
      setDone(true);
      onUploaded?.();
      toast.success("Proof sent — we'll confirm it shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="clay overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-secondary/40 px-5 py-3.5">
        <ReceiptIndianRupee className="size-4 shrink-0 text-primary" />
        <p className="text-sm font-semibold">Send your payment proof</p>
        {serviceLabel && (
          <span className="text-xs text-muted-foreground">· {serviceLabel}</span>
        )}
      </div>

      <div className="space-y-5 p-5">
        {/* What to pay */}
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="clay-inset flex aspect-square w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="UPI QR code" className="size-full object-contain p-2" />
            ) : (
              <div className="flex flex-col items-center gap-2 px-3 text-muted-foreground">
                <QrCode className="size-8" />
                <span className="text-center text-[10px] leading-snug">
                  Scan the studio QR, or pay the UPI ID below.
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount due</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{inr(amountDue)}</p>
            </div>
            <button
              onClick={copyUpi}
              className="clay-inset flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5"
            >
              <span className="truncate text-sm font-medium">{upiId}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
                {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              </span>
            </button>
          </div>
        </div>

        {/* What makes a screenshot count as proof */}
        <div className="clay-inset rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your screenshot must show all five
          </p>
          <ul className="mt-2 space-y-1.5">
            {[
              "Paid to " + (upiId || "our UPI ID"),
              "The amount you paid",
              "The date and time",
              "Status: Success",
              "A UPI reference / UTR number",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
            Open your app's transaction details — the big success banner usually
            leaves out the UPI reference, so we may have to ask again.
          </p>
        </div>

        {/* Upload */}
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl bg-emerald-600/12 px-4 py-3 text-sm font-medium text-emerald-700"
            >
              <Check className="size-4" />
              Proof received — we're checking it now.
            </motion.div>
          ) : (
            <motion.div key="upload" className="space-y-3">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="clay-inset flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-primary"
              >
                <Upload className="size-4" />
                {file ? file.name : "Choose your payment screenshot"}
              </button>
              <button
                onClick={() => void submit()}
                disabled={!file || uploading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:brightness-110 disabled:opacity-50"
              >
                {uploading && <Loader2 className="size-4 animate-spin" />}
                Send proof
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}