import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

export * from "./clinical-types";

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
