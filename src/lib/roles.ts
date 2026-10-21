// Funções de acesso do sistema (sem dependências de servidor: usadas também no navegador)
export const ROLES = {
  ADMIN: { label: "Matriz (administrador)", description: "Vê e gerencia todas as unidades, estoque e acessos." },
  UNIT_MANAGER: { label: "Gestor da unidade", description: "Tudo da(s) sua(s) unidade(s), inclusive criar acessos da equipe." },
  PROFESSIONAL: { label: "Veterinário clínico", description: "Pacientes, prontuários e abertura de Ordens de Serviço." },
  LAB: { label: "Laboratório / preparo", description: "Fila de Ordens de Serviço, preparo das células e prontuário CT." },
  PROFESSIONAL_LAB: { label: "Veterinário clínico + Laboratório", description: "Atende e também prepara as células." },
  STOCK: { label: "Estoque / logística", description: "Abastecimento e movimentações de estoque." },
} as const;

export type Role = keyof typeof ROLES;

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && v in ROLES;
}

// Quem atende ou prepara (acesso a pacientes, prontuários e OS)
export const CLINICAL_ROLES: Role[] = ["ADMIN", "UNIT_MANAGER", "PROFESSIONAL", "LAB", "PROFESSIONAL_LAB"];

// Clínico e laboratório são marcados como caixas: a pessoa pode ter um ou os dois
export function roleFromFlags(clinical: boolean, lab: boolean): Role | null {
  if (clinical && lab) return "PROFESSIONAL_LAB";
  if (clinical) return "PROFESSIONAL";
  if (lab) return "LAB";
  return null;
}

export function roleFlags(role: string) {
  return { clinical: role === "PROFESSIONAL" || role === "PROFESSIONAL_LAB", lab: role === "LAB" || role === "PROFESSIONAL_LAB" };
}

export function canManageUsers(role: string) {
  return role === "ADMIN" || role === "UNIT_MANAGER";
}

// Gestor não cria acesso de matriz nem de estoque central
export function assignableRoles(role: string): Role[] {
  if (role === "ADMIN") return Object.keys(ROLES) as Role[];
  if (role === "UNIT_MANAGER") return ["UNIT_MANAGER", "PROFESSIONAL", "LAB", "PROFESSIONAL_LAB"];
  return [];
}

export function roleLabel(role: string) {
  return isRole(role) ? ROLES[role].label : role;
}
