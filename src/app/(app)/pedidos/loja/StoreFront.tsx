"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronRight, LayoutGrid, List, Package, ShoppingCart } from "lucide-react";
import { STORE_CATEGORIES, STORE_PRODUCTS, type StoreCategory, type StoreProduct } from "@/lib/store";
import { brl } from "@/lib/purchase-orders";
import { useCart } from "../cart";

const SORTS = [
  { key: "relevantes", label: "Produtos relevantes" },
  { key: "menor", label: "Menor preço" },
  { key: "maior", label: "Maior preço" },
  { key: "az", label: "Nome (A-Z)" },
  { key: "za", label: "Nome (Z-A)" },
];

export function CategoryTag({ category }: { category: StoreCategory }) {
  const c = STORE_CATEGORIES.find((x) => x.key === category)!;
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${c.cls}`}>{c.label}</span>;
}

export function ProductImage({ p, className = "" }: { p: StoreProduct; className?: string }) {
  return p.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image} alt={p.name} loading="lazy" className={`object-contain bg-white ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-gray-50 text-gray-300 ${className}`}><Package size={48} /></div>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function StoreFront({ userId, initialQuery }: { userId: string; initialQuery: string }) {
  const { add } = useCart(userId);
  const [query, setQuery] = useState(initialQuery);
  const [cats, setCats] = useState<StoreCategory[]>([]);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sort, setSort] = useState("relevantes");
  const [view, setView] = useState<"blocos" | "lista">("blocos");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [added, setAdded] = useState("");

  const products = useMemo(() => {
    const lo = parseFloat(min.replace(",", ".")) * 100;
    const hi = parseFloat(max.replace(",", ".")) * 100;
    const list = STORE_PRODUCTS.filter((p) =>
      (!query.trim() || norm(p.name).includes(norm(query.trim()))) &&
      (!cats.length || cats.includes(p.category)) &&
      (!(lo >= 0) || p.price >= lo) && (!(hi >= 0) || p.price <= hi));
    const by: Record<string, (a: StoreProduct, b: StoreProduct) => number> = {
      menor: (a, b) => a.price - b.price,
      maior: (a, b) => b.price - a.price,
      az: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      za: (a, b) => b.name.localeCompare(a.name, "pt-BR"),
    };
    return by[sort] ? [...list].sort(by[sort]) : list;
  }, [query, cats, min, max, sort]);

  function buy(p: StoreProduct) {
    add(p.id, null, Math.max(1, qty[p.id] || 1));
    setAdded(p.id);
    setTimeout(() => setAdded((a) => (a === p.id ? "" : a)), 1800);
  }

  const action = (p: StoreProduct) => p.variants ? (
    <Link href={`/pedidos/loja/${p.id}`} className="flex-1 flex items-center justify-center gap-1 border border-primary text-primary px-3 py-2 rounded-lg text-sm hover:bg-primary/5">
      Selecionar opções <ChevronRight size={14} />
    </Link>
  ) : (
    <div className="flex-1 flex gap-2">
      <select value={qty[p.id] || 1} onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })} aria-label={`Quantidade de ${p.name}`}
        className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
      </select>
      <button onClick={() => buy(p)} className="flex-1 flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg text-sm">
        {added === p.id ? <><Check size={15} /> Adicionado</> : <><ShoppingCart size={15} /> Comprar</>}
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-5">
      <aside className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-5 h-fit">
        <p className="font-semibold text-gray-900">Filtros</p>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Produto</p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome do produto..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Fornecedor</p>
          <p className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2">BIO CELL by Vetnil</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Categorias</p>
          {STORE_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <input type="checkbox" checked={cats.includes(c.key)} onChange={(e) => setCats(e.target.checked ? [...cats, c.key] : cats.filter((x) => x !== c.key))} />
              <span className={`px-2 py-0.5 rounded text-xs ${c.cls}`}>{c.label}</span>
            </label>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Intervalo de preço</p>
          <div className="flex gap-2">
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="Mínimo" aria-label="Preço mínimo" className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm" />
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="Máximo" aria-label="Preço máximo" className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
      </aside>

      <section>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          <p className="font-semibold text-gray-900">Loja <span className="text-sm font-normal text-gray-500">{products.length} produto(s) encontrado(s)</span></p>
          <div className="ml-auto flex items-center gap-2">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar por" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setView("blocos")} className={`flex items-center gap-1 px-3 py-1.5 text-sm ${view === "blocos" ? "bg-primary/10 text-primary" : "text-gray-500"}`}><LayoutGrid size={14} /> Blocos</button>
              <button onClick={() => setView("lista")} className={`flex items-center gap-1 px-3 py-1.5 text-sm ${view === "lista" ? "bg-primary/10 text-primary" : "text-gray-500"}`}><List size={14} /> Lista</button>
            </div>
          </div>
        </div>

        {products.length === 0 && <p className="text-center text-sm text-gray-400 py-16">Nenhum produto encontrado</p>}

        {view === "blocos" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <Link href={`/pedidos/loja/${p.id}`} className="block relative">
                  <ProductImage p={p} className="w-full h-44" />
                  <span className="absolute left-2 bottom-2"><CategoryTag category={p.category} /></span>
                </Link>
                <div className="p-3 flex flex-col flex-1">
                  <Link href={`/pedidos/loja/${p.id}`} className="text-sm text-gray-800 hover:text-primary line-clamp-2 min-h-10">{p.name}</Link>
                  <p className="text-lg font-semibold text-gray-900 mt-1 mb-3">{brl(p.price)}</p>
                  <div className="mt-auto flex">{action(p)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {products.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <Link href={`/pedidos/loja/${p.id}`}><ProductImage p={p} className="w-16 h-16 rounded-lg" /></Link>
                <div className="flex-1 min-w-[12rem]">
                  <CategoryTag category={p.category} />
                  <Link href={`/pedidos/loja/${p.id}`} className="block text-sm text-gray-800 hover:text-primary">{p.name}</Link>
                </div>
                <p className="font-semibold text-gray-900 w-28 text-right">{brl(p.price)}</p>
                <div className="w-full sm:w-64 flex">{action(p)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
