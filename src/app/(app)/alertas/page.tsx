import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function AlertasPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = session.role === "ADMIN";
  const unitFilter = isAdmin ? {} : { unitId: { in: session.unitIds } };

  const alerts = await prisma.alert.findMany({
    where: unitFilter,
    include: { unit: { select: { name: true } } },
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Alertas</h1>

      <div className="space-y-3">
        {alerts.map((a) => {
          const content = (
            <div className="flex items-start gap-3">
              {a.resolved ? (
                <CheckCircle className="text-green-500 mt-0.5 shrink-0" size={20} />
              ) : (
                <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={20} />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{a.unit.name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    a.resolved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {a.resolved ? "Resolvido" : a.type === "LOW_STOCK" ? "Estoque Baixo" : a.type}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{a.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString("pt-BR")}</p>
                  {!a.resolved && isAdmin && (
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      Abastecer <ChevronRight size={14} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );

          if (!a.resolved && isAdmin) {
            return (
              <Link key={a.id} href={`/estoque?unitId=${a.unitId}&supply=true`} className="block bg-white rounded-xl p-4 shadow-sm border border-amber-200 hover:bg-amber-50 transition-colors">
                {content}
              </Link>
            );
          }

          return (
            <div key={a.id} className={`bg-white rounded-xl p-4 shadow-sm border ${
              a.resolved ? "border-gray-100 opacity-60" : "border-amber-200"
            }`}>
              {content}
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
            <CheckCircle className="text-green-500 mx-auto mb-3" size={40} />
            <p className="text-gray-500">Nenhum alerta no momento</p>
          </div>
        )}
      </div>
    </div>
  );
}
