"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} aria-label="Imprimir"
      className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
      <Printer size={16} />
    </button>
  );
}
