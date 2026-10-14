// Padroniza espécies como Canino / Felino / Equino (pacientes, produtos celulares e unidades)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function normalize(text: string | null | undefined): string | null {
  const t = (text || "").toLowerCase();
  if (/c[aã]o|canin/.test(t)) return "Canino";
  if (/gato|felin/.test(t)) return "Felino";
  if (/equin|caval/.test(t)) return "Equino";
  return null;
}

async function main() {
  for (const p of await prisma.patient.findMany({ select: { id: true, name: true, species: true } })) {
    const s = normalize(p.species);
    if (s && s !== p.species) {
      await prisma.patient.update({ where: { id: p.id }, data: { species: s } });
      console.log(`Paciente ${p.name}: ${p.species} -> ${s}`);
    }
  }
  for (const p of await prisma.cellProduct.findMany({ select: { id: true, name: true, species: true, category: true } })) {
    const s = normalize(p.species) || (p.category === "CELULAS" ? normalize(p.name) : null);
    if (s && s !== p.species) {
      await prisma.cellProduct.update({ where: { id: p.id }, data: { species: s } });
      console.log(`Produto ${p.name}: ${p.species} -> ${s}`);
    }
  }
  for (const u of await prisma.unit.findMany({ select: { id: true, name: true, species: true } })) {
    const s = u.species.split(",").map((x) => normalize(x) || x.trim()).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    if (s !== u.species) {
      await prisma.unit.update({ where: { id: u.id }, data: { species: s } });
    }
  }
  console.log("Unidades:", [...new Set((await prisma.unit.findMany({ select: { species: true } })).map((u) => u.species))]);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
