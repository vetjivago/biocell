import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  const isAdmin = session.role === "ADMIN";
  const unitFilter = unitId
    ? { unitId }
    : isAdmin ? {} : { unitId: { in: session.unitIds } };

  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["unitId", "batchId"],
    _sum: { quantity: true },
    where: unitFilter,
  });

  const batchIds = [...new Set(grouped.map((g) => g.batchId))];
  const unitIds = [...new Set(grouped.map((g) => g.unitId))];

  const [batches, units] = await Promise.all([
    prisma.cellBatch.findMany({
      where: { id: { in: batchIds } },
      include: { product: { select: { name: true, code: true, species: true } } },
    }),
    prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, name: true },
    }),
  ]);

  const batchMap = Object.fromEntries(batches.map((b) => [b.id, b]));
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]));

  const stock = grouped
    .filter((g) => (g._sum.quantity || 0) > 0)
    .map((g) => {
      const batch = batchMap[g.batchId];
      return {
        unitId: g.unitId,
        unitName: unitMap[g.unitId],
        batchId: g.batchId,
        batchNumber: batch?.batchNumber,
        productName: batch?.product.name,
        productCode: batch?.product.code,
        species: batch?.product.species,
        expirationDate: batch?.expirationDate,
        balance: g._sum.quantity || 0,
      };
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName));

  return Response.json(stock);
}
