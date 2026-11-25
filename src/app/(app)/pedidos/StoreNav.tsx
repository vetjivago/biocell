"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Search, ShoppingBag, ShoppingCart, Truck } from "lucide-react";
import { useCart } from "./cart";

// Barra da loja, como no Sults: Produtos · Meus pedidos · Carrinho + busca
export default function StoreNav({ userId, canBuy, ordersLabel = "Meus pedidos" }: { userId: string; canBuy: boolean; ordersLabel?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart(userId);
  const [q, setQ] = useState("");
  const tabs = [
    ...(canBuy ? [{ href: "/pedidos/loja", label: "Produtos", icon: ShoppingBag }] : []),
    { href: "/pedidos", label: ordersLabel, icon: Truck },
    ...(canBuy ? [{ href: "/pedidos/carrinho", label: "Carrinho", icon: ShoppingCart, badge: count }] : []),
  ];
  const isActive = (href: string) => (href === "/pedidos" ? pathname === "/pedidos" || /^\/pedidos\/(?!loja|carrinho)[^/]+$/.test(pathname) : pathname.startsWith(href));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2 mb-5 flex flex-wrap items-center gap-2 print:hidden">
      <nav className="flex items-center gap-1">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs ${isActive(t.href) ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            <t.icon size={18} />
            {t.label}
            {!!t.badge && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-sidebar text-[11px] font-bold flex items-center justify-center">{t.badge}</span>
            )}
          </Link>
        ))}
      </nav>
      {canBuy && (
        <form className="flex-1 min-w-[200px] flex items-center gap-2 sm:justify-end"
          onSubmit={(e) => { e.preventDefault(); router.push(`/pedidos/loja${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você busca?" aria-label="Buscar produto"
            className="w-full sm:max-w-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm" />
          <button className="flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-full text-sm"><Search size={14} /> Pesquisar</button>
        </form>
      )}
    </div>
  );
}
