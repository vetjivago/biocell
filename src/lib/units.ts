import { SPECIES } from "@/lib/species";

// Sem dependências de servidor: usado também no navegador (máscaras e validação do formulário)

// Estados do cadastro de unidades ("EXT" = unidade fora do Brasil)
export const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO", "EXT",
] as const;

// Categoria jurídica (porte da empresa, como no cartão CNPJ da Receita)
export const LEGAL_CATEGORIES = [
  "MEI", "Microempresa (ME)", "Empresa de Pequeno Porte (EPP)", "Demais (médio/grande porte)",
  "Órgão público", "Entidade sem fins lucrativos",
] as const;

// Documentos que toda unidade tem (criados junto com ela); os demais são "OTHER"
export const DEFAULT_DOCUMENTS = [
  { kind: "CNPJ_CARD", name: "Cartão CNPJ" },
  { kind: "SOCIAL_CONTRACT", name: "Contrato Social" },
  { kind: "UABC_CONTRACT", name: "Contrato UABC" },
] as const;

// Quem vê cada documento: todos que abrem a ficha da unidade, ou só matriz e administrativo
export const DOCUMENT_VISIBILITY = {
  PUBLIC: "Público",
  RESTRICTED: "Restrito à matriz",
} as const;
export type DocumentVisibility = keyof typeof DOCUMENT_VISIBILITY;

export const onlyDigits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

// 25648387000118 → 25.648.387/0001-18 (formata o que já foi digitado)
export function formatCnpj(v: string | null | undefined) {
  const d = onlyDigits(v ?? "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Dígitos verificadores do CNPJ
export function isValidCnpj(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * ((len - i - 1) % 8 + 2);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(d[12]) && check(13) === Number(d[13]);
}

// 38405240 → 38.405-240
export function formatCep(v: string | null | undefined) {
  const d = onlyDigits(v ?? "").slice(0, 8);
  return d.replace(/^(\d{2})(\d{3})(\d)/, "$1.$2-$3").replace(/^(\d{2})(\d{1,3})$/, "$1.$2");
}

// Telefone com DDD enquanto digita: (34) 3333-4444 / (34) 99999-8888
export function formatPhoneInput(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// "1.234.567,89" ou "1234567.89" → "1234567.89" (null se vazio, NaN se inválido)
export function parseMoney(v: unknown): string | null | typeof NaN {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v.toFixed(2) : NaN;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.replace(/[R$\s]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 && n < 1e13 ? n.toFixed(2) : NaN;
}

// Endereço em uma linha (usado nas impressões de OS e orçamento)
export function composeAddress(a: { street?: string | null; number?: string | null; complement?: string | null; district?: string | null; zipCode?: string | null }) {
  const first = [a.street, a.number].filter(Boolean).join(", ");
  const line = [first, a.complement, a.district].filter(Boolean).join(" - ");
  return [line, a.zipCode ? `CEP ${formatCep(a.zipCode)}` : ""].filter(Boolean).join(" · ") || null;
}

export interface UnitInput {
  name: string;
  city: string;
  state: string;
  address: string | null;
  phone: string | null;
  species: string;
  generalRecordEnabled: boolean;
  serviceOrderEnabled: boolean;
  cnpj: string | null;
  legalName: string | null;
  tradeName: string | null;
  legalNature: string | null;
  legalCategory: string | null;
  stateRegistration: string | null;
  shareCapital: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  phones: string[];
  mobiles: string[];
  emails: string[];
  billingEmails: string[];
  financeEmails: string[];
}

function text(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// Lista de textos, sem vazios nem repetidos
function list(v: unknown, max: number, map: (s: string) => string = (s) => s) {
  const raw = Array.isArray(v) ? v : [];
  return [...new Set(raw.map((x) => map(text(x, max))).filter(Boolean))].slice(0, 10);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valida o corpo enviado pela tela de unidade (criação e edição)
export function parseUnitInput(body: Record<string, unknown>): UnitInput | { error: string } {
  const name = text(body.name, 120).toUpperCase();
  const city = text(body.city, 80);
  const state = text(body.state, 3).toUpperCase();
  const species = Array.isArray(body.species) ? SPECIES.filter((s) => (body.species as unknown[]).includes(s)) : [];

  if (!name) return { error: "Informe o nome da unidade" };
  if (!city) return { error: "Informe a cidade" };
  if (!(STATES as readonly string[]).includes(state)) return { error: "Estado inválido" };
  if (species.length === 0) return { error: "Escolha ao menos uma espécie atendida" };

  const cnpj = onlyDigits(body.cnpj);
  if (cnpj && !isValidCnpj(cnpj)) return { error: "CNPJ inválido (confira os dígitos)" };
  const zipCode = onlyDigits(body.zipCode);
  if (zipCode && zipCode.length !== 8) return { error: "CEP inválido (8 dígitos)" };
  const legalCategory = text(body.legalCategory, 60);
  if (legalCategory && !(LEGAL_CATEGORIES as readonly string[]).includes(legalCategory)) return { error: "Categoria jurídica inválida" };
  const shareCapital = parseMoney(body.shareCapital);
  if (Number.isNaN(shareCapital)) return { error: "Capital social inválido" };

  const phones = list(body.phones, 40, formatPhoneInput);
  const mobiles = list(body.mobiles, 40, formatPhoneInput);
  const lower = (s: string) => s.toLowerCase();
  const emails = list(body.emails, 120, lower);
  const billingEmails = list(body.billingEmails, 120, lower);
  const financeEmails = list(body.financeEmails, 120, lower);
  const badEmail = [...emails, ...billingEmails, ...financeEmails].find((e) => !EMAIL.test(e));
  if (badEmail) return { error: `E-mail inválido: ${badEmail}` };

  const address = {
    zipCode: zipCode || null,
    street: text(body.street, 150) || null,
    number: text(body.number, 20) || null,
    complement: text(body.complement, 80) || null,
    district: text(body.district, 80) || null,
  };

  return {
    name, city, state,
    // Sem os campos novos preenchidos, mantém o endereço antigo (texto livre)
    address: composeAddress(address) ?? (text(body.address, 250) || null),
    phone: phones[0] ?? mobiles[0] ?? null,
    species: species.join(", "),
    generalRecordEnabled: body.generalRecordEnabled === true,
    serviceOrderEnabled: body.serviceOrderEnabled === true,
    cnpj: cnpj || null,
    legalName: text(body.legalName, 200) || null,
    tradeName: text(body.tradeName, 200) || null,
    legalNature: text(body.legalNature, 120) || null,
    legalCategory: legalCategory || null,
    stateRegistration: text(body.stateRegistration, 30) || null,
    shareCapital: shareCapital as string | null,
    ...address,
    phones, mobiles, emails, billingEmails, financeEmails,
  };
}
