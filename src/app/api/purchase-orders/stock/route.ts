import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { canRequestPurchases } from "@/lib/purchase-orders";
import { canSeeUnit, unitStockByProduct } from "@/lib/purchase-orders-server";

// Saldo da unidade por produto, para o cálculo do pedido na tela
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const unitId = request.nextUrl.searchParams.get("unitId") || "";
  if (!canRequestPurchases(session.role) || !unitId || !canSeeUnit(session, unitId)) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }
  return Response.json(await unitStockByProduct(unitId));
}
