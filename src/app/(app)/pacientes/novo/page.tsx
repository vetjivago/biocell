import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PatientForm, { EMPTY_PATIENT } from "../PatientForm";

export default function NovoPacientePage() {
  return (
    <div className="max-w-2xl">
      <Link href="/pacientes" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Novo Paciente</h1>
      <PatientForm initial={EMPTY_PATIENT} />
    </div>
  );
}
