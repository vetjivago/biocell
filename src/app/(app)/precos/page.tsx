import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { hasRole } from "@/lib/roles";
import PriceTable from "./PriceTable";

// Tabela de preços dos orçamentos: só a matriz define os valores fixos
export default async function PrecosPage() {
  const session = await getSession();
  if (!session) return null;
  if (!hasRole(session.role, "ADMIN")) notFound();

  const items = await prisma.priceItem.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, price: true, active: true } });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Tabela de preços</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Itens com valor fixo entram no orçamento com o preço travado: ninguém altera na hora de orçar.
        Deixe o valor em branco para o item aparecer na busca com preço livre. Itens fora da tabela também ficam com preço livre.
      </p>
      <PriceTable items={items} />
    </div>
  );
}
