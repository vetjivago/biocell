import { getSession } from "@/lib/auth";
import { canManageUnits } from "@/lib/roles";
import { NextRequest } from "next/server";
import { formatPhoneInput, isValidCnpj, onlyDigits } from "@/lib/units";

// Preenche o cadastro da unidade pelo CNPJ (BrasilAPI, dados da Receita) ou pelo CEP (ViaCEP).
// Consulta feita pelo servidor: as APIs são públicas e gratuitas, e a página só conecta no próprio domínio (CSP).
const TIMEOUT = 8000;

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { Accept: "application/json" }, cache: "no-store" });
  return { status: res.status, data: res.ok ? await res.json() : null };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Natureza jurídica da Receita: 2062 → "206-2 - Sociedade Empresária Limitada"
function legalNature(code: unknown, desc: unknown) {
  const c = String(code ?? "").replace(/\D/g, "");
  return [c.length === 4 ? `${c.slice(0, 3)}-${c[3]}` : c, str(desc)].filter(Boolean).join(" - ");
}

// Porte da Receita (e a natureza, para órgão público e entidade sem fins lucrativos) → LEGAL_CATEGORIES
function legalCategory(d: Record<string, unknown>) {
  const code = String(d.codigo_natureza_juridica ?? "");
  if (code.startsWith("1")) return "Órgão público";
  if (code.startsWith("3")) return "Entidade sem fins lucrativos";
  if (d.opcao_pelo_mei === true) return "MEI";
  const porte = str(d.porte).toUpperCase();
  if (porte.includes("MICRO")) return "Microempresa (ME)";
  if (porte.includes("PEQUENO")) return "Empresa de Pequeno Porte (EPP)";
  if (porte.includes("DEMAIS")) return "Demais (médio/grande porte)";
  return "";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageUnits(session.role)) return Response.json({ error: "Sem permissão" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  try {
    const cnpj = onlyDigits(params.get("cnpj"));
    if (cnpj) {
      if (!isValidCnpj(cnpj)) return Response.json({ error: "CNPJ inválido" }, { status: 400 });
      const { status, data: d } = await getJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!d) return Response.json({ error: status === 404 ? "CNPJ não encontrado na Receita" : "Consulta do CNPJ indisponível agora; preencha manualmente" }, { status: 502 });
      const street = [str(d.descricao_tipo_de_logradouro), str(d.logradouro)].filter(Boolean).join(" ");
      const phones = [d.ddd_telefone_1, d.ddd_telefone_2].map((p) => onlyDigits(p)).filter((p) => p.length >= 10);
      return Response.json({
        legalName: str(d.razao_social),
        tradeName: str(d.nome_fantasia),
        legalNature: legalNature(d.codigo_natureza_juridica, d.natureza_juridica),
        legalCategory: legalCategory(d),
        shareCapital: typeof d.capital_social === "number" && d.capital_social > 0 ? d.capital_social.toFixed(2).replace(".", ",") : "",
        zipCode: onlyDigits(String(d.cep ?? "")),
        street,
        number: str(d.numero),
        complement: str(d.complemento),
        district: str(d.bairro),
        city: str(d.municipio),
        state: str(d.uf),
        phones: phones.filter((p) => p.length === 10).map(formatPhoneInput),
        mobiles: phones.filter((p) => p.length === 11).map(formatPhoneInput),
        email: str(d.email).toLowerCase(),
        status: str(d.descricao_situacao_cadastral),
      });
    }

    const cep = onlyDigits(params.get("cep"));
    if (cep) {
      if (cep.length !== 8) return Response.json({ error: "CEP inválido" }, { status: 400 });
      const { data: d } = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
      if (!d || d.erro) return Response.json({ error: "CEP não encontrado" }, { status: 404 });
      return Response.json({ street: str(d.logradouro), district: str(d.bairro), city: str(d.localidade), state: str(d.uf), complement: str(d.complemento) });
    }
  } catch {
    return Response.json({ error: "Consulta indisponível agora; preencha manualmente" }, { status: 502 });
  }
  return Response.json({ error: "Informe o CNPJ ou o CEP" }, { status: 400 });
}
