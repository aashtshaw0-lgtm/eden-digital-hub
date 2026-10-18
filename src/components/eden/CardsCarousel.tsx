import { motion } from "framer-motion";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useOutsideClick } from "@/hooks/use-outside-click";

export interface CarouselCardData {
  /** Id must be unique — it drives which card the modal re-centres on. */
  id: string;
  /** Short label: a service category, a hand-drawn title, etc. */
  category: string;
  /** Main title. */
  title: string;
  /** Small icon shown inside the place-chip on the preview tile. */
  icon: ReactNode;
  /** Modal contents — a tier ladder, a pricing table, a sentence, anything. */
  content: ReactNode;
}

interface CardsCarouselContextValue {
  onCardClose: (card: CarouselCardData) => void;
  currentCard: CarouselCardData | null;
  isOpen: boolean;
}

const CardsCarouselContext = React.createContext<CardsCarouselContextValue>({
  onCardClose: () => {},
  currentCard: null,
  isOpen: false,
});

/**
 * A carousel of vertical portfolio-style cards: pull them sideways with the
 * track's mouse, keyboard, or the arrows, and open any card to see its
 * contents on the full screen.
 */
export function CardsCarousel({
  items,
  className,
}: {
  items: CarouselCardData[];
  /** Extra classes for the track. */
  className?: string;
}) {
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 1);
  const [openId, setOpenId] = useState<string | null>(null);

  const currentCard = openId
    ? items.find((item) => item.id === openId) ?? null
    : null;
  const isOpen = Boolean(openId);

  /* ── scrolling state ── */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = 0;
    setCanScrollLeft(track.scrollLeft > 0);
    setCanScrollRight(track.scrollLeft < track.scrollWidth - track.clientWidth);
  }, [items.length]);

  const checkScrollability = () => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 0);
    setCanScrollRight(track.scrollLeft < track.scrollWidth - track.clientWidth);
  };

  useEffect(() => {
    const onResize = () => checkScrollability();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const scrollByAmount = (direction: -1 | 1) => {
    trackRef.current?.scrollBy({
      left: direction * 360,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  /* ── modal open / close ── */
  const openCard = (card: CarouselCardData) => {
    setOpenId(card.id);
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const closeCard = () => {
    setOpenId(null);
  };

  useOutsideClick(
    trackRef,
    (event) => {
      // The backdrop click only closes a card when it is *its own* backdrop.
      if (event.target instanceof HTMLElement && event.target.closest("[data-carousel-modal]")) {
        return;
      }
      closeCard();
    },
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCard();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    const active = document.querySelector<HTMLButtonElement>(
      '[data-carousel-modal] [data-close-button]',
    );
    active?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (reduced) {
    return (
      <div className={cn("w-full max-w-4xl", className)}>
        <div className="flex flex-wrap justify-center gap-3">
          {items.map((item) => (
            <motion.div
              key={item.id}
              className="clay rounded-2xl p-3 shadow-sm"
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="clay-inset rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="tint flex size-8 items-center justify-center rounded-lg">
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.category}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.content} — three tiers, one brief.
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <CardsCarouselContext.Provider
      value={{ onCardClose: closeCard, currentCard, isOpen }}
    >
      <div className="relative w-full">        <div
          ref={trackRef}
          className="flex w-full snap-x snap-mandatory overflow-x-scroll overscroll-x-auto scroll-smooth py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:py-16"
          onScroll={checkScrollability}
        >
          <div className="flex w-max flex-row justify-start gap-3 pl-2">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                data-carousel-card={item.id}
                className="clay flex-shrink-0 w-56 cursor-pointer rounded-[1.35rem] p-3 transition-shadow hover:shadow-lg"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => openCard(item)}
                role="button"
                tabIndex={index}
              >
                <div className="clay-inset rounded-xl p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="tint flex size-9 items-center justify-center rounded-xl">
                      {item.icon}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.content}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-primary">
                    <span>View details</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

        <div className="flex justify-center gap-4">
          <span className="sr-only">Keyboard arrow navigation</span>
          <button
            type="button"
            aria-label="Scroll carousel right"
            className="tap relative z-20 flex h-10 w-10 items-center justify-center rounded-full clay-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            onClick={() => scrollByAmount(1)}
            disabled={!canScrollRight}
            aria-disabled={!canScrollRight}
            tabIndex={canScrollRight ? 0 : -1}
          >
            <ArrowRight className="size-5" />
          </button>
        </div>

        {isOpen && (
          <div
            data-carousel-modal
            className="fixed inset-0 z-[80] flex h-full w-full items-end justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm sm:items-center sm:p-0"
          >
            <div
              data-carousel-modal
              className="clay relative w-full max-w-2xl overflow-hidden rounded-[1.35rem] shadow-2xl"
            >
              <button
                type="button"
                data-close-button
                aria-label="Close card"
                className="tap absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full clay-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={closeCard}
              >
                <ArrowRight className="size-5 rotate-180" />
              </button>

              <div className="px-6 pt-12 pb-8 sm:px-10 sm:pt-16 sm:pb-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      {currentCard?.category}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold">
                      {currentCard?.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    data-close-button
                    aria-label="Close card"
                    className="tap shrink-0 flex h-8 w-8 items-center justify-center rounded-full clay-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={closeCard}
                  >
                    <ArrowRight className="size-5 rotate-180" />
                  </button>
                </div>

                <div
                  data-carousel-modal
                  className="mt-6 overflow-hidden rounded-2xl bg-muted/50 p-5"
                >
                  {currentCard?.content ?? null}
                </div>
              </div>
            </div>
          </div>
      )}
    </CardsCarouselContext.Provider>
  );
}