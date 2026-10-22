"use client";

import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, RemoveFormatting, Baseline, Highlighter,
} from "lucide-react";
import { isHtml, textToHtml } from "@/lib/rich-text";

// Editor de texto com barra de formatação (negrito, itálico, cores, listas, alinhamento...).
// Usa o editor nativo do navegador (contentEditable); o HTML é filtrado no servidor antes de gravar
export default function RichTextEditor({
  value, onChange, placeholder, minHeight = 280,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string | null>(null);

  // Só reescreve o conteúdo quando o valor muda de fora (rascunho recuperado, roteiro inserido),
  // senão o cursor pularia para o início a cada letra
  useEffect(() => {
    const el = ref.current;
    if (!el || value === lastHtml.current) return;
    el.innerHTML = textToHtml(value);
    lastHtml.current = value;
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    // Editor "vazio" do navegador (<br>, <p><br></p>) conta como vazio; a 1ª linha digitada às vezes fica
    // sem tag, então embrulha num parágrafo para o texto ser sempre reconhecido como formatado
    const raw = el.textContent?.trim() || el.querySelector("li, hr") ? el.innerHTML : "";
    const html = raw && !isHtml(raw) ? `<p>${raw}</p>` : raw;
    lastHtml.current = html;
    onChange(html);
  }

  // Última seleção dentro do editor: a paleta de cores e os menus tiram o foco, e ela é restaurada antes de aplicar
  const savedRange = useRef<Range | null>(null);
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  }

  function exec(command: string, arg?: string) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel && !(sel.rangeCount && el.contains(sel.anchorNode) && !sel.isCollapsed)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, arg);
    emit();
  }

  const btn = "p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-40";
  const sep = <span className="w-px h-5 bg-gray-300 mx-0.5" />;
  // onMouseDown + preventDefault: o clique na barra não tira a seleção do texto
  const buttons = (items: [cmd: string, title: string, Icon: typeof Bold][]) =>
    items.map(([cmd, title, Icon]) => (
      <button key={cmd} type="button" title={title} aria-label={title} className={btn}
        onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}>
        <Icon size={16} />
      </button>
    ));

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <select title="Estilo do parágrafo" aria-label="Estilo do parágrafo" defaultValue=""
          onChange={(e) => { if (e.target.value) exec("formatBlock", e.target.value); e.target.value = ""; }}
          className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white mr-1">
          <option value="" disabled>Estilo</option>
          <option value="p">Normal</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
          <option value="blockquote">Citação</option>
        </select>
        <select title="Tamanho da letra" aria-label="Tamanho da letra" defaultValue=""
          onChange={(e) => { if (e.target.value) exec("fontSize", e.target.value); e.target.value = ""; }}
          className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white mr-1">
          <option value="" disabled>Tamanho</option>
          <option value="2">Pequeno</option>
          <option value="3">Normal</option>
          <option value="4">Médio</option>
          <option value="5">Grande</option>
          <option value="6">Muito grande</option>
        </select>
        {buttons([["bold", "Negrito (Ctrl+B)", Bold], ["italic", "Itálico (Ctrl+I)", Italic], ["underline", "Sublinhado (Ctrl+U)", Underline], ["strikeThrough", "Tachado", Strikethrough]])}
        {sep}
        <label title="Cor do texto" className={`${btn} relative cursor-pointer`} onMouseDown={(e) => e.preventDefault()}>
          <Baseline size={16} />
          <input type="color" defaultValue="#c00000" aria-label="Cor do texto"
            onChange={(e) => exec("foreColor", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <label title="Marca-texto" className={`${btn} relative cursor-pointer`} onMouseDown={(e) => e.preventDefault()}>
          <Highlighter size={16} />
          <input type="color" defaultValue="#ffff00" aria-label="Marca-texto"
            onChange={(e) => exec("hiliteColor", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        {sep}
        {buttons([["insertUnorderedList", "Lista com marcadores", List], ["insertOrderedList", "Lista numerada", ListOrdered]])}
        {sep}
        {buttons([["justifyLeft", "Alinhar à esquerda", AlignLeft], ["justifyCenter", "Centralizar", AlignCenter], ["justifyRight", "Alinhar à direita", AlignRight], ["justifyFull", "Justificar", AlignJustify]])}
        {sep}
        {buttons([["removeFormat", "Limpar formatação", RemoveFormatting], ["undo", "Desfazer (Ctrl+Z)", Undo2], ["redo", "Refazer (Ctrl+Y)", Redo2]])}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={() => { emit(); saveSelection(); }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={() => { saveSelection(); emit(); }}
        style={{ minHeight }}
        className="rich-text px-3 py-2 text-sm leading-relaxed outline-none overflow-y-auto max-h-[70vh] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  );
}
