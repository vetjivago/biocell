// Constantes do prontuário geral (sem dependências de servidor: usadas também no navegador)

// Tipos de registro do prontuário geral (linha do tempo do paciente) — mesmos do SimplesVet + Anamnese
export const ENTRY_TYPES = {
  ATENDIMENTO: { label: "Atendimento", color: "#2f8fdc" },
  ANAMNESE: { label: "Anamnese / Histórico", color: "#0d9488" },
  PESO: { label: "Peso", color: "#b5832a" },
  PATOLOGIA: { label: "Patologia", color: "#5b2468" },
  DOCUMENTO: { label: "Documento", color: "#2ea44f" },
  EXAME: { label: "Exame", color: "#e5484d" },
  FOTOS: { label: "Fotos", color: "#1f5f8b" },
  VACINA: { label: "Vacina", color: "#e9a12c" },
  RECEITA: { label: "Receita", color: "#8e44ad" },
  OBSERVACAO: { label: "Observações", color: "#4b5563" },
  VIDEO: { label: "Vídeo", color: "#1a6b2c" },
  INTERNACAO: { label: "Internação", color: "#a3313a" },
} as const;

export type EntryType = keyof typeof ENTRY_TYPES;

export function isEntryType(value: unknown): value is EntryType {
  return typeof value === "string" && value in ENTRY_TYPES;
}

// Sugestões para "Tipo do atendimento" (pode digitar outro)
export const ATTENDANCE_SUBTYPES = [
  "Consulta",
  "Retorno",
  "Aplicação CT",
  "Ordem de Serviço - Halógena",
  "Prontuário CT",
  "C1",
  "C15",
  "Avaliação pré-tratamento",
  "Emergência",
  "Telemedicina",
];

// Roteiros sugeridos para começar o texto (o veterinário pode apagar/editar livremente)
export const ENTRY_TEMPLATES: Partial<Record<EntryType, string>> = {
  ATENDIMENTO: "Queixa principal:\n\nAnamnese:\n\nExame físico:\n\nAchados:\n\nSuspeita / Diagnóstico:\n\nConduta:\n",
  ANAMNESE: "Histórico clínico:\n\nDoenças anteriores:\n\nMedicações em uso:\n\nAlimentação:\n\nVacinação / Vermifugação:\n",
  EXAME: "Exame solicitado:\n\nResultado / Observações:\n",
  INTERNACAO: "Motivo da internação:\n\nEvolução:\n\nMedicações:\n\nAlta / Orientações:\n",
};

// Rótulo do campo "Resumo" conforme o tipo
export const TITLE_LABEL: Partial<Record<EntryType, string>> = {
  PATOLOGIA: "Patologia *",
  VACINA: "Vacina aplicada",
  EXAME: "Exame",
  DOCUMENTO: "Documento",
};

// Tipos em que o texto é opcional (o conteúdo principal é outro campo ou anexo)
export const CONTENT_OPTIONAL: EntryType[] = ["PESO", "FOTOS", "VIDEO", "DOCUMENTO", "PATOLOGIA"];

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // limite do corpo da requisição na Vercel (~4,5 MB)
export const ALLOWED_MIME = /^(image\/|video\/(mp4|webm|quicktime)$|application\/pdf$|text\/plain$|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel)$)/;

export function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
