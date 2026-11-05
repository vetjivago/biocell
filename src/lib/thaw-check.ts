// Confere o descongelamento com os itens da aplicação de mesmo número (1º descongelamento × 1ª aplicação…).
// Sem sobras de servidor: usado nos formulários de novo prontuário e de edição.

type Qty = string | number | null | undefined;
type AppLike = { number: number; readonly?: boolean; items: { category: string; quantity: Qty }[] };
type ThawLike = { number: number; readonly?: boolean; thawedStraws: Qty; thawedMeio: Qty; thawedSoro: Qty };

const n = (v: Qty) => {
  const x = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const filled = (v: Qty) => v !== null && v !== undefined && String(v).trim() !== "";

const FIELDS = [
  { category: "CELULAS", key: "thawedStraws", label: "palhetas" },
  { category: "MEIO", key: "thawedMeio", label: "meio" },
  { category: "SORO", key: "thawedSoro", label: "soro" },
] as const;

export type ThawMismatch = { number: number; label: string; applied: number; thawed: number };

// Só compara descongelamentos com algum número preenchido e aplicações com itens lançados.
// Campo em branco no descongelamento conta como 0.
export function thawMismatches(apps: AppLike[], thaws: ThawLike[]): ThawMismatch[] {
  const out: ThawMismatch[] = [];
  for (const t of thaws) {
    if (t.readonly) continue;
    if (!FIELDS.some((f) => filled(t[f.key]))) continue;
    const app = apps.find((a) => a.number === t.number && !a.readonly);
    if (!app || !app.items.some((it) => n(it.quantity) > 0)) continue;
    for (const f of FIELDS) {
      const applied = app.items.filter((it) => it.category === f.category).reduce((s, it) => s + n(it.quantity), 0);
      const thawed = n(t[f.key]);
      if (applied !== thawed) out.push({ number: t.number, label: f.label, applied, thawed });
    }
  }
  return out;
}

export function describeMismatch(m: ThawMismatch) {
  return `${m.number}ª aplicação tem ${m.applied} de ${m.label}, mas o ${m.number}º descongelamento tem ${m.thawed}`;
}
