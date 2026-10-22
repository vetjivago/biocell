import sanitizeHtml from "sanitize-html";
import { isHtml } from "./rich-text";

// Só a formatação da barra do editor passa: negrito, itálico, sublinhado, cores, tamanho, listas, alinhamento, títulos.
// Scripts, links, imagens, eventos (onclick...) e qualquer outro estilo são removidos
const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i, /^[a-z]{3,20}$/i];
const SIZE = [/^(x-small|small|medium|large|x-large|xx-large)$/, /^\d{1,2}(\.\d+)?(px|pt|em|rem)$/];
const ALIGN = [/^(left|right|center|justify)$/];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "div", "br", "b", "strong", "i", "em", "u", "s", "strike", "span", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "hr"],
  allowedAttributes: { "*": ["style"] },
  allowedStyles: {
    "*": { color: COLOR, "background-color": COLOR, "font-size": SIZE, "text-align": ALIGN, "font-weight": [/^(bold|normal|[1-9]00)$/], "font-style": [/^(italic|normal)$/], "text-decoration": [/^(underline|line-through|none)$/], "text-decoration-line": [/^(underline|line-through|none)$/] },
  },
  // Cola do Word/SimplesVet: títulos grandes viram h2, <font> antigo vira <span>
  transformTags: { h1: "h2", h5: "h4", h6: "h4", font: "span" },
  disallowedTagsMode: "discard",
};

export function sanitizeRichText(v: string) {
  return isHtml(v) ? sanitizeHtml(v, OPTIONS) : v;
}
