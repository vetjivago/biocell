"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type CartLine, parseCartLine } from "@/lib/store";

// Carrinho da loja: fica no navegador de quem está comprando (por usuário), até fechar o pedido
const key = (userId: string) => `biocell-carrinho:${userId}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();
const EMPTY: CartLine[] = [];

function read(userId: string): CartLine[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key(userId)); } catch { /* navegação privada etc. */ }
  const hit = cache.get(userId);
  if (hit && hit.raw === raw) return hit.lines;
  let lines: CartLine[] = EMPTY;
  try { lines = raw ? (JSON.parse(raw) as unknown[]).map(parseCartLine).filter((l): l is CartLine => !!l) : EMPTY; } catch { lines = EMPTY; }
  cache.set(userId, { raw, lines });
  return lines;
}

function write(userId: string, lines: CartLine[]) {
  try { localStorage.setItem(key(userId), JSON.stringify(lines)); } catch { /* sem armazenamento: carrinho só nesta tela */ }
  cache.set(userId, { raw: JSON.stringify(lines), lines });
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

export function useCart(userId: string) {
  const lines = useSyncExternalStore(subscribe, () => read(userId), () => EMPTY);
  const add = useCallback((productId: string, variant: string | null, quantity: number) => {
    const cur = read(userId);
    const same = cur.find((l) => l.productId === productId && l.variant === variant);
    write(userId, same
      ? cur.map((l) => (l === same ? { ...l, quantity: Math.min(9999, l.quantity + quantity) } : l))
      : [...cur, { productId, variant, quantity }]);
  }, [userId]);
  const setQty = useCallback((i: number, quantity: number) => {
    const cur = read(userId);
    write(userId, quantity > 0 ? cur.map((l, j) => (j === i ? { ...l, quantity: Math.min(9999, quantity) } : l)) : cur.filter((_, j) => j !== i));
  }, [userId]);
  const clear = useCallback(() => write(userId, []), [userId]);
  return { lines, add, setQty, clear, count: lines.reduce((s, l) => s + l.quantity, 0) };
}
