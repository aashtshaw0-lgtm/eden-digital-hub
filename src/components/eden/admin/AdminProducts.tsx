import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleDollarSign,
  Handshake,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Products, collaborators and the money between them.
 *
 * The split is the part worth reading twice: a collaborator's percentage is
 * snapshotted onto the product when it is saved, and each sale records both
 * halves as they were at that moment. Editing a percentage later therefore
 * never rewrites what someone has already earned.
 */
export function AdminProducts() {
  const products = useQuery(api.products.listForAdmin);
  const collaborators = useQuery(api.products.listCollaborators);
  const earnings = useQuery(api.products.earnings);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);

  const addCollaborator = useMutation(api.products.addCollaborator);
  const updateCollaborator = useMutation(api.products.updateCollaborator);
  const removeCollaborator = useMutation(api.products.removeCollaborator);
  const addProduct = useMutation(api.products.addProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const removeProduct = useMutation(api.products.removeProduct);
  const recordSale = useMutation(api.products.recordSale);

  const fileRef = useRef<HTMLInputElement>(null);
  const [personName, setPersonName] = useState("");
  const [personHandle, setPersonHandle] = useState("");
  const [personShare, setPersonShare] = useState("60");
  const [personEmail, setPersonEmail] = useState("");
  const [savingPerson, setSavingPerson] = useState(false);

  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productMaker, setProductMaker] = useState("");
  const [productShare, setProductShare] = useState("");
  const [productImage, setProductImage] = useState<Id<"_storage"> | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [editing, setEditing] = useState<Id<"products"> | null>(null);

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      toast.error("Give them a name.");
      return;
    }
    setSavingPerson(true);
    try {
      await addCollaborator({
        name: personName,
        handle: personHandle || undefined,
        payoutEmail: personEmail || undefined,
        sharePercent: Number(personShare) || 0,
      });
      toast.success(`${personName.trim()} added`);
      setPersonName("");
      setPersonHandle("");
      setPersonEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setSavingPerson(false);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Math.round(Number(productPrice));
    if (!productName.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error("A product needs a name and a selling price.");
      return;
    }
    setSavingProduct(true);
    try {
      await addProduct({
        name: productName,
        price,
        description: productDesc || undefined,
        collaboratorId: (productMaker || undefined) as Id<"collaborators"> | undefined,
        collaboratorSharePercent: productMaker && productShare ? Number(productShare) : undefined,
        imageStorageId: productImage ?? undefined,
        status: "live",
      });
      toast.success(`${productName.trim()} added and is live`);
      setProductName("");
      setProductPrice("");
      setProductDesc("");
      setProductMaker("");
      setProductShare("");
      setProductImage(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add product");
    } finally {
      setSavingProduct(false);
    }
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      setProductImage(storageId);
      toast.success("Photo attached");
    } catch {
      toast.error("Could not upload that image");
    }
  };

  const dropProduct = async (id: Id<"products">, name: string) => {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    try {
      await removeProduct({ productId: id });
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Smart dashboard */}
      {earnings && (
        <section>
          <h2 className="font-display mb-3 text-lg font-semibold">Money in</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MoneyCard label="Product revenue" value={inr(earnings.totals.gross)} icon={CircleDollarSign} />
            <MoneyCard
              label="Owed to collaborators"
              value={inr(earnings.totals.owedToCollaborators)}
              icon={Users}
              tone="out"
            />
            <MoneyCard label="Studio keeps" value={inr(earnings.totals.keptByStudio)} icon={Handshake} tone="in" />
            <MoneyCard
              label="Studio margin"
              value={`${earnings.totals.studioMarginPercent}%`}
              icon={CircleDollarSign}
            />
          </div>

          {earnings.byCollaborator.length > 0 && (
            <div className="clay mt-3 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Collaborator</th>
                    <th className="px-4 py-3 font-medium">Default cut</th>
                    <th className="px-4 py-3 font-medium">Products</th>
                    <th className="px-4 py-3 font-medium">Sales</th>
                    <th className="px-4 py-3 text-right font-medium">They have earned</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.byCollaborator.map((person) => (
                    <tr key={person._id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {person.name}
                        {person.handle && (
                          <span className="ml-1 text-xs text-muted-foreground">{person.handle}</span>
                        )}
                        {!person.active && (
                          <span className="ml-2 text-[10px] uppercase text-muted-foreground">paused</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{person.defaultSharePercent}%</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">—</td>
                      <td className="px-4 py-3 tabular-nums">{person.salesCount}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {inr(person.earned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {earnings.recentSales.length > 0 && (
            <ul className="mt-3 space-y-2">
              {earnings.recentSales.slice(0, 8).map((sale) => (
                <li
                  key={sale._id}
                  className="clay flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm"
                >
                  <span>
                    <span className="font-medium">{sale.productName}</span>
                    {sale.collaboratorName && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · with {sale.collaboratorName}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-xs tabular-nums">
                    <span className="text-muted-foreground">paid {inr(sale.gross)}</span>
                    <span className="font-semibold text-primary">you {inr(sale.studioShare)}</span>
                    {sale.collaboratorName && (
                      <span className="font-semibold">them {inr(sale.collaboratorShare)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Add a collaborator */}
      <form onSubmit={addPerson} className="clay space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Add a person you make with</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Their default cut is what each of their products starts at — you can change it per
            product. Only you ever see their payout email.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name">
            <input
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Their name"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Handle (public)">
            <input
              value={personHandle}
              onChange={(e) => setPersonHandle(e.target.value)}
              placeholder="@theirstudio"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Their cut (%)">
            <input
              type="number"
              min={0}
              max={90}
              value={personShare}
              onChange={(e) => setPersonShare(e.target.value)}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Payout email (private)">
            <input
              type="email"
              value={personEmail}
              onChange={(e) => setPersonEmail(e.target.value)}
              placeholder="them@example.com"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={savingPerson}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {savingPerson ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add collaborator
        </button>

        {collaborators && collaborators.length > 0 && (
          <ul className="space-y-2 pt-1">
            {collaborators.map((person) => (
              <li key={person._id} className="clay-inset flex flex-wrap items-center gap-3 rounded-xl p-3">
                <span className="min-w-[140px] flex-1 text-sm font-medium">{person.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {person.sharePercent ?? 0}% default · {person.productCount} product
                  {person.productCount === 1 ? "" : "s"} · earned {inr(person.earned)}
                </span>
                <button
                  onClick={() =>
                    void updateCollaborator({
                      collaboratorId: person._id,
                      active: person.active === false,
                    })
                  }
                  className="clay-sm rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {person.active === false ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await removeCollaborator({ collaboratorId: person._id });
                      toast.success("Removed");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not remove");
                    }
                  }}
                  className="clay-sm flex size-7 items-center justify-center text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${person.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {/* Add a product */}
      <form onSubmit={saveProduct} className="clay space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Add a product</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Made by you alone, or with a collaborator. The split is locked in when you save, so
            changing their default later never changes past sales.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Product name">
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Handmade teddy bear"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Selling price (₹)">
            <input
              type="number"
              min={1}
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Made with">
            <select
              value={productMaker}
              onChange={(e) => setProductMaker(e.target.value)}
              className="clay-inset w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Just the studio</option>
              {collaborators?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sharePercent ?? 0}%)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Their cut for this product (%)">
            <input
              type="number"
              min={0}
              max={90}
              value={productShare}
              onChange={(e) => setProductShare(e.target.value)}
              placeholder={productMaker ? "same as their default" : ""}
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Short description">
            <input
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              placeholder="What makes it special"
              className="clay-inset w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
          <Field label="Photo">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="clay-inset w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground"
            >
              {productImage ? "Photo attached ✓" : "Choose image…"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onPickImage(e.target.files?.[0])}
            />
          </Field>
        </div>
        <button
          type="submit"
          disabled={savingProduct}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {savingProduct ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add product
        </button>
      </form>

      {/* Products */}
      {products === undefined ? (
        <div className="clay h-32 animate-pulse opacity-60" />
      ) : products.length === 0 ? (
        <p className="clay p-8 text-center text-sm text-muted-foreground">
          No products yet — add one above and it appears on the site straight away.
        </p>
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {products.map((product) => (
              <motion.li
                key={product._id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                className="clay flex flex-wrap items-center gap-3 p-4"
              >
                {editing === product._id ? (
                  <EditProduct
                    product={product}
                    onSave={async (next) => {
                      await updateProduct({ productId: product._id, ...next });
                      toast.success("Updated");
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="min-w-[180px] flex-1">
                      <p className="font-display flex items-center gap-2 text-base font-semibold">
                        {product.name}
                        {product.status !== "live" && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
                            Draft
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {product.collaboratorName
                          ? `With ${product.collaboratorName} · they take ${product.collaboratorSharePercent ?? 0}%`
                          : "Made by the studio"}
                        {product.soldCount > 0 && ` · ${product.soldCount} sold`}
                      </p>
                    </div>

                    <span className="text-sm font-semibold tabular-nums">
                      {inr(product.price)}
                    </span>

                    {product.collaboratorName && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {inr(product.perSale.collaboratorShare)} theirs /{" "}
                        {inr(product.perSale.studioShare)} yours
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          const raw = window.prompt(
                            `What did the customer pay for “${product.name}”?`,
                            String(product.price),
                          );
                          if (raw === null) return;
                          try {
                            await recordSale({ productId: product._id, gross: Number(raw) });
                            toast.success("Sale recorded");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Could not record");
                          }
                        }}
                        className="clay-sm rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                      >
                        Record sale
                      </button>
                      <button
                        onClick={() =>
                          void updateProduct({
                            productId: product._id,
                            status: product.status === "live" ? "draft" : "live",
                          })
                        }
                        className="clay-sm rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        {product.status === "live" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => setEditing(product._id)}
                        className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-primary"
                        aria-label={`Edit ${product.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => void dropProduct(product._id, product.name)}
                        className="clay-sm flex size-8 items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function MoneyCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof CircleDollarSign;
  tone?: "in" | "out";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="clay p-4"
    >
      <span
        className={cn(
          "tint mb-2 flex size-9 items-center justify-center rounded-xl",
          tone === "in" && "bg-emerald-600/15 text-emerald-700",
          tone === "out" && "bg-amber-500/15 text-amber-700",
        )}
      >
        <Icon className="size-4" />
      </span>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function EditProduct({
  product,
  onSave,
  onCancel,
}: {
  product: {
    name: string;
    price: number;
    description?: string;
    collaboratorSharePercent?: number;
  };
  onSave: (next: {
    name: string;
    price: number;
    description: string;
    collaboratorSharePercent: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [description, setDescription] = useState(product.description ?? "");
  const [share, setShare] = useState(String(product.collaboratorSharePercent ?? 0));
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="clay-inset w-44 rounded-xl px-3 py-2 text-sm outline-none"
      />
      <input
        type="number"
        min={1}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="clay-inset w-28 rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="clay-inset w-52 rounded-xl px-3 py-2 text-sm outline-none"
      />
      <input
        type="number"
        min={0}
        max={90}
        value={share}
        onChange={(e) => setShare(e.target.value)}
        className="clay-inset w-24 rounded-xl px-3 py-2 text-sm tabular-nums outline-none"
      />
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({
              name,
              price: Math.round(Number(price)),
              description,
              collaboratorSharePercent: Number(share),
            });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
        Save
      </button>
      <button
        onClick={onCancel}
        className="clay-sm inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        <X className="size-3.5" /> Cancel
      </button>
    </div>
  );
}