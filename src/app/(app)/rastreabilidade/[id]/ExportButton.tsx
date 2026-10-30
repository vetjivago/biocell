"use client";

import { Download } from "lucide-react";

// Planilha dos pacientes potencialmente afetados (CSV com ";" e BOM para abrir certo no Excel)
export default function ExportButton({ fileName, header, rows }: { fileName: string; header: string[]; rows: string[][] }) {
  function download() {
    const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} disabled={rows.length === 0}
      className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
      <Download size={16} /> Exportar pacientes (CSV)
    </button>
  );
}
