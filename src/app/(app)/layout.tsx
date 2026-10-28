import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { prisma } from "@/lib/prisma";
import { canFillOrderRecord, serviceOrderUnitIds } from "@/lib/service-orders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Senha provisória: obriga a trocar antes de usar o sistema
  if (session.mustChangePassword) redirect("/trocar-senha");
  const orderUnitIds = await serviceOrderUnitIds(session);
  const hasServiceOrders = orderUnitIds.length > 0;
  // OS concluídas pelo veterinário e ainda não iniciadas pelo laboratório
  const openOrders = hasServiceOrders && canFillOrderRecord(session.role)
    ? await prisma.alert.count({ where: { type: "SERVICE_ORDER", resolved: false, unitId: { in: orderUnitIds } } })
    : 0;

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar userName={session.name} userRole={session.role} hasServiceOrders={hasServiceOrders} openOrders={openOrders} />
      <main className="flex-1 overflow-y-auto bg-[#f5f7f5] print:overflow-visible print:bg-white">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}
