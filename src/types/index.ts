export type Unit = 'CX' | 'UN' | 'L' | 'KG' | 'PAR' | 'PCT';
export type UsageType = 'ROTINA' | 'REAGENTE' | 'FILTRO' | 'MANUTENCAO' | 'OUTROS';

export interface Supplier {
    id: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
}

export interface CostCenter {
    id: string;
    code: string;
    name: string;
}

export interface Laboratory {
    id: string;
    name: string;
}

export interface Product {
    id: string;
    name: string;
    laboratoryId: string; // Laboratório proprietário/usuário principal
    unit: Unit;
    minStock: number;
    maxStock: number;
    currentStock: number;
    leadTimeDays: number;
    defaultSupplierId?: string;
    usageType: UsageType;
    lastPrice?: number;
}
