import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Resolve all existing LOW_STOCK alerts (stock is at 117, not low)
  const resolved = await prisma.alert.updateMany({
    where: { type: "LOW_STOCK", resolved: false },
    data: { resolved: true },
  });
  console.log(`Alertas resolvidos: ${resolved.count}`);

  // 2. Set threshold to 15 for UABC Águas Claras
  const threshold = await prisma.stockThreshold.upsert({
    where: { unitId_productName: { unitId: "unit_03", productName: "geral" } },
    update: { minimumStraws: 15 },
    create: { unitId: "unit_03", productName: "geral", minimumStraws: 15 },
  });
  console.log(`Threshold configurado: ${threshold.productName} = ${threshold.minimumStraws} palhetas`);

  // 3. Remove any old thresholds that might have different values
  const deleted = await prisma.stockThreshold.deleteMany({
    where: { unitId: "unit_03", NOT: { productName: "geral" } },
  });
  if (deleted.count > 0) console.log(`Thresholds antigos removidos: ${deleted.count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
