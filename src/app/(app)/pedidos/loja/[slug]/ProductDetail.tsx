"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { brl } from "@/lib/purchase-orders";
import { storeProduct } from "@/lib/store";
import { useCart } from "../../cart";
import { CategoryTag, ProductImage } from "../StoreFront";

export default function ProductDetail({ userId, productId }: { userId: string; productId: string }) {
  const p = storeProduct(productId)!;
  const { add } = useCart(userId);
  const [variant, setVariant] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");

  function addToCart() {
    if (p.variants && !variant) return setMsg(`Selecione: ${p.variantLabel?.toLowerCase()}`);
    add(p.id, variant, qty);
    setMsg("ok");
  }

  return (
    <div>
      <Link href="/pedidos/loja" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Produtos
      </Link>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductImage p={p} className="w-full h-80 rounded-lg" />
        <div>
          <CategoryTag category={p.category} />
          <h1 className="text-xl font-semibold text-gray-900 mt-2">{p.name}</h1>
          {p.subtitle && <p className="text-sm text-gray-500 mt-1">{p.subtitle}</p>}
          <p className="text-2xl font-bold text-gray-900 mt-3">{brl(p.price)}</p>

          {p.variants && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">{p.variantLabel}:</p>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <button key={v.key} type="button" onClick={() => { setVariant(v.key); setMsg(""); }}
                    className={`px-4 py-2 rounded-lg text-sm border ${variant === v.key ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                    {v.label}
                  </button>
                ))}
              </div>
              {!variant && <p className="text-xs text-gray-500 mt-2">Selecione a variação desejada</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <div className="flex items-center border border-gray-300 rounded-lg">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Menos" className="p-2.5 text-gray-600"><Minus size={14} /></button>
              <input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                aria-label="Quantidade" className="w-16 text-center text-sm border-x border-gray-300 py-2" />
              <button type="button" onClick={() => setQty(Math.min(9999, qty + 1))} aria-label="Mais" className="p-2.5 text-gray-600"><Plus size={14} /></button>
            </div>
            <button onClick={addToCart} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg text-sm">
              <ShoppingCart size={16} /> Adicionar no carrinho
            </button>
          </div>
          {msg === "ok" ? (
            <p className="text-sm text-green-700 mt-3 flex items-center gap-2">
              <Check size={16} /> Adicionado ao carrinho. <Link href="/pedidos/carrinho" className="underline">Ver carrinho</Link> · <Link href="/pedidos/loja" className="underline">continuar comprando</Link>
            </p>
          ) : msg && <p className="text-sm text-amber-700 mt-3">{msg}</p>}

          <div className="mt-6 pt-4 border-t border-gray-100 text-sm">
            <p className="text-gray-500">Fornecedor deste produto</p>
            <p className="font-medium text-gray-800">BIO CELL by Vetnil</p>
          </div>
          {p.description && (
            <div className="mt-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Descrição do produto</p>
              {p.description.map((d) => <p key={d}>{d}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
