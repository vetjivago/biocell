import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { serviceOrderUnitIds } from "@/lib/service-orders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Senha provisória: obriga a trocar antes de usar o sistema
  if (session.mustChangePassword) redirect("/trocar-senha");
  const hasServiceOrders = (await serviceOrderUnitIds(session)).length > 0;

  return (
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar userName={session.name} userRole={session.role} hasServiceOrders={hasServiceOrders} />
      <main className="flex-1 overflow-y-auto bg-[#f5f7f5] print:overflow-visible print:bg-white">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}
