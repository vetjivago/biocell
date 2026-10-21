import type { Prisma } from "@prisma/client";

// Nº de série do prontuário CT: sequencial por ano, "001/26", "002/26"... (recomeça a cada ano)
export function formatRecordSerial(seq: number, year: number) {
  return `${String(seq).padStart(3, "0")}/${String(year % 100).padStart(2, "0")}`;
}

export async function nextRecordSerial(tx: Prisma.TransactionClient, date = new Date()) {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const rows = await tx.medicalRecord.findMany({
    where: { serialNumber: { endsWith: `/${yy}` } },
    select: { serialNumber: true },
  });
  const max = rows.reduce((m, r) => {
    const match = /^(\d+)\/\d{2}$/.exec(r.serialNumber);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return formatRecordSerial(max + 1, date.getFullYear());
}
