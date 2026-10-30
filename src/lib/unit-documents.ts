import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { canManageUnits, canViewUnitDetails } from "@/lib/roles";
import { DOCUMENT_VISIBILITY, type DocumentVisibility } from "@/lib/units";

export { ALLOWED_MIME, MAX_ATTACHMENT_BYTES } from "@/lib/clinical-types";

type Access = { canEdit: boolean } | { error: string; status: number };

// Ficha da unidade: matriz e administrativo editam, o comercial só consulta
export async function unitAccess(session: SessionUser, unitId: string, write: boolean): Promise<Access> {
  const canEdit = canManageUnits(session.role);
  if (write ? !canEdit : !canViewUnitDetails(session.role)) return { error: "Sem permissão", status: 403 };
  const unit = await prisma.unit.findFirst({ where: { id: unitId, organizationId: session.organizationId }, select: { id: true } });
  if (!unit) return { error: "Unidade não encontrada", status: 404 };
  return { canEdit };
}

// Documento restrito só aparece para quem edita a ficha
export function canSeeDocument(canEdit: boolean, visibility: string) {
  return canEdit || visibility !== "RESTRICTED";
}

export function parseVisibility(v: unknown): DocumentVisibility | null {
  return typeof v === "string" && v in DOCUMENT_VISIBILITY ? (v as DocumentVisibility) : null;
}

// "2026-12-31" → Date (meio-dia UTC, para não mudar de dia no fuso); "" → null; inválida → undefined
export function parseDueDate(v: unknown): Date | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Texto curto do formulário (nome do documento)
export function docName(v: unknown) {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 120) : "";
}

export function docNotes(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : null;
}
