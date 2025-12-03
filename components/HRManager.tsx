import React, { useState, useMemo } from 'react';
import { HRItem, calculateHRValues, TaxRates } from '../types';
import { Users, Plus, Trash2, X, CheckSquare, Calculator } from 'lucide-react';

interface Props {
  items: HRItem[];
  onAdd: (item: HRItem) => void;
  onDelete: (id: string) => void;
  taxRates: TaxRates;
}

// Definition of columns matching Excel Export
const COLUMNS = [
  { key: 'grossSalary', label: 'Salário Unit.', rubric: 'BASE', desc: 'Salário bruto individual.', isUnit: true },
  { key: 'base', label: 'Salário Base Total', rubric: '3.1.90.11', desc: 'Soma dos salários brutos (Unit * Qtd).' },
  { key: 'fgts', label: 'FGTS (8%)', rubric: '3.1.90.13', desc: 'Fundo de Garantia.' },
  { key: 'inss', label: 'INSS Patronal (20%)', rubric: '3.1.90.13', desc: 'INSS Patronal (20%).' },
  { key: 'pis', label: 'PIS (1%)', rubric: '3.3.90.47', desc: 'PIS sobre Folha + Provisões.' },
  { key: 'provFerias1_3', label: 'Prov. 1/3 Férias', rubric: '3.1.90.11', desc: 'Provisão do adicional de 1/3.' },
  { key: 'provFgtsFerias1_3', label: 'Prov. FGTS 1/3', rubric: '3.1.90.13', desc: 'FGTS sobre 1/3 férias.' },
  { key: 'provInssFerias1_3', label: 'Prov. INSS 1/3', rubric: '3.1.90.13', desc: 'INSS sobre 1/3 férias.' },
  { key: 'prov13', label: 'Prov. 13º', rubric: '3.1.90.11', desc: 'Provisão mensal 13º.' },
  { key: 'provFgts13', label: 'Prov. FGTS 13º', rubric: '3.1.90.13', desc: 'FGTS sobre 13º.' },
  { key: 'provInss13', label: 'Prov. INSS 13º', rubric: '3.1.90.13', desc: 'INSS sobre 13º.' },
  { key: 'bemEstar', label: 'Benefícios', rubric: '3.3.90.46', desc: 'Vale transporte/alimentação.' },
  { key: 'multaFgts', label: 'Multa 40%', rubric: '3.1.90.94', desc: 'Provisão multa rescisória.' },
  { key: 'totalMes', label: 'Total Mês', rubric: 'TOTAL', desc: 'Custo mensal total.', highlight: true },
  { key: 'totalAnual', label: 'Total Anual', rubric: 'ANUAL', desc: 'Custo anual (x Meses)', highlight: true, borderLeft: true },
];

