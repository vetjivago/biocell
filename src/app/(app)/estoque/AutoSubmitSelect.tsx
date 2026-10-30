"use client";

// Select que envia o formulário ao trocar a opção (ex.: quantas movimentações por página)
export default function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
