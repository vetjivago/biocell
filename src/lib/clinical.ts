import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

export * from "./clinical-types";
import { CONTENT_OPTIONAL, isHttpUrl, type EntryType } from "./clinical-types";

// Paciente acessível pelo usuário e com prontuário geral habilitado na unidade
export async function getGeneralRecordPatient(session: SessionUser, patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { unit: { select: { id: true, name: true, generalRecordEnabled: true } } },
  });
  if (!patient) return { error: "Paciente não encontrado", status: 404 } as const;
  if (session.role !== "ADMIN" && !session.unitIds.includes(patient.unitId)) {
    return { error: "Sem permissão", status: 403 } as const;
  }
  if (!patient.unit.generalRecordEnabled) {
    return { error: "Prontuário geral não habilitado para esta unidade", status: 403 } as const;
  }
  return { patient } as const;
}

// Autor do registro, gestor da unidade ou matriz podem editar
export function canEditEntry(session: SessionUser, entry: { authorId: string }) {
  return entry.authorId === session.id || session.role === "ADMIN" || session.role === "UNIT_MANAGER";
}

type EntryFields = {
  title?: string | null;
  content?: string;
  weight?: number | null;
  subtype?: string | null;
  returnDate?: Date | null;
  endedAt?: Date | null;
  videoUrl?: string | null;
  occurredAt?: Date;
};

// Valida e normaliza os campos de um registro. Em edição (partial) só considera o que veio no corpo.
export function parseEntryFields(
  type: EntryType,
  body: Record<string, unknown>,
  { partial = false, current }: { partial?: boolean; current?: EntryFields } = {}
): { data: EntryFields } | { error: string } {
  const data: EntryFields = {};
  const has = (k: string) => !partial || body[k] !== undefined;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null;
  const date = (v: unknown): Date | null | "invalid" => {
    if (v === null || v === undefined || v === "") return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "invalid" : d;
  };

  if (has("title")) data.title = text(body.title, 200);
  if (has("content")) data.content = typeof body.content === "string" ? body.content.slice(0, 50_000) : "";
  if (has("subtype")) data.subtype = type === "ATENDIMENTO" ? text(body.subtype, 100) : null;
  if (has("videoUrl")) {
    const url = type === "VIDEO" ? text(body.videoUrl, 500) : null;
    if (url && !isHttpUrl(url)) return { error: "Link do vídeo inválido (use um endereço http/https)" };
    data.videoUrl = url;
  }
  if (has("weight")) {
    if (type === "PESO") {
      const w = Number(String(body.weight ?? "").replace(",", "."));
      if (!Number.isFinite(w) || w <= 0 || w > 2000) return { error: "Informe o peso em kg" };
      data.weight = w;
    } else data.weight = null;
  }
  for (const k of ["returnDate", "endedAt", "occurredAt"] as const) {
    if (!has(k)) continue;
    const d = date(body[k]);
    if (d === "invalid") return { error: "Data inválida" };
    if (k === "occurredAt") data.occurredAt = d ?? new Date();
    else if (k === "returnDate") data.returnDate = d;
    else data.endedAt = type === "INTERNACAO" ? d : null;
  }

  // Regras por tipo, olhando o resultado final (valores novos ou os atuais em edição)
  const final = { ...current, ...data };
  if (type === "PATOLOGIA" && !final.title) return { error: "Informe a patologia" };
  if (type === "INTERNACAO" && final.endedAt && final.occurredAt && final.endedAt < final.occurredAt) {
    return { error: "A alta não pode ser antes da entrada" };
  }
  if (!CONTENT_OPTIONAL.includes(type) && !final.content?.trim() && !final.title && !final.subtype) {
    return { error: "Preencha o resumo ou o texto do registro" };
  }
  return { data };
}
