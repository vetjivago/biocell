import { prisma } from "@/lib/prisma";
import { canManageUnits, canViewUnitDetails, seesAllUnits } from "@/lib/roles";
import { getSession } from "@/lib/auth";
import UnitsList from "./UnitsList";

export default async function UnidadesPage() {
  const session = await getSession();
  if (!session) return null;

  const isAdmin = canManageUnits(session.role);
  // Matriz e administrativo abrem a ficha para editar; o comercial só consulta
  const canOpen = canViewUnitDetails(session.role);
  // Matriz vê também as desativadas (no fim da lista) para poder reativar
  const units = await prisma.unit.findMany({
    where: isAdmin ? {} : seesAllUnits(session.role) ? { active: true } : { id: { in: session.unitIds }, active: true },
    orderBy: [{ state: "asc" }, { name: "asc" }],
    // Só o que os cartões exibem vai para o navegador
    select: { id: true, name: true, city: true, state: true, cnpj: true, species: true, address: true, phone: true, active: true },
  });

  return <UnitsList units={units} isAdmin={isAdmin} canOpen={canOpen} />;
}
