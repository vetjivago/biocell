import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { MapPin, Phone, Plus } from "lucide-react";

export default async function UnidadesPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === "ADMIN";
  // Matriz vê também as desativadas (no fim da lista) para poder reativar
  const units = await prisma.unit.findMany({
    where: isAdmin ? {} : { id: { in: session.unitIds }, active: true },
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });
  const active = units.filter((u) => u.active);
  const inactive = units.filter((u) => !u.active);

  const grouped = active.reduce<Record<string, typeof units>>((acc, u) => {
    const key = u.state;
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  const card = (u: (typeof units)[number]) => {
    const body = (
      <>
        <h3 className="font-semibold text-gray-900 text-sm mb-1">{u.name}</h3>
        <p className="text-xs text-gray-500 mb-2">{u.city}/{u.state}</p>
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
    return isAdmin
      ? <Link key={u.id} href={`/unidades/${u.id}`} className={cls}>{body}</Link>
      : <div key={u.id} className={cls}>{body}</div>;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades Avançadas</h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} unidades ativas</p>
        </div>
        {isAdmin && (
          <Link href="/unidades/nova" className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-medium">
            <Plus size={16} /> Nova UABC
          </Link>
        )}
      </div>

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
    </div>
  );
}
