import React, { useState, useEffect } from 'react';
import { TaxRates, DEFAULT_TAX_RATES } from '../types';
import { X, Save, RotateCcw, Settings, Percent, Divide, Shield, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRates: TaxRates;
  onSave: (rates: TaxRates) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, currentRates, onSave }) => {
  const [rates, setRates] = useState<TaxRates>(currentRates);

  useEffect(() => {
    setRates(currentRates);
  }, [currentRates, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof TaxRates, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setRates(prev => ({ ...prev, [key]: num / 100 }));
    }
  };

  const handleFractionChange = (key: keyof TaxRates, value: string) => {
      const denominator = parseFloat(value);
      if (!isNaN(denominator) && denominator !== 0) {
          setRates(prev => ({ ...prev, [key]: 1 / denominator }));
      }
  };

  const restoreDefaults = () => {
    if (window.confirm('Tem certeza? Isso restaurará todas as alíquotas para o padrão do sistema.')) {
      setRates(DEFAULT_TAX_RATES);
    }
  };

  const handleSave = () => {
    onSave(rates);
    onClose();
  };

  const toPercent = (val: number) => (val * 100).toFixed(2);
  const toDenominator = (val: number) => Math.round(1 / val);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-white px-8 py-6 flex justify-between items-center border-b border-slate-100">
          <div>
             <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="bg-red-100 p-2 rounded-lg"><Settings className="w-5 h-5 text-red-600" /></div>
                Configurações de Alíquotas
             </h3>
             <p className="text-slate-600 text-sm mt-1">Ajuste os parâmetros fiscais para o cálculo de RH.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-slate-50/50">
          
          {/* Section 1: Encargos */}
          <section>
             <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield size={14} /> Encargos Sociais e Trabalhistas
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { label: 'FGTS Mensal', key: 'FGTS', desc: 'Fundo de Garantia' },
                  { label: 'INSS Patronal', key: 'INSS_PATRONAL', desc: 'Contribuição Empresa' },
                  { label: 'PIS', key: 'PIS', desc: 'Sobre Folha + Prov.' },
                  { label: 'INSS s/ Provisão', key: 'PROVISION_INSS_RATE', desc: 'Incidência futura' },
                  { label: 'Multa FGTS', key: 'MULTA_FGTS', desc: 'Rescisória (40%)' },
                ].map((item) => (
                   <div key={item.key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500 transition-all">
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">{item.label}</label>
                      <div className="relative">
                          <input 
                            type="number" step="0.1"
                            value={toPercent(rates[item.key as keyof TaxRates])} 
                            onChange={e => handleChange(item.key as keyof TaxRates, e.target.value)}
                            className="w-full text-lg font-bold text-slate-800 bg-transparent border-none p-0 pr-8 focus:ring-0 placeholder-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 font-bold pointer-events-none select-none">%</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 font-medium">{item.desc}</p>
                   </div>
                ))}
             </div>
          </section>

          {/* Section 2: Provisões */}
          <section>
             <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={14} /> Frações de Provisão (Divisores)
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-blue-600 font-bold text-xl font-mono">1/X</div>
                    <div className="flex-grow">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Divisor 1/3 Férias</label>
                        <div className="flex items-baseline gap-2">
                             <span className="text-slate-500 text-sm font-medium">1 /</span>
                             <input 
                                type="number" step="1"
                                value={toDenominator(rates.PROVISION_1_3_FERIAS)} 
                                onChange={e => handleFractionChange('PROVISION_1_3_FERIAS', e.target.value)}
                                className="w-20 font-bold text-lg text-slate-800 border-b-2 border-slate-200 focus:border-red-500 outline-none text-center bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Padrão: 36 (equivale a 1/12 de 1/3)</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-blue-600 font-bold text-xl font-mono">1/X</div>
                    <div className="flex-grow">
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Divisor 13º Salário</label>
                        <div className="flex items-baseline gap-2">
                             <span className="text-slate-500 text-sm font-medium">1 /</span>
                             <input 
                                type="number" step="1"
                                value={toDenominator(rates.PROVISION_13)} 
                                onChange={e => handleFractionChange('PROVISION_13', e.target.value)}
                                className="w-20 font-bold text-lg text-slate-800 border-b-2 border-slate-200 focus:border-red-500 outline-none text-center bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                             />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">Padrão: 12 (1 mês por ano)</p>
                    </div>
                </div>
             </div>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-white px-8 py-5 flex justify-between items-center border-t border-slate-100">
          <button 
            onClick={restoreDefaults}
            className="group flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-red-50"
          >
            <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-500" /> 
            Restaurar Padrões
          </button>
          <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 shadow-lg shadow-slate-200 flex items-center gap-2 transition-transform active:scale-95"
              >
                <Save size={16} /> Salvar Alterações
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};