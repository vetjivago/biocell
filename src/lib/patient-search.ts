import type { SessionUser } from "./auth";
import { hasRole } from "./roles";

export const SEARCH_FIELDS = {
  all: { label: "Todos os campos", placeholder: "Buscar por animal, responsável, veterinário, clínica..." },
  name: { label: "Animal", placeholder: "Buscar por nome do animal..." },
  ownerName: { label: "Responsável", placeholder: "Buscar por nome do responsável (tutor)..." },
  ownerPhone: { label: "Telefone", placeholder: "Buscar por telefone do responsável..." },
  veterinarian: { label: "Veterinário", placeholder: "Buscar por veterinário..." },
  clinic: { label: "Clínica", placeholder: "Buscar por clínica..." },
  breed: { label: "Raça", placeholder: "Buscar por raça..." },
} as const;

export type SearchField = keyof typeof SEARCH_FIELDS;
const TEXT_FIELDS = ["name", "ownerName", "ownerPhone", "veterinarian", "clinic", "breed"] as const;

export function parseSearchField(campo: string | null | undefined): SearchField {
  return campo && campo in SEARCH_FIELDS ? (campo as SearchField) : "all";
}

// Pacientes ocultos pela matriz ficam fora de listas, buscas e totais (o histórico continua no banco)
export const VISIBLE_PATIENT = { archivedAt: null };
// Para prontuários, OS e vendas: só os de pacientes visíveis
export const OF_VISIBLE_PATIENT = { patient: VISIBLE_PATIENT };

// Filtro de pacientes respeitando as unidades do usuário; a matriz pode listar só os ocultos
export function patientSearchWhere(session: SessionUser, rawQ: string | null | undefined, field: SearchField, archived = false) {
  const q = rawQ?.trim();
  const isAdmin = hasRole(session.role, "ADMIN");
  return {
    ...(isAdmin ? {} : { unitId: { in: session.unitIds } }),
    archivedAt: archived && isAdmin ? { not: null } : null,
    ...(q
      ? field === "all"
        ? { OR: TEXT_FIELDS.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) }
        : { [field]: { contains: q, mode: "insensitive" as const } }
      : {}),
  };
}

export function canAccessUnit(session: SessionUser, unitId: string) {
  return hasRole(session.role, "ADMIN") || session.unitIds.includes(unitId);
}
