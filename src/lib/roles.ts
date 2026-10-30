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

// Uma pessoa pode ter várias funções: ficam na mesma coluna, separadas por vírgula
// (ex.: "UNIT_MANAGER,PROFESSIONAL"), e as permissões se somam.
// O antigo "PROFESSIONAL_LAB" vale como clínico + laboratório.
export function parseRoles(role: string | null | undefined): Role[] {
  const list = (role ?? "").split(",").map((r) => r.trim()).flatMap((r): Role[] => (r === "PROFESSIONAL_LAB" ? ["PROFESSIONAL", "LAB"] : isRole(r) ? [r] : []));
  return (Object.keys(ROLES) as Role[]).filter((r) => list.includes(r));
}

export function normalizeRoles(roles: Role[]) {
  return parseRoles(roles.join(","));
}

export function serializeRoles(roles: Role[]) {
  return normalizeRoles(roles).join(",");
}

// Funções vindas do formulário/API (lista ou texto separado por vírgula); null se tiver alguma inválida
export function parseRoleInput(v: unknown): Role[] | null {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : null;
  if (!raw || raw.some((r) => typeof r !== "string" || !isRole(r.trim()))) return null;
  const roles = normalizeRoles(raw.map((r: string) => r.trim() as Role));
  return roles.length ? roles : null;
}

export function hasRole(role: string, ...any: Role[]) {
  return parseRoles(role).some((r) => any.includes(r));
}

// Quem atende ou prepara (acesso a pacientes, prontuários e OS)
export const CLINICAL_ROLES: Role[] = ["ADMIN", "UNIT_MANAGER", "PROFESSIONAL", "LAB", "PROFESSIONAL_LAB"];

// Perfis da matriz que enxergam todas as unidades (os demais só as suas)
const ALL_UNITS_ROLES: Role[] = ["ADMIN", "ADMINISTRATIVE", "COMMERCIAL", "STOCK"];

export function seesAllUnits(role: string) {
  return hasRole(role, ...ALL_UNITS_ROLES);
}

// Precisa de unidade vinculada quem tem alguma função de unidade (gestor, clínico, laboratório),
// mesmo que também tenha uma função da matriz — exceto a própria matriz, que já acessa tudo
export function needsUnits(role: string) {
  const roles = parseRoles(role);
  return roles.length > 0 && !roles.includes("ADMIN") && roles.some((r) => !ALL_UNITS_ROLES.includes(r));
}

export function canManageUsers(role: string) {
  return hasRole(role, "ADMIN", "ADMINISTRATIVE", "UNIT_MANAGER");
}

// Abrir e editar UABCs
export function canManageUnits(role: string) {
  return hasRole(role, "ADMIN", "ADMINISTRATIVE");
}

// Ficha da unidade (dados cadastrais e documentos): o comercial só consulta
export function canViewUnitDetails(role: string) {
  return hasRole(role, "ADMIN", "ADMINISTRATIVE", "COMMERCIAL");
}

// Abastecer o estoque das unidades
export function canSupplyStock(role: string) {
  return hasRole(role, "ADMIN", "STOCK");
}

// Perfis com telas limitadas: só podem abrir estas páginas e só alterar por estas APIs
// (os demais seguem as regras de cada tela)
const ROLE_PAGES: Partial<Record<Role, string[]>> = {
  COMMERCIAL: ["/dashboard", "/relatorios", "/unidades", "/conta"],
  ADMINISTRATIVE: ["/dashboard", "/unidades", "/usuarios", "/conta"],
};
const ROLE_WRITE_APIS: Partial<Record<Role, string[]>> = {
  COMMERCIAL: ["/api/auth", "/api/account"],
  ADMINISTRATIVE: ["/api/auth", "/api/account", "/api/units", "/api/users"],
};
const under = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(p + "/"));

// Telas de entrada/conta, liberadas para todos
const OPEN_PAGES = ["/", "/login", "/trocar-senha", "/conta"];

// Com várias funções vale a soma: basta uma função sem limite para liberar tudo
function allowed(role: string, map: Partial<Record<Role, string[]>>): string[] | null {
  const roles = parseRoles(role);
  if (!roles.length || roles.some((r) => !map[r])) return null;
  return roles.flatMap((r) => map[r]!);
}

export function canOpenPage(role: string, path: string) {
  const pages = allowed(role, ROLE_PAGES);
  return !pages || OPEN_PAGES.includes(path) || under(path, pages);
}

export function homePage(role: string) {
  return allowed(role, ROLE_PAGES)?.[0] || "/dashboard";
}

export function canWriteApi(role: string, path: string) {
  const apis = allowed(role, ROLE_WRITE_APIS);
  return !apis || under(path, apis);
}

// Gestor não cria acesso de matriz nem de estoque central; administrativo cria todos menos a matriz
// (o antigo "PROFESSIONAL_LAB" não aparece mais: marca-se clínico e laboratório)
export function assignableRoles(role: string): Role[] {
  const all = (Object.keys(ROLES) as Role[]).filter((r) => r !== "PROFESSIONAL_LAB");
  if (hasRole(role, "ADMIN")) return all;
  if (hasRole(role, "ADMINISTRATIVE")) return all.filter((r) => r !== "ADMIN");
  if (hasRole(role, "UNIT_MANAGER")) return ["UNIT_MANAGER", "PROFESSIONAL", "LAB"];
  return [];
}

export function roleLabel(role: string) {
  const roles = parseRoles(role);
  return roles.length ? roles.map((r) => ROLES[r].label).join(" + ") : role;
}
