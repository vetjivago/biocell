"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  Building2,
  LogOut,
  FileText,
  AlertTriangle,
  Menu,
  FlaskConical,
  UserCog,
  X,
} from "lucide-react";
import { useState } from "react";
import { CLINICAL_ROLES, canOpenPage, hasRole, roleLabel, type Role } from "@/lib/roles";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/prontuarios", label: "Prontuários", icon: ClipboardList, roles: CLINICAL_ROLES },
  { href: "/pacientes", label: "Pacientes", icon: Users, roles: CLINICAL_ROLES },
  { href: "/ordens-servico", label: "Ordens de serviço", icon: FlaskConical, roles: CLINICAL_ROLES, serviceOrders: true },
  { href: "/estoque", label: "Estoque", icon: Package, roles: null },
  { href: "/unidades", label: "Unidades", icon: Building2, roles: ["ADMIN", "ADMINISTRATIVE", "UNIT_MANAGER"] as Role[] },
  { href: "/relatorios", label: "Relatórios", icon: FileText, roles: ["ADMIN", "COMMERCIAL", "UNIT_MANAGER"] as Role[] },
  { href: "/alertas", label: "Alertas", icon: AlertTriangle, roles: null },
  { href: "/usuarios", label: "Usuários", icon: UserCog, roles: ["ADMIN", "ADMINISTRATIVE", "UNIT_MANAGER"] as Role[] },
];

export default function Sidebar({ userName, userRole, hasServiceOrders = false }: { userName: string; userRole: string; hasServiceOrders?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);


  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden print:hidden fixed top-4 left-4 z-50 bg-sidebar text-white p-2 rounded-lg"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 print:hidden
        w-64 bg-sidebar text-white flex flex-col
        transform transition-transform lg:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-branca.svg" alt="BIO CELL by VETNIL" className="h-14 w-auto" />
              <p className="text-[10px] text-white/60 mt-1.5 tracking-wide uppercase">Prontuário & Estoque</p>
            </div>
            <button onClick={() => setOpen(false)} className="lg:hidden text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) => (!item.roles || hasRole(userRole, ...item.roles)) && canOpenPage(userRole, item.href) && (!("serviceOrders" in item) || hasServiceOrders)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary text-white font-medium"
                    : "text-white/70 hover:bg-sidebar-hover hover:text-white"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-xs font-bold">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-[10px] text-white/50">{roleLabel(userRole)}</p>
            </div>
          </div>
          <Link href="/conta" onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm w-full px-3 py-2 rounded-lg hover:bg-sidebar-hover transition-colors">
            <UserCog size={16} />
            Minha conta
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm w-full px-3 py-2 rounded-lg hover:bg-sidebar-hover transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
