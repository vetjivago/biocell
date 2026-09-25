import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json([], { status: 401 });

  const isAdmin = session.role === "ADMIN";
  const units = await prisma.unit.findMany({
    where: isAdmin ? { active: true } : { id: { in: session.unitIds }, active: true },
    select: { id: true, name: true, city: true, state: true, species: true },
    orderBy: { name: "asc" },
  });

  return Response.json(units);
}
