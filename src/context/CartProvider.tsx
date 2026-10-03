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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [lastAddedAt, setLastAddedAt] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / private mode — cart stays in memory */
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => [...prev, item]);
    setLastAddedAt(Date.now());
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      total: items.reduce((sum, i) => sum + i.price, 0),
      lastAddedAt,
      addItem,
      removeItem,
      clear,
    }),
    [items, lastAddedAt, addItem, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
