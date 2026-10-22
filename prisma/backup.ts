// Backup completo (só leitura): todas as tabelas em JSON + todos os anexos como arquivos
// Saída: Hilana/backups/completo-<data>/
//   tabelas/<Modelo>.json        (campos binários ficam de fora: os arquivos vão para anexos/)
//   anexos/prontuario-geral/<paciente>/<data> <tipo> - <arquivo>
//   anexos/ordens-servico/<nº de série>/<arquivo>
//   anexos/fotos-pacientes/<paciente>.<ext>
//   resumo.json                  (quantidade de registros e de anexos)
// Uso: npx tsx prisma/backup.ts
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const PAGE = 500;

const safe = (s: string) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "sem-nome";
const day = (d: Date) => d.toISOString().slice(0, 10);

// Não sobrescreve arquivos com o mesmo nome dentro da pasta
function uniquePath(dir: string, name: string) {
  let path = join(dir, name);
  for (let i = 2; existsSync(path); i++) {
    const dot = name.lastIndexOf(".");
    path = join(dir, dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`);
  }
  return path;
}

async function main() {
  const root = join(__dirname, "..", "..", "backups", `completo-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const tablesDir = join(root, "tabelas");
  mkdirSync(tablesDir, { recursive: true });
  const summary: Record<string, number> = {};

  // 1. Tabelas: lidas em páginas pelo id, sem os campos binários
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = (prisma as unknown as Record<string, { findMany: (a: object) => Promise<Record<string, string>[]> }>)[
      model.name[0].toLowerCase() + model.name.slice(1)
    ];
    const key = model.fields.find((f) => f.isId)?.name;
    if (!key) throw new Error(`${model.name} sem chave primária simples`);
    const select = Object.fromEntries(model.fields.filter((f) => f.kind === "scalar" && f.type !== "Bytes").map((f) => [f.name, true]));
    const rows: object[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await delegate.findMany({ select, orderBy: { [key]: "asc" }, take: PAGE, ...(cursor ? { cursor: { [key]: cursor }, skip: 1 } : {}) });
      rows.push(...page);
      if (page.length < PAGE) break;
      cursor = page[page.length - 1][key];
    }
    writeFileSync(join(tablesDir, `${model.name}.json`), JSON.stringify(rows, null, 2));
    summary[model.name] = rows.length;
    console.log(`${model.name}: ${rows.length}`);
  }

  // 2. Anexos do prontuário geral (exames, C1, C15...), um por vez para não pesar na memória
  const clinical = await prisma.clinicalAttachment.findMany({
    select: { id: true, fileName: true, entry: { select: { type: true, subtype: true, title: true, occurredAt: true, patient: { select: { name: true, ownerName: true, id: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  for (const a of clinical) {
    const file = await prisma.clinicalAttachment.findUnique({ where: { id: a.id }, select: { data: true } });
    const p = a.entry.patient;
    const dir = join(root, "anexos", "prontuario-geral", safe(`${p.name} - ${p.ownerName} (${p.id.slice(-6)})`));
    mkdirSync(dir, { recursive: true });
    const label = [day(a.entry.occurredAt), a.entry.subtype || a.entry.type, a.entry.title].filter(Boolean).join(" ");
    writeFileSync(uniquePath(dir, safe(`${label} - ${a.fileName}`)), file!.data);
  }
  summary["anexos do prontuário geral"] = clinical.length;
  console.log(`Anexos do prontuário geral: ${clinical.length}`);

  // 3. Anexos das ordens de serviço (termos)
  const orders = await prisma.serviceOrderAttachment.findMany({
    select: { id: true, fileName: true, checklistKey: true, serviceOrder: { select: { serialNumber: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const a of orders) {
    const file = await prisma.serviceOrderAttachment.findUnique({ where: { id: a.id }, select: { data: true } });
    const dir = join(root, "anexos", "ordens-servico", safe(a.serviceOrder.serialNumber));
    mkdirSync(dir, { recursive: true });
    writeFileSync(uniquePath(dir, safe(`${a.checklistKey ? `${a.checklistKey} - ` : ""}${a.fileName}`)), file!.data);
  }
  summary["anexos das ordens de serviço"] = orders.length;
  console.log(`Anexos das ordens de serviço: ${orders.length}`);

  // 4. Fotos dos pacientes
  const photos = await prisma.patientPhoto.findMany({ select: { patientId: true, mimeType: true, patient: { select: { name: true, ownerName: true } } } });
  const photoDir = join(root, "anexos", "fotos-pacientes");
  if (photos.length) mkdirSync(photoDir, { recursive: true });
  for (const ph of photos) {
    const file = await prisma.patientPhoto.findUnique({ where: { patientId: ph.patientId }, select: { data: true } });
    const ext = ph.mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    writeFileSync(uniquePath(photoDir, safe(`${ph.patient.name} - ${ph.patient.ownerName} (${ph.patientId.slice(-6)})`) + `.${ext}`), file!.data);
  }
  summary["fotos dos pacientes"] = photos.length;
  console.log(`Fotos dos pacientes: ${photos.length}`);

  writeFileSync(join(root, "resumo.json"), JSON.stringify({ geradoEm: new Date().toISOString(), ...summary }, null, 2));
  console.log(`Backup salvo em ${root}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
