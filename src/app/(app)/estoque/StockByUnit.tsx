"use client";

import { useState } from "react";
import { ChevronDown, Package } from "lucide-react";

interface StockItem {
  unitId: string;
  unitName: string;
  batchNumber: string;
  productName: string;
  species: string;
  expirationDate: string | null;
  balance: number;
}

interface UnitGroup {
  unitId: string;
  unitName: string;
  totalStraws: number;
  items: StockItem[];
}

export default function StockByUnit({ stock }: { stock: StockItem[] }) {
  const [openUnit, setOpenUnit] = useState<string | null>(null);

  const groups: UnitGroup[] = [];
  const map = new Map<string, UnitGroup>();

  for (const s of stock) {
    let group = map.get(s.unitId);
    if (!group) {
      group = { unitId: s.unitId, unitName: s.unitName, totalStraws: 0, items: [] };
      map.set(s.unitId, group);
      groups.push(group);
    }
    group.totalStraws += s.balance;
    group.items.push(s);
  }

  groups.sort((a, b) => a.unitName.localeCompare(b.unitName));

  function toggle(unitId: string) {
    setOpenUnit((prev) => (prev === unitId ? null : unitId));
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = openUnit === g.unitId;
        return (
          <div key={g.unitId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggle(g.unitId)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Package className="text-primary shrink-0" size={20} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{g.unitName}</p>
                  <p className="text-xs text-gray-500">{g.items.length} {g.items.length === 1 ? "lote" : "lotes"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-lg font-bold ${g.totalStraws < 10 ? "text-red-500" : "text-gray-900"}`}>
                  {g.totalStraws} <span className="text-xs font-normal text-gray-500">palhetas</span>
                </span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Produto</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Lote</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Espécie</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-5 py-2.5">Validade</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-5 py-2.5">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((s, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-5 py-3 text-sm text-gray-700">{s.productName}</td>
                          <td className="px-5 py-3 text-sm font-mono text-gray-600">{s.batchNumber}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{s.species}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">
                            {s.expirationDate ? new Date(s.expirationDate).toLocaleDateString("pt-BR") : "–"}
                          </td>
                          <td className={`px-5 py-3 text-sm font-bold text-right ${s.balance < 10 ? "text-red-500" : "text-gray-900"}`}>
                            {s.balance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-sm text-gray-400">Nenhum estoque registrado</p>
        </div>
      )}
    </div>
  );
}
