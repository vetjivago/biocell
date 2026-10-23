"use client";

// PÁGINA TEMPORÁRIA DE TESTE DO EDITOR — apagar antes do commit
import { useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";

export default function TesteEditor() {
  const [html, setHtml] = useState("Baço: normal\nRim: ok\n\nBexiga: cristais");
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <RichTextEditor value={html} onChange={setHtml} placeholder="Escreva..." />
      <pre id="saida" className="text-xs bg-gray-100 p-2 whitespace-pre-wrap break-all">{html}</pre>
    </div>
  );
}
