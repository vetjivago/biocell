import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { seesAllUnits } from "@/lib/roles";
import { canProcessPurchases, canRequestPurchases } from "@/lib/purchase-orders";
import StoreNav from "../StoreNav";
import Cart from "./Cart";

export default async function CarrinhoPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canRequestPurchases(session.role)) notFound();
  const units = await prisma.unit.findMany({
    where: { active: true, ...(seesAllUnits(session.role) ? {} : { id: { in: session.unitIds } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <StoreNav userId={session.id} canBuy />
      <Cart userId={session.id} units={units} isAdmin={canProcessPurchases(session.role)} />
    </div>
  );
}
