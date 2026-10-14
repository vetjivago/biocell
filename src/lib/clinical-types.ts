// Constantes do prontuário geral (sem dependências de servidor: usadas também no navegador)
// Tipos de registro do prontuário geral (linha do tempo do paciente)
export const ENTRY_TYPES = {
  ATENDIMENTO: { label: "Atendimento", color: "#2563eb" },
  ANAMNESE: { label: "Anamnese / Histórico", color: "#0d9488" },
  EXAME: { label: "Exame", color: "#dc2626" },
  PESO: { label: "Peso", color: "#b45309" },
  RECEITA: { label: "Receita", color: "#7c3aed" },
  VACINA: { label: "Vacina", color: "#ea580c" },
  OBSERVACAO: { label: "Observações", color: "#4b5563" },
  DOCUMENTO: { label: "Documento", color: "#16a34a" },
} as const;

export type EntryType = keyof typeof ENTRY_TYPES;

export function isEntryType(value: unknown): value is EntryType {
  return typeof value === "string" && value in ENTRY_TYPES;
}

// Roteiros sugeridos para começar o texto (o veterinário pode apagar/editar livremente)
export const ENTRY_TEMPLATES: Partial<Record<EntryType, string>> = {
  ATENDIMENTO: "Queixa principal:\n\nAnamnese:\n\nExame físico:\n\nAchados:\n\nSuspeita / Diagnóstico:\n\nConduta:\n",
  ANAMNESE: "Histórico clínico:\n\nDoenças anteriores:\n\nMedicações em uso:\n\nAlimentação:\n\nVacinação / Vermifugação:\n",
  EXAME: "Exame solicitado:\n\nResultado / Observações:\n",
};

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // limite do corpo da requisição na Vercel (~4,5 MB)
export const ALLOWED_MIME = /^(image\/|application\/pdf$|text\/plain$|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel)$)/;
