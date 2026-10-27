// Funções de acesso do sistema (sem dependências de servidor: usadas também no navegador)
export const ROLES = {
  ADMIN: { label: "Matriz (administrador)", description: "Acesso total: todas as unidades, prontuários, estoque, relatórios e acessos." },
  ADMINISTRATIVE: { label: "Administrativo", description: "Abre novas UABCs e cadastra usuários." },
  COMMERCIAL: { label: "Comercial", description: "Só consulta: dashboard e relatórios de todas as unidades, sem alterar nada." },
  UNIT_MANAGER: { label: "Gestor da unidade", description: "Tudo da(s) sua(s) unidade(s), inclusive criar acessos da equipe." },
  PROFESSIONAL: { label: "Veterinário clínico", description: "Pacientes, prontuários e abertura de Ordens de Serviço." },
  LAB: { label: "Laboratório / preparo", description: "Fila de Ordens de Serviço, preparo das células e prontuário CT." },
  PROFESSIONAL_LAB: { label: "Veterinário clínico + Laboratório", description: "Atende e também prepara as células." },
  STOCK: { label: "Logística (estoque)", description: "Abastece o estoque das unidades e acompanha as movimentações." },
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

// Perfis da matriz que enxergam todas as unidades (os demais só as suas)
export function seesAllUnits(role: string) {
  return role === "ADMIN" || role === "ADMINISTRATIVE" || role === "COMMERCIAL" || role === "STOCK";
}

export function canManageUsers(role: string) {
  return role === "ADMIN" || role === "ADMINISTRATIVE" || role === "UNIT_MANAGER";
}

// Abrir e editar UABCs
export function canManageUnits(role: string) {
  return role === "ADMIN" || role === "ADMINISTRATIVE";
}

// Abastecer o estoque das unidades
export function canSupplyStock(role: string) {
  return role === "ADMIN" || role === "STOCK";
}

// Perfis com telas limitadas: só podem abrir estas páginas e só alterar por estas APIs
// (os demais seguem as regras de cada tela)
const ROLE_PAGES: Partial<Record<Role, string[]>> = {
  COMMERCIAL: ["/dashboard", "/relatorios", "/conta"],
  ADMINISTRATIVE: ["/dashboard", "/unidades", "/usuarios", "/conta"],
};
const ROLE_WRITE_APIS: Partial<Record<Role, string[]>> = {
  COMMERCIAL: ["/api/auth", "/api/account"],
  ADMINISTRATIVE: ["/api/auth", "/api/account", "/api/units", "/api/users"],
};
const under = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + "/"));

// Telas de entrada/conta, liberadas para todos
const OPEN_PAGES = ["/", "/login", "/trocar-senha", "/conta"];

export function canOpenPage(role: string, path: string) {
  const pages = isRole(role) ? ROLE_PAGES[role] : undefined;
  return !pages || OPEN_PAGES.includes(path) || under(path, pages);
}

export function homePage(role: string) {
  return (isRole(role) && ROLE_PAGES[role]?.[0]) || "/dashboard";
}

export function canWriteApi(role: string, path: string) {
  const apis = isRole(role) ? ROLE_WRITE_APIS[role] : undefined;
  return !apis || under(path, apis);
}

// Gestor não cria acesso de matriz nem de estoque central; administrativo cria todos menos a matriz
export function assignableRoles(role: string): Role[] {
  if (role === "ADMIN") return Object.keys(ROLES) as Role[];
  if (role === "ADMINISTRATIVE") return (Object.keys(ROLES) as Role[]).filter((r) => r !== "ADMIN");
  if (role === "UNIT_MANAGER") return ["UNIT_MANAGER", "PROFESSIONAL", "LAB", "PROFESSIONAL_LAB"];
  return [];
}

export function roleLabel(role: string) {
  return isRole(role) ? ROLES[role].label : role;
}
