import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const batches = await prisma.cellBatch.findMany({
    include: { product: { select: { name: true, code: true, species: true } } },
    orderBy: { batchNumber: "asc" },
  });

  return Response.json(batches);
}
