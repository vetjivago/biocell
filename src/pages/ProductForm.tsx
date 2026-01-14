import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { MOCK_LABORATORIES } from '../services/mockData';

export function ProductForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        laboratoryId: '',
        unit: 'CX',
        minStock: 0,
        maxStock: 0,
        leadTimeDays: 0,
        usageType: 'ROTINA'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Integrate with backend
        console.log('Saving product:', formData);
        navigate('/produtos');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/produtos')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-2xl font-bold text-gray-800">Novo Produto</h2>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                        <input
                            type="text"
                            required
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Laboratório (Proprietário)</label>
                        <select
                            required
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.laboratoryId}
                            onChange={e => setFormData({ ...formData, laboratoryId: e.target.value })}
                        >
                            <option value="">Selecione...</option>
                            {MOCK_LABORATORIES.map(lab => (
                                <option key={lab.id} value={lab.id}>{lab.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                        <select
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.unit}
                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        >
                            <option value="CX">Caixa (CX)</option>
                            <option value="UN">Unidade (UN)</option>
                            <option value="L">Litro (L)</option>
                            <option value="PCT">Pacote (PCT)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                        <input
                            type="number"
                            min="0"
                            required
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.minStock}
                            onChange={e => setFormData({ ...formData, minStock: Number(e.target.value) })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Máximo</label>
                        <input
                            type="number"
                            min="0"
                            required
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.maxStock}
                            onChange={e => setFormData({ ...formData, maxStock: Number(e.target.value) })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (Dias)</label>
                        <input
                            type="number"
                            min="1"
                            required
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.leadTimeDays}
                            onChange={e => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Tempo estimado de entrega do fornecedor</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Uso</label>
                        <select
                            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.usageType}
                            onChange={e => setFormData({ ...formData, usageType: e.target.value })}
                        >
                            <option value="ROTINA">Rotina</option>
                            <option value="REAGENTE">Reagente</option>
                            <option value="FILTRO">Filtro</option>
                            <option value="MANUTENCAO">Manutenção</option>
                        </select>
                    </div>

                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/produtos')}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Save size={20} />
                        Salvar Produto
                    </button>
                </div>
            </form>
        </div>
    );
}
