import React from 'react';

export function Dashboard() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Card 1: Pedidos Pendentes */}
                <div className="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
                    <div className="text-gray-500 text-sm">Pedidos Pendentes</div>
                    <div className="text-2xl font-bold">12</div>
                    <div className="text-xs text-yellow-600 mt-1">Aguardando aprovação</div>
                </div>

                {/* Card 2: A Receber */}
                <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                    <div className="text-gray-500 text-sm">A Receber</div>
                    <div className="text-2xl font-bold">5</div>
                    <div className="text-xs text-blue-600 mt-1">Entregas previstas hoje</div>
                </div>

                {/* Card 3: RNC Abertas */}
                <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
                    <div className="text-gray-500 text-sm">RNC Abertas</div>
                    <div className="text-2xl font-bold">2</div>
                    <div className="text-xs text-red-600 mt-1">Ação requerida</div>
                </div>

                {/* Card 4: Contas a Pagar */}
                <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
                    <div className="text-gray-500 text-sm">Contas a Pagar (Mês)</div>
                    <div className="text-2xl font-bold">R$ 45.200</div>
                    <div className="text-xs text-green-600 mt-1">Próximo vencto: 15/01</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded shadow">
                <h3 className="text-lg font-semibold mb-4">Fluxo de Aprovação Recente</h3>
                <p className="text-gray-500">Nenhum pedido recente para mostrar.</p>
            </div>
        </div>
    );
}
