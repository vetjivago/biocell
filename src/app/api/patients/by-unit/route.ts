import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  if (!unitId) return Response.json([]);

  const patients = await prisma.patient.findMany({
    where: { unitId },
    select: { id: true, name: true, species: true, breed: true, ownerName: true },
    orderBy: { name: "asc" },
  });

  return Response.json(patients);
}
