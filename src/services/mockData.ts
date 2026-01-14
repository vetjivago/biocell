import type { Product, Supplier, Laboratory } from '../types';

export const MOCK_LABORATORIES: Laboratory[] = [
    { id: '1', name: 'Laboratório de Análises Clínicas' },
    { id: '2', name: 'Laboratório de Genética' },
    { id: '3', name: 'Almoxarifado Central' },
];

export const MOCK_SUPPLIERS: Supplier[] = [
    { id: '1', name: 'Medix Brasil', contact: 'Carlos', email: 'vendas@medix.com', phone: '1199999999' },
    { id: '2', name: 'LabHouse', contact: 'Ana', email: 'comercial@labhouse.com', phone: '1188888888' },
    { id: '3', name: 'Sigma-Aldrich', contact: 'Central', email: 'orders@sigma.com', phone: '0800123456' },
];

export const MOCK_PRODUCTS: Product[] = [
    {
        id: '1',
        name: 'Luva de Procedimento Tamanho M',
        laboratoryId: '3',
        unit: 'CX',
        minStock: 50,
        maxStock: 200,
        currentStock: 32, // Abaixo do mínimo (Vermelho)
        leadTimeDays: 5,
        defaultSupplierId: '1',
        usageType: 'ROTINA',
        lastPrice: 45.00
    },
    {
        id: '2',
        name: 'Reagente Glicose 500ml',
        laboratoryId: '1',
        unit: 'UN',
        minStock: 5,
        maxStock: 20,
        currentStock: 8,
        leadTimeDays: 15,
        defaultSupplierId: '2',
        usageType: 'REAGENTE',
        lastPrice: 120.00
    },
    {
        id: '3',
        name: 'Filtro de Seringa 0.22µm',
        laboratoryId: '2',
        unit: 'PCT',
        minStock: 10,
        maxStock: 50,
        currentStock: 45,
        leadTimeDays: 30,
        defaultSupplierId: '3',
        usageType: 'FILTRO',
        lastPrice: 250.00
    }
];
