"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Phone, Plus, Search, X } from "lucide-react";
import { formatCnpj } from "@/lib/units";
import { fold } from "@/lib/sales-types";

export type UnitCard = {
  id: string;
  name: string;
  city: string;
  state: string;
  cnpj: string | null;
  species: string;
  address: string | null;
  phone: string | null;
  active: boolean;
};

type Props = {
  units: UnitCard[];
  isAdmin: boolean;
  canOpen: boolean;
};

const digits = (s: string) => s.replace(/\D/g, "");

export default function UnitsList({ units, isAdmin, canOpen }: Props) {
  const [query, setQuery] = useState("");

  // Busca por nome, cidade, UF ou CNPJ, sem diferenciar acentos e maiúsculas
  const filtered = useMemo(() => {
    const q = fold(query);
    if (!q) return units;
    const qDigits = digits(q);
    return units.filter((u) => {
      const text = fold(`${u.name} ${u.city} ${u.state}`);
      if (text.includes(q)) return true;
      return qDigits.length >= 3 && !!u.cnpj && digits(u.cnpj).includes(qDigits);
    });
  }, [units, query]);

  const activeCount = units.filter((u) => u.active).length;
  const active = filtered.filter((u) => u.active);
  const inactive = filtered.filter((u) => !u.active);

  const grouped = active.reduce<Record<string, UnitCard[]>>((acc, u) => {
    (acc[u.state] ||= []).push(u);
    return acc;
  }, {});

  const card = (u: UnitCard) => {
    const body = (
      <>
        <h3 className="font-semibold text-gray-900 text-sm mb-1">{u.name}</h3>
        <p className="text-xs text-gray-500 mb-2">{u.city}/{u.state}{u.cnpj ? ` · ${formatCnpj(u.cnpj)}` : ""}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {u.species.split(", ").map((s) => (
            <span key={s} className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
              {s}
            </span>
          ))}
        </div>
        {u.address && (
          <p className="text-xs text-gray-500 flex items-start gap-1 mb-1">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{u.address}</span>
          </p>
        )}
        {u.phone && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Phone size={12} />
            {u.phone}
          </p>
        )}
      </>
    );
    const cls = `block bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow ${u.active ? "" : "opacity-60"}`;
    return canOpen
      ? <Link key={u.id} href={`/unidades/${u.id}`} className={cls}>{body}</Link>
      : <div key={u.id} className={cls}>{body}</div>;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades Avançadas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {query
              ? `${filtered.length} de ${units.length} unidades encontradas`
              : `${activeCount} unidades ativas`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar UABC, cidade ou CNPJ"
              aria-label="Pesquisar unidade"
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {isAdmin && (
            <Link href="/unidades/nova" className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium whitespace-nowrap">
              <Plus size={16} /> Nova UABC
            </Link>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-sm text-gray-500 border border-gray-100">
          Nenhuma unidade encontrada para “{query}”.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([state, stateUnits]) => (
            <div key={state}>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                {state === "EXT" ? "Internacional" : state} ({stateUnits.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stateUnits.map(card)}
              </div>
            </div>
          ))}

          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Desativadas ({inactive.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inactive.map(card)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
