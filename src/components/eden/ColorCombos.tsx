import { motion } from "framer-motion";
import { Hash, Sparkles } from "lucide-react";

interface ColorCombo {
  id: string;
  name: string;
  comboNumber: string;
  top: { name: string; hex: string };
  bottom: { name: string; hex: string };
}

const COMBOS: ColorCombo[] = [
  {
    id: "plum-milk",
    name: "Plum & Milk",
    comboNumber: "05",
    top: { name: "PLUM", hex: "#381932" },
    bottom: { name: "MILK", hex: "#FFF3E6" },
  },
  {
    id: "night-imperial",
    name: "Night & Imperial",
    comboNumber: "03",
    top: { name: "NIGHT", hex: "#000F08" },
    bottom: { name: "IMPERIAL", hex: "#FB3640" },
  },
  {
    id: "ghost-persian",
    name: "Ghost & Persian",
    comboNumber: "02",
    top: { name: "GHOST", hex: "#F7F7FF" },
    bottom: { name: "PERSIAN", hex: "#27187E" },
  },
  {
    id: "night-kiwi",
    name: "Night & Kiwi",
    comboNumber: "01",
    top: { name: "NIGHT", hex: "#222222" },
    bottom: { name: "KIWI", hex: "#89E900" },
  },
];

interface ColorCardProps {
  combo: ColorCombo;
  index: number;
}

function ColorCard({ combo, index }: ColorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg hover:shadow-xl transition-shadow"
    >
      {/* Main colour card */}
      <div className="mx-4 mt-4 overflow-hidden rounded-xl bg-neutral-900 shadow-inner">
        {/* Top colour section */}
        <div
          className="relative h-1/2 overflow-hidden"
          style={{ backgroundColor: combo.top.hex }}
        >
          <span className="pointer-events-none absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-widest text-white/70">
            LEARN DESIGN
          </span>
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-medium text-white/80">
            {combo.comboNumber}/07
          </span>
          <h3 className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold font-display tracking-widest text-white">
            {combo.top.name}
          </h3>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-white/40 px-3 py-1 text-[10px] font-medium text-white">
              <Hash className="size-3" />
              Hex
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-white/40 px-3 py-1 text-[10px] font-mono font-medium text-white">
              {combo.top.hex}
            </span>
          </div>
        </div>

        {/* Bottom colour section */}
        <div
          className="relative h-1/2 overflow-hidden"
          style={{ backgroundColor: combo.bottom.hex }}
        >
          <h3 className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold font-display tracking-widest text-neutral-900">
            {combo.bottom.name}
          </h3>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-neutral-900/40 px-3 py-1 text-[10px] font-medium text-neutral-900">
              <Hash className="size-3" />
              Hex
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-neutral-900/40 px-3 py-1 text-[10px] font-mono font-medium text-neutral-900">
              {combo.bottom.hex}
            </span>
          </div>
          <span className="pointer-events-none absolute left-3 bottom-3 text-xs font-medium text-neutral-900/60">
            @design.deb
          </span>
        </div>

        {/* Center combo badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 border border-neutral-900 shadow-lg">
          <span className="text-xs font-bold font-display uppercase tracking-widest text-white">
            COMBO {combo.comboNumber}
          </span>
        </div>
      </div>

      {/* Bottom-Left: @username */}
      {/* Bottom-Right: pagination dots */}
      <div className="absolute bottom-1 left-4 right-4 flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground/50">
          ⋮⋮⋮
        </span>
      </div>
    </motion.div>
  );
}

export function ColorCombos() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 clay-sm rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Colour combinations
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="font-display mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Ready-made colour combos
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-2 max-w-lg mx-auto text-sm text-muted-foreground"
        >
          Hand-picked pairs that work together — each with its hex code, ready to drop into your next design.
        </motion.p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {COMBOS.map((combo, i) => (
          <ColorCard key={combo.id} combo={combo} index={i} />
        ))}
      </div>

      {/* Pagination dots */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {COMBOS.map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
          />
        ))}
      </div>
    </section>
  );
}
