import { api } from "@/convex/_generated/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { HandHeart, Package, Sparkles } from "lucide-react";
import { Link } from "react-router";

/**
 * The handmade shelf.
 *
 * Products the studio makes on its own, and products made with the people it
 * collaborates with. Only the fact that someone made it is public — the studio's
 * profit split with them never leaves the admin console.
 */
export default function Products() {
  useSeo({
    title: `Handmade | Eden - Digital Design & Management`,
    description:
      "Small-batch pieces made by hand in the studio and with the people we collaborate with.",
  });
  const products = useQuery(api.products.listLive);
  const collaborators = useQuery(api.products.listPublicCollaborators);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Made by hand
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          The handmade shelf
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Pieces made in small batches, some by us and some with the people we work alongside.
          Every one is finished by a pair of hands rather than a production line.
        </p>
      </header>

      {collaborators && collaborators.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mt-10"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <HandHeart className="size-4 text-primary" />
            Made with
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {collaborators.map((person) => (
              <li key={person._id} className="clay px-4 py-3">
                <p className="font-display text-sm font-semibold">
                  {person.name}
                  {person.handle && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {person.handle}
                    </span>
                  )}
                </p>
                {person.bio && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{person.bio}</p>
                )}
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <section className="mt-12">
        {products === undefined ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="clay aspect-[4/5] animate-pulse opacity-60" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="clay flex flex-col items-center gap-3 p-14 text-center">
            <span className="tint flex size-12 items-center justify-center rounded-2xl">
              <Package className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              Nothing on the shelf just yet — check back soon.
            </p>
            <Link
              to="/services"
              className="text-sm font-semibold text-primary hover:underline"
            >
              See what we do design-wise
            </Link>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, index) => (
              <motion.li
                key={product._id}
                initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  type: "spring",
                  stiffness: 120,
                  damping: 20,
                  delay: Math.min(index * 0.09, 0.9),
                }}
                className="clay clay-press group overflow-hidden"
              >
                <figure>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="clay-inset flex aspect-[4/5] items-center justify-center rounded-none border-0">
                      <Sparkles className="size-8 text-muted-foreground/60" />
                    </div>
                  )}
                </figure>

                <div className="space-y-1.5 p-5">
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                  )}
                  <p
                    className={cn(
                      "pt-1 text-xs",
                      product.madeWith ? "text-muted-foreground" : "text-primary",
                    )}
                  >
                    {product.madeWith
                      ? `Made with ${product.madeWith.name}`
                      : "Made by the studio"}
                  </p>
                  <p className="font-display text-xl font-semibold tabular-nums">
                    {inr(product.price)}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}