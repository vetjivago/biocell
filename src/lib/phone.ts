// Celular de login (sem dependências de servidor: usado também no navegador)

// Guarda só os dígitos com DDD (10 ou 11 dígitos); aceita +55, parênteses, espaços e traços
export function normalizePhone(v: unknown) {
  let d = typeof v === "string" ? v.replace(/\D/g, "") : "";
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  return /^[1-9]{2}\d{8,9}$/.test(d) ? d : null;
}

// 61999998888 → (61) 99999-8888
export function formatPhone(d: string | null | undefined) {
  if (!d) return "";
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

// O que a pessoa digita para entrar: e-mail ou celular
export function loginLabel(user: { email?: string | null; phone?: string | null }) {
  return user.email || formatPhone(user.phone);
}
