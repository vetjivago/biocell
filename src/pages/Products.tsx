import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, AlertCircle } from 'lucide-react';
import { MOCK_PRODUCTS, MOCK_LABORATORIES } from '../services/mockData';
import type { Product } from '../types';

export function Products() {
    const [searchTerm, setSearchTerm] = useState('');

    // Função para determinar cor da linha baseada no estoque (Regra 2.2)
    const getStockStatusColor = (product: Product) => {
        if (product.currentStock <= product.minStock) {
            return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500';
        }
        if (product.currentStock < product.minStock * 1.2) {
            return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500';
        }
        return 'hover:bg-gray-50';
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Cadastro de Produtos</h2>
                <Link to="/produtos/novo" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <Plus size={20} />
                    Novo Produto
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, código ou laboratório..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700">
                    <Filter size={20} />
                    Filtros
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                        <tr>
                            <th className="p-4">Produto</th>
                            <th className="p-4">Laboratório</th>
                            <th className="p-4">Unidade</th>
                            <th className="p-4">Estoque</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {MOCK_PRODUCTS.map((product) => {
                            const labName = MOCK_LABORATORIES.find(l => l.id === product.laboratoryId)?.name || 'N/A';
                            const statusColor = getStockStatusColor(product);

                            return (
                                <tr key={product.id} className={`transition-colors ${statusColor}`}>
                                    <td className="p-4 font-medium">{product.name}</td>
                                    <td className="p-4 text-gray-600">{labName}</td>
                                    <td className="p-4 text-gray-600">{product.unit}</td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{product.currentStock}</span>
                                            <span className="text-xs text-gray-500">Mín: {product.minStock} / Máx: {product.maxStock}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {product.currentStock <= product.minStock ? (
                                            <span className="inline-flex items-center gap-1 text-red-700 text-sm font-medium px-2 py-1 rounded bg-red-100">
                                                <AlertCircle size={14} /> Comprar
                                            </span>
                                        ) : (
                                            <span className="text-green-700 text-sm font-medium px-2 py-1 rounded bg-green-100">
                                                OK
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">Editar</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
