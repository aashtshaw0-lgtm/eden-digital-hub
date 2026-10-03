import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  serviceId: string;
  tierId: string;
  serviceName: string;
  tierName: string;
  price: number;
  category: string;
  requirements: Record<string, unknown>;
}

interface CartContextValue {
  items: CartItem[];
  total: number;
  lastAddedAt: number;
  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "eden.cart.v1";

const initialItems = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [, forceUpdate] = useState(0);
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [, setState] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / private mode — cart stays in memory */
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const next = [...prev, item];
      forceUpdate((n) => n + 1);
      return next;
    });
    setState((n) => n + 1);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      forceUpdate((n) => n + 1);
      return next;
    });
    setState((n) => n + 1);
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      const next = [];
      forceUpdate((n) => n + 1);
      return next;
    });
    setState((n) => n + 1);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      total: items.reduce((sum, i) => sum + i.price, 0),
      lastAddedAt: Date.now(),
      addItem,
      removeItem,
      clear,
    }),
    [items, addItem, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
