// Zera os dados operacionais da UABC Águas Claras para início do uso real.
// Mantém: a unidade, os usuários vinculados e o limite mínimo de estoque.
// Apaga: pacientes, prontuários (aplicações, descongelamentos, procedimentos, follow-ups),
//        movimentações de estoque (entradas e baixas) e alertas.
// Uso: npx tsx prisma/reset-aguas-claras.ts            (só backup + contagem)
//      npx tsx prisma/reset-aguas-claras.ts --confirm  (backup + apaga)
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const unitId = "unit_03";

async function main() {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || !unit.name.toUpperCase().includes("CLARAS")) throw new Error(`Unidade ${unitId} não é Águas Claras`);

  const records = await prisma.medicalRecord.findMany({
    where: { unitId },
    include: { applications: true, thawings: true, procedures: true },
  });
  const recordIds = records.map((r) => r.id);
  const backup = {
    exportedAt: new Date().toISOString(),
    unit,
    patients: await prisma.patient.findMany({ where: { unitId } }),
    medicalRecords: records,
    followUpContacts: await prisma.followUpContact.findMany({ where: { medicalRecordId: { in: recordIds } } }),
    inventoryTransactions: await prisma.inventoryTransaction.findMany({ where: { unitId } }),
    alerts: await prisma.alert.findMany({ where: { unitId } }),
  };

  const dir = join(__dirname, "..", "..", "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `aguas-claras-${backup.exportedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Backup salvo em ${file}`);
  console.log({
    patients: backup.patients.length,
    records: records.length,
    inventoryTransactions: backup.inventoryTransactions.length,
    alerts: backup.alerts.length,
  });

  if (!process.argv.includes("--confirm")) {
    console.log("Nada apagado (rode com --confirm para apagar).");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.thawing.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.procedure.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.followUpContact.deleteMany({ where: { medicalRecordId: { in: recordIds } } });
    await tx.inventoryTransaction.deleteMany({ where: { unitId } });
    await tx.medicalRecord.deleteMany({ where: { unitId } });
    await tx.patient.deleteMany({ where: { unitId } });
    await tx.alert.deleteMany({ where: { unitId } });
  });

  const left = {
    patients: await prisma.patient.count({ where: { unitId } }),
    records: await prisma.medicalRecord.count({ where: { unitId } }),
    inventoryTransactions: await prisma.inventoryTransaction.count({ where: { unitId } }),
    alerts: await prisma.alert.count({ where: { unitId } }),
  };
  console.log("Após limpeza:", left);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
