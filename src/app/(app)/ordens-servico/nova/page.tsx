import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewOrderForm from "../NewOrderForm";
import { nextSerial } from "@/lib/service-orders";
import { hasRole } from "@/lib/roles";

export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { patientId } = await searchParams;
  if (!patientId) notFound();

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      unit: { select: { city: true, serviceOrderEnabled: true } },
      medicalRecords: { orderBy: { createdAt: "desc" }, take: 1, select: { pathology: true } },
    },
  });
  if (!patient || !patient.unit.serviceOrderEnabled) notFound();
  if (!hasRole(session.role, "ADMIN") && !session.unitIds.includes(patient.unitId)) notFound();

  const last = await prisma.serviceOrder.findMany({ select: { serialNumber: true }, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="max-w-3xl">
      <Link href={`/pacientes/${patient.id}?aba=ct`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> {patient.name}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ordem de Serviço – Halógena</h1>
      <p className="text-sm text-gray-500 mb-6">
        {patient.name} · {patient.species}{patient.breed ? ` · ${patient.breed}` : ""} · Tutor: {patient.ownerName}
      </p>
      <NewOrderForm
        patientId={patient.id}
        suggestedSerial={nextSerial(last.map((o) => o.serialNumber))}
        defaults={{
          veterinarian: patient.veterinarian || "",
          clinic: patient.clinic || "",
          city: patient.unit.city || "",
          disease: patient.medicalRecords[0]?.pathology || "",
        }}
      />
    </div>
  );
}
