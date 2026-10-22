// Texto formatado do prontuário (sem dependências de servidor: usado também no navegador)
// Registros antigos são texto puro; os novos são HTML (já filtrado no servidor por rich-text-server.ts)

export function isHtml(v: string) {
  return /^\s*<(p|div|h[1-6]|ul|ol|blockquote|span|font|b|strong|i|em|u|s|br)\b/i.test(v);
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Texto puro → HTML: um parágrafo por bloco separado por linha em branco, quebras simples viram <br>
export function textToHtml(text: string) {
  if (!text.trim()) return "";
  if (isHtml(text)) return text;
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// HTML → texto puro (prévia na linha do tempo, validação de "vazio")
export function htmlToText(v: string) {
  if (!isHtml(v)) return v;
  return v
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
