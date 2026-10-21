import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

export * from "./service-order-types";

// Unidades do usuário que usam ordem de serviço (para menu e permissões)
export async function serviceOrderUnitIds(session: SessionUser) {
  const units = await prisma.unit.findMany({
    where: { serviceOrderEnabled: true, ...(session.role === "ADMIN" ? {} : { id: { in: session.unitIds } }) },
    select: { id: true },
  });
  return units.map((u) => u.id);
}

export async function getAccessibleOrder(session: SessionUser, orderId: string) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: { unit: { select: { serviceOrderEnabled: true } } },
  });
  if (!order) return { error: "Ordem de serviço não encontrada", status: 404 } as const;
  if (session.role !== "ADMIN" && !session.unitIds.includes(order.unitId)) {
    return { error: "Sem permissão", status: 403 } as const;
  }
  if (!order.unit.serviceOrderEnabled) return { error: "Ordem de serviço não habilitada para esta unidade", status: 403 } as const;
  return { order } as const;
}

// Texto opcional: string aparada ou null
export function optText(v: unknown, max = 2000) {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
}

export function optDate(v: unknown): Date | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// Quem pode apagar uma OS ainda sem prontuário: quem abriu, o gestor da unidade ou a matriz
export function canDeleteOrder(session: SessionUser, order: { createdById: string }) {
  return order.createdById === session.id || session.role === "ADMIN" || session.role === "UNIT_MANAGER";
}
