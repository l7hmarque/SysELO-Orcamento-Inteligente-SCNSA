
export interface Rubric {
  code: string;
  description: string;
  shortName: string; // For the Tab Label
}

export interface BudgetItem {
  id: string;
  name: string;
  rubricCode: string; 
  rubricDesc: string; 
  unitValue: number;
  quantity: number; 
  frequency: number; // Replaces Type
  justification?: string;
}

export interface HRItem {
  id: string;
  quantity: number;
  role: string; // Função/Cargo
  education: string; // Escolaridade
  weeklyHours: number;
  monthlyHours: number;
  grossSalary: number;
  months: number; // For annual calculation
  benefits?: number; // Bem estar social (Unitário)
}

export interface ReductionSuggestion {
  itemId: string;
  originalValue: number;
  suggestedValue: number;
  reason: string;
  section: 'GOODS' | 'HR';
}

export interface ImportResult {
  items: BudgetItem[];
  warnings: string[];
}

export interface BudgetProject {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    items: BudgetItem[];
    hrItems: HRItem[];
    createdAt: number;
    lastModified: number;
}

// Lista baseada no Plano de Contas Aplicado ao Setor Público (PCASP) - Comum no PR
export const PARANA_RUBRICS: Rubric[] = [
  { code: '3.3.90.30.07', description: 'Gêneros de Alimentação', shortName: 'Alimentação' },
  { code: '3.3.90.30.16', description: 'Material de Expediente', shortName: 'Expediente' },
  { code: '3.3.90.30.22', description: 'Material de Limpeza e Prod. de Higienização', shortName: 'Limpeza' },
  { code: '3.3.90.30.24', description: 'Material p/ Manutenção de Bens Imóveis', shortName: 'Manut. Predial' },
  { code: '3.3.90.30.14', description: 'Material Educativo e Esportivo', shortName: 'Educativo/Esporte' },
  { code: '3.3.90.32.00', description: 'Material de Distribuição Gratuita', shortName: 'Distrib. Gratuita' },
  { code: '3.3.90.36.00', description: 'Outros Serv. Terceiros - Pessoa Física', shortName: 'Serv. PF' },
  { code: '3.3.90.39.05', description: 'Serviços Técnicos Profissionais (PJ)', shortName: 'Técnicos PJ' },
  { code: '3.3.90.39.19', description: 'Manutenção e Conservação de Veículos', shortName: 'Manut. Veículos' },
  { code: '3.3.90.39.43', description: 'Serviços de Energia Elétrica', shortName: 'Energia' },
  { code: '3.3.90.39.44', description: 'Serviços de Água e Esgoto', shortName: 'Água' },
  { code: '3.3.90.39.63', description: 'Serviços Gráficos', shortName: 'Gráfica' },
  { code: '3.3.90.39.98', description: 'Outros Serviços de Terceiros - PJ (Específico)', shortName: 'Outros PJ Esp.' },
  { code: '3.3.90.39.99', description: 'Outros Serviços de Terceiros - PJ', shortName: 'Outros Serv. PJ' },
  { code: '4.4.90.52.12', description: 'Aparelhos e Utensílios Domésticos', shortName: 'Utensílios' },
  { code: '4.4.90.52.33', description: 'Equipamentos para Áudio, Vídeo e Foto', shortName: 'Áudio/Vídeo' },
  { code: '4.4.90.52.35', description: 'Equipamentos de Processamento de Dados', shortName: 'Informática' },
  { code: '4.4.90.52.42', description: 'Mobiliário em Geral', shortName: 'Mobiliário' },
];

export interface TaxRates {
  FGTS: number;
  INSS_PATRONAL: number;
  PIS: number;
  PROVISION_INSS_RATE: number;
  PROVISION_1_3_FERIAS: number;
  PROVISION_13: number;
  MULTA_FGTS: number;
}

export const DEFAULT_TAX_RATES: TaxRates = {
  FGTS: 0.08,
  INSS_PATRONAL: 0.20,
  PIS: 0.01,
  PROVISION_INSS_RATE: 0.293, // ~29.3% calculated from PDF ratios for provisions
  PROVISION_1_3_FERIAS: 1 / 36, // (1/12) / 3
  PROVISION_13: 1 / 12,
  MULTA_FGTS: 0.40,
};

export const calculateHRValues = (hr: HRItem, rates: TaxRates = DEFAULT_TAX_RATES) => {
  const base = hr.grossSalary * hr.quantity;
  const fgts = base * rates.FGTS;
  const inss = base * rates.INSS_PATRONAL;
  
  // Provisões
  const provFerias1_3 = base * rates.PROVISION_1_3_FERIAS;
  const provFgtsFerias1_3 = provFerias1_3 * rates.FGTS;
  const provInssFerias1_3 = provFerias1_3 * rates.PROVISION_INSS_RATE;

  const prov13 = base * rates.PROVISION_13;
  const provFgts13 = prov13 * rates.FGTS;
  const provInss13 = prov13 * rates.PROVISION_INSS_RATE;

  // CORRECTION: PIS in the PDF is calculated on (Base + Prov 1/3 Férias + Prov 13º)
  const pisBase = base + provFerias1_3 + prov13;
  const pis = pisBase * rates.PIS;

  const bemEstar = (hr.benefits || 0) * hr.quantity;

  // Multa FGTS 40% (Provision based on accumulated FGTS)
  const totalFgtsDeposits = fgts + provFgtsFerias1_3 + provFgts13;
  const multaFgts = totalFgtsDeposits * rates.MULTA_FGTS;

  const totalMes = base + fgts + inss + pis + provFerias1_3 + provFgtsFerias1_3 + provInssFerias1_3 + prov13 + provFgts13 + provInss13 + bemEstar + multaFgts;
  const totalAnual = totalMes * hr.months;

  return {
    base, fgts, inss, pis,
    provFerias1_3, provFgtsFerias1_3, provInssFerias1_3,
    prov13, provFgts13, provInss13,
    bemEstar, multaFgts,
    totalMes, totalAnual
  };
};
