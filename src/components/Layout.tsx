import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, DollarSign } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar Placeholder */}
            <aside className="w-64 bg-slate-900 text-white p-4 hidden md:block">
                <div className="text-2xl font-bold mb-8 text-blue-400">BIO System</div>
                <nav className="space-y-2">
                    <Link to="/dashboard" className="flex items-center gap-3 p-3 rounded hover:bg-slate-800 transition-colors">
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </Link>
                    <Link to="/produtos" className="flex items-center gap-3 p-3 rounded hover:bg-slate-800 transition-colors">
                        <Package size={20} />
                        <span>Produtos e Estoque</span>
                    </Link>
                    <Link to="/pedidos" className="flex items-center gap-3 p-3 rounded hover:bg-slate-800 transition-colors">
                        <ShoppingCart size={20} />
                        <span>Pedidos de Compra</span>
                    </Link>
                    <Link to="/financeiro" className="flex items-center gap-3 p-3 rounded hover:bg-slate-800 transition-colors">
                        <DollarSign size={20} />
                        <span>Financeiro</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="bg-white shadow-sm p-4 flex justify-between items-center">
                    <h1 className="text-xl font-semibold text-gray-800">Visão Geral</h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">Usuário: Admin</span>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