const formatCurrencyMask = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const number = parseInt(onlyDigits, 10) / 100;
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseCurrency = (value: string): number => {
    if (!value) return 0;
    const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

export const HRManager: React.FC<Props> = ({ items, onAdd, onDelete, taxRates }) => {
  // Form State
  const [role, setRole] = useState('');
  const [education, setEducation] = useState('Ensino Médio');
  const [quantity, setQuantity] = useState('1');
  const [weeklyHours, setWeeklyHours] = useState('40');
  const [grossSalary, setGrossSalary] = useState('');
  const [benefits, setBenefits] = useState('');
  const [months, setMonths] = useState('12');

  // Interactive Column State
  const [selectedColumn, setSelectedColumn] = useState<typeof COLUMNS[0] | null>(null);

  // Real-time Simulation
  const simulatedCost = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const salary = parseCurrency(grossSalary);
    const mths = parseInt(months) || 12;
    const bens = parseCurrency(benefits);
    
    // Create temp item for calculation
    const tempItem: HRItem = {
        id: 'temp',
        role: 'temp',
        education: '',
        weeklyHours: 0,
        monthlyHours: 0,
        quantity: qty,
        grossSalary: salary,
        months: mths,
        benefits: bens
    };
    return calculateHRValues(tempItem, taxRates);
  }, [quantity, grossSalary, months, benefits, taxRates]);

  const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
      setter(formatCurrencyMask(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !grossSalary) return;

    onAdd({
      id: crypto.randomUUID(),
      role,
      education,
      quantity: parseFloat(quantity),
      weeklyHours: parseFloat(weeklyHours),
      monthlyHours: parseFloat(weeklyHours) * 5, 
      grossSalary: parseCurrency(grossSalary),
      months: parseInt(months),
      benefits: parseCurrency(benefits)
    });
    
    setRole('');
    setGrossSalary('');
    setBenefits('');
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    COLUMNS.forEach(col => totals[col.key] = 0);
    
    items.forEach(hr => {
        const vals = calculateHRValues(hr, taxRates);
        COLUMNS.forEach(col => {
            if (col.isUnit) {
               totals[col.key] += hr.grossSalary; // Not really a total, but sum of units? Or skip.
            } else {
               // @ts-ignore
               totals[col.key] += vals[col.key];
            }
        });
    });
    return totals;
  }, [items, taxRates]);

  return (
    <div className="space-y-6 relative">
       
       {/* Info Box */}
       <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3 shadow-sm">
         <div className="bg-orange-100 p-2 rounded-full h-fit"><CheckSquare className="text-orange-600 w-4 h-4" /></div>
         <div className="text-sm text-orange-800">
           <strong>Cálculo Automático de Provisões:</strong> O sistema aplica automaticamente 1/3 de férias, 13º salário e encargos (INSS/FGTS) conforme a legislação vigente para o SCFV.
         </div>
       </div>

       {/* Form */}
       <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-5 flex items-center gap-2 uppercase text-sm tracking-wide">
            <Users className="w-5 h-5 text-red-600" /> Adicionar Profissional
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
             <div className="md:col-span-2">
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cargo/Função</label>
               <input required value={role} onChange={e => setRole(e.target.value)} className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm p-2.5 focus:bg-white focus:ring-2 focus:ring-red-500 transition-all text-slate-700" placeholder="Ex: Psicólogo" />
             </div>
             
             <div className="md:col-span-1">
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Qtd</label>
               <input type="number" min="1" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm p-2.5 focus:bg-white transition-all text-slate-700" />
             </div>

             <div className="md:col-span-1">
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">C.H. Semanal</label>
               <input type="number" min="1" max="60" required value={weeklyHours} onChange={e => setWeeklyHours(e.target.value)} className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm p-2.5 focus:bg-white transition-all text-slate-700" />
             </div>

             <div className="md:col-span-1">
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Meses</label>
               <input type="number" min="1" max="12" required value={months} onChange={e => setMonths(e.target.value)} className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm p-2.5 focus:bg-white transition-all text-slate-700" />
             </div>

             <div className="md:col-span-1">
               <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Salário (R$)</label>
               <input 
                 required 
                 value={grossSalary} 
                 onChange={e => handleCurrencyInput(e, setGrossSalary)} 
                 className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm p-2.5 focus:bg-white transition-all text-slate-700" 
                 placeholder="R$ 0,00" 
               />
             </div>

             <div className="md:col-span-1">
               <button className="w-full bg-red-600 text-white p-2.5 rounded-lg shadow-lg shadow-red-200 hover:bg-red-700 font-bold text-sm transition-transform active:scale-95 flex justify-center items-center gap-2">
                 <Plus size={18} /> Add
               </button>
             </div>
          </form>

          {/* Live Simulation Preview */}
          {grossSalary && (
             <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center animate-in fade-in slide-in-from-top-1">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                     <Calculator size={14} /> Simulação de Custo
                 </div>
                 <div className="flex gap-6 text-sm">
                     <div>
                         <span className="text-slate-400 text-[10px] uppercase block">Salário Base</span>
                         <span className="font-bold text-slate-700">{formatCurrency(simulatedCost.base)}</span>
                     </div>
                     <div>
                         <span className="text-slate-400 text-[10px] uppercase block">Total Mês</span>
                         <span className="font-bold text-slate-800">{formatCurrency(simulatedCost.totalMes)}</span>
                     </div>
                     <div>
                         <span className="text-slate-400 text-[10px] uppercase block">Total Anual</span>
                         <span className="font-bold text-red-600">{formatCurrency(simulatedCost.totalAnual)}</span>
                     </div>
                 </div>
             </div>
          )}
       </div>

       {/* Detailed Table */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          
          {/* Detail Popover */}
          {selectedColumn && (
             <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-30 w-72 bg-white rounded-xl shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-200 p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-red-500 p-3 flex justify-between items-center text-white">
                    <span className="text-xs font-bold uppercase tracking-wider">{selectedColumn.label}</span>
                    <button onClick={() => setSelectedColumn(null)}><X size={14} className="hover:text-red-200"/></button>
                </div>
                <div className="p-4 space-y-3">
                    {/* Only show total for numeric calculated columns */}
                    {!selectedColumn.isUnit && (
                      <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                          <span className="text-gray-500 text-xs">Total Coluna</span>
                          <span className="font-bold text-red-600 text-xl">{formatCurrency(columnTotals[selectedColumn.key])}</span>
                      </div>
                    )}
                    <div>
                        <div className="font-mono text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded inline-block mb-1">
                            {selectedColumn.rubric}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{selectedColumn.desc}</p>
                    </div>
                </div>
             </div>
          )}

          <div className="overflow-x-auto pb-4">
            <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                        <th className="px-3 py-4 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Cargo</th>
                        <th className="px-2 py-4 text-center">Qtd</th>
                        {COLUMNS.map((col, idx) => (
                            <th 
                                key={idx} 
                                className={`px-3 py-4 text-right cursor-pointer hover:bg-red-50 transition-colors group ${col.highlight ? 'bg-red-50/50 text-red-800' : ''} ${col.borderLeft ? 'border-l border-slate-200 pl-4' : ''}`}
                                onClick={() => setSelectedColumn(col)}
                            >
                                <div className="flex flex-col items-end gap-1">
                                    <span>{col.label}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 group-hover:bg-red-200 group-hover:text-red-700 transition-colors">{col.rubric}</span>
                                </div>
                            </th>
                        ))}
                        <th className="px-3 py-4 text-center"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map(hr => {
                        const vals = calculateHRValues(hr, taxRates);
                        return (
                            <tr key={hr.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-3 font-semibold text-slate-700 sticky left-0 bg-white border-r border-slate-100 z-10">
                                    {hr.role}
                                </td>
                                <td className="px-2 py-3 text-center text-slate-500">{hr.quantity}</td>
                                
                                {COLUMNS.map((col, idx) => (
                                    <td 
                                      key={idx} 
                                      className={`px-3 py-3 text-right cursor-pointer hover:bg-red-100 transition-colors duration-150 ${col.highlight ? 'font-bold bg-red-50/30 text-slate-800' : 'text-slate-600'} ${col.borderLeft ? 'border-l border-slate-100 pl-4 bg-yellow-50/50' : ''}`}
                                      onClick={() => setSelectedColumn(col)}
                                    >
                                        {col.isUnit ? formatCurrency(hr.grossSalary) : 
                                         // @ts-ignore
                                         formatCurrency(vals[col.key])
                                        }
                                    </td>
                                ))}

                                <td className="px-3 py-3 text-center">
                                    <button onClick={() => onDelete(hr.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-slate-700 border-t border-slate-200 text-[11px]">
                    <tr>
                        <td className="px-3 py-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">TOTAIS</td>
                        <td></td>
                        {COLUMNS.map((col, idx) => (
                            <td key={idx} className={`px-3 py-3 text-right ${col.highlight ? 'text-red-800' : ''}`}>
                                {col.isUnit ? '-' : formatCurrency(columnTotals[col.key])}
                            </td>
                        ))}
                        <td></td>
                    </tr>
                </tfoot>
            </table>
          </div>
       </div>

    </div>
  );
};