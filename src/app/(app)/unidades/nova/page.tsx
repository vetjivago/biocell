import { getSession } from "@/lib/auth";
import { canManageUnits } from "@/lib/roles";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import UnitForm from "../UnitForm";

export default async function NovaUnidadePage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageUnits(session.role)) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/unidades" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Unidades
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nova UABC</h1>
      <UnitForm
        initial={{ name: "UABC ", city: "", state: "", address: "", phone: "", species: ["Canino", "Felino"], generalRecordEnabled: false, serviceOrderEnabled: false, active: true }}
      />
    </div>
  );
}
