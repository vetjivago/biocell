import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PatientForm from "../../PatientForm";
import { hasRole } from "@/lib/roles";

export default async function EditarPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;
  const p = await prisma.patient.findUnique({ where: { id } });
  if (!p) notFound();
  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(p.unitId)) notFound();

  return (
    <div className="max-w-2xl">
      <Link href={`/pacientes/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> {p.name}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar cadastro – {p.name}</h1>
      <PatientForm
        patientId={id}
        initial={{
          unitId: p.unitId, name: p.name, species: p.species, breed: p.breed || "", sex: p.sex || "",
          neutered: p.neutered, coat: p.coat || "", birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : "",
          weight: p.weight?.toString().replace(".", ",") || "", microchip: p.microchip || "",
          ownerName: p.ownerName, ownerPhone: p.ownerPhone || "", ownerEmail: p.ownerEmail || "",
          ownerAddress: p.ownerAddress || "", veterinarian: p.veterinarian || "", clinic: p.clinic || "",
        }}
      />
    </div>
  );
}
