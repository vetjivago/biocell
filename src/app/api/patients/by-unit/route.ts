import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { hasRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  if (!unitId) return Response.json([]);
  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(unitId)) {
    return Response.json([], { status: 403 });
  }

  const patients = await prisma.patient.findMany({
    where: { unitId },
    select: { id: true, name: true, species: true, breed: true, ownerName: true },
    orderBy: { name: "asc" },
  });

  return Response.json(patients);
}
