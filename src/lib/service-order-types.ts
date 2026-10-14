// Constantes da Ordem de Serviço (sem dependências de servidor: usadas também no navegador)

// Termos exigidos na 1ª aplicação: "solicitar" é marcado manualmente, "anexar" quando o documento é enviado
export const CHECKLIST_TERMS = [
  { key: "TERMO_COMPROMISSO", label: "Termo de Compromisso do Médico Veterinário" },
  { key: "TERMO_ADESAO", label: "Termo de Adesão do Médico Veterinário" },
  { key: "TCLE", label: "Termo de Consentimento Livre/Esclarecido Terapia com CT Mesenquimais" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_TERMS)[number]["key"];

export const APP_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aguardando preparo", cls: "bg-blue-100 text-blue-700" },
  IN_PREP: { label: "Em preparo", cls: "bg-yellow-100 text-yellow-800" },
  DONE: { label: "Prontuário preenchido", cls: "bg-green-100 text-green-700" },
};

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Aberta", cls: "bg-blue-100 text-blue-700" },
  IN_PREP: { label: "Em preparo", cls: "bg-yellow-100 text-yellow-800" },
  DONE: { label: "Concluída", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelada", cls: "bg-gray-100 text-gray-600" },
};

// Status da OS a partir das aplicações: alguma pendente => aberta/em preparo; todas feitas => concluída
export function orderStatus(order: { cancelled: boolean; applications: { status: string }[] }) {
  if (order.cancelled) return "CANCELLED";
  if (order.applications.some((a) => a.status === "IN_PREP")) return "IN_PREP";
  if (order.applications.some((a) => a.status === "OPEN")) return "OPEN";
  return "DONE";
}

export function parseChecklist(raw: string): Partial<Record<ChecklistKey, boolean>> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// Nº de série no formato usado pela BIO CELL: 02.078.26 (prefixo.sequência.ano)
export function nextSerial(lastSerials: string[], now = new Date()) {
  const yy = String(now.getFullYear()).slice(-2);
  let prefix = "02";
  let maxSeq = 0;
  for (const s of lastSerials) {
    const m = s.match(/^(\d{2})\.(\d{3})\.(\d{2})$/);
    if (!m || m[3] !== yy) continue;
    prefix = m[1];
    maxSeq = Math.max(maxSeq, Number(m[2]));
  }
  return `${prefix}.${String(maxSeq + 1).padStart(3, "0")}.${yy}`;
}

// Sugestões de via de aplicação (pode digitar outra)
export const ROUTE_OPTIONS = ["Intravenosa (IV)", "Intra-articular", "Subcutânea", "Intramuscular", "Intralesional", "Intratecal", "Tópica / colírio"];
