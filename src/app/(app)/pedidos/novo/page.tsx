import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { seesAllUnits } from "@/lib/roles";
import { canProcessPurchases, canRequestPurchases } from "@/lib/purchase-orders";
import NewPurchaseForm from "./NewPurchaseForm";

export default async function NovoPedidoPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canRequestPurchases(session.role)) notFound();
  const units = await prisma.unit.findMany({
    where: { active: true, ...(seesAllUnits(session.role) ? {} : { id: { in: session.unitIds } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <Link href="/pedidos" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Pedidos de compra
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Novo pedido de compra</h1>
      <p className="text-sm text-gray-500 mb-6">Informe as raques de células. Meios, soros e materiais são calculados a partir do estoque atual da unidade.</p>
      <NewPurchaseForm units={units} isAdmin={canProcessPurchases(session.role)} />
    </div>
  );
}
