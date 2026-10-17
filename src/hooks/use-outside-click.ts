import { useEffect, type RefObject } from "react";

/**
 * Fires `callback` when a press or tap lands outside `ref`'s element.
 *
 * Used by overlays (carousel card modals) so a click on the backdrop or the
 * page behind them closes the overlay instead of doing nothing.
 *
 * `callback` should be stable-ish — inline closures re-subscribe the listener
 * on each render, which is cheap but worth knowing.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  callback: (event: Event) => void,
) {
  useEffect(() => {
    const listener = (event: Event) => {
      const node = ref.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      callback(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, callback]);
}