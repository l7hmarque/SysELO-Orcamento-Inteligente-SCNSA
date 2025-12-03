import React, { useState } from 'react';
import { Sparkles, X, Check, Activity, TrendingUp, Target, DollarSign, Percent } from 'lucide-react';
import { BudgetItem, ReductionSuggestion } from '../types';
import { analyzeBudgetReduction } from '../services/geminiService';

interface Props {
  items: BudgetItem[];
  onApplyReduction: (suggestions: ReductionSuggestion[]) => void;
  onGlobalAdjustment: (percent: number) => void;
  onTargetAdjustment: (targetTotal: number) => void;
}

export const SmartTools: React.FC<Props> = ({ items, onApplyReduction, onGlobalAdjustment, onTargetAdjustment }) => {
  const [activeTab, setActiveTab] = useState<'PERCENT' | 'FIXED' | 'TARGET'>('PERCENT');
  
  // Percent State
  const [globalPercent, setGlobalPercent] = useState<number>(0);
  
  // Target State
  const currentTotal = items.reduce((acc, i) => acc + (i.unitValue * i.quantity * i.frequency), 0);
  const [targetTotal, setTargetTotal] = useState<number>(currentTotal);

  // AI Reduction State
  const [reductionTarget, setReductionTarget] = useState<number>(10);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<ReductionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSmartReductionAnalysis = async () => {
    if (items.length === 0) return;
    setIsAnalyzing(true);
    const result = await analyzeBudgetReduction(items, reductionTarget);
    setSuggestions(result);
    setIsAnalyzing(false);
    setShowSuggestions(true);
  };

  const confirmReduction = () => {
    onApplyReduction(suggestions);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const applyTarget = () => {
    if (targetTotal <= 0) return;
    if (window.confirm(`Isso irá ajustar proporcionalmente todos os valores para totalizar ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(targetTotal)}. Continuar?`)) {
        onTargetAdjustment(targetTotal);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Tool 1: Global Adjustment Center */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
            <button 
                onClick={() => setActiveTab('PERCENT')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'PERCENT' ? 'bg-red-50 text-red-700 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Percent size={14} /> Percentual
            </button>
            <button 
                onClick={() => setActiveTab('TARGET')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'TARGET' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Target size={14} /> Meta Final
            </button>
        </div>

        <div className="p-6 flex-grow flex flex-col justify-center">
            {activeTab === 'PERCENT' && (
                <div className="animate-in fade-in">
                    <p className="text-sm text-slate-500 mb-4 font-medium">Aplicar reajuste linear (Inflação/Deflação) em todos os itens.</p>
                    <div className="flex items-center gap-4 mb-6">
                        <input 
                            type="range" 
                            min="-50" max="50" step="1"
                            value={globalPercent}
                            onChange={e => setGlobalPercent(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                        />
                        <div className={`w-20 text-center font-bold py-1 rounded-md text-sm ${globalPercent > 0 ? 'bg-red-100 text-red-700' : globalPercent < 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                            {globalPercent > 0 ? '+' : ''}{globalPercent}%
                        </div>
                    </div>
                    <button
                        onClick={() => onGlobalAdjustment(globalPercent)}
                        disabled={globalPercent === 0}
                        className="w-full bg-red-700 text-white hover:bg-red-800 rounded-lg py-3 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Aplicar Porcentagem
                    </button>
                </div>
            )}

            {activeTab === 'TARGET' && (
                <div className="animate-in fade-in">
                     <p className="text-sm text-slate-500 mb-4 font-medium">O sistema recalculará o valor unitário de todos os itens para atingir este total exato.</p>
                     <div className="relative mb-6">
                        <span className="absolute left-3 top-3 text-slate-400 font-bold">R$</span>
                        <input 
                            type="number"
                            value={targetTotal}
                            onChange={(e) => setTargetTotal(parseFloat(e.target.value))}
                            className="w-full pl-10 pr-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-lg font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                     </div>
                     <div className="flex justify-between text-xs text-slate-400 mb-4">
                        <span>Atual: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentTotal)}</span>
                        <span>Diferença: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(targetTotal - currentTotal)}</span>
                     </div>
                     <button
                        onClick={applyTarget}
                        disabled={targetTotal <= 0}
                        className="w-full bg-blue-700 text-white hover:bg-blue-800 rounded-lg py-3 font-bold text-sm disabled:opacity-50 transition-all"
                    >
                        Atingir Meta Orçamentária
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Tool 2: AI Optimization */}
      <div className="bg-gradient-to-br from-red-900 to-red-800 p-6 rounded-xl shadow-md border border-red-700 relative overflow-hidden text-white">
        {/* Background deco */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-500 rounded-full blur-3xl opacity-20"></div>

        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm"><Sparkles className="w-5 h-5 text-red-200" /></div>
          <div>
              <h3 className="font-bold text-white">Otimização Inteligente</h3>
              <p className="text-xs text-red-200">IA sugere cortes em itens supérfluos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mb-6 relative z-10">
           <span className="text-xs font-bold text-red-200 uppercase tracking-wider">Meta de Redução:</span>
           <div className="flex-1 flex items-center bg-white/10 border border-red-500/30 rounded-lg px-3 backdrop-blur-md">
             <input
                type="number"
                value={reductionTarget}
                onChange={(e) => setReductionTarget(parseInt(e.target.value))}
                className="w-full py-2 text-sm outline-none font-semibold text-white bg-transparent placeholder-red-300"
             />
             <span className="text-red-300 text-xs font-bold">%</span>
           </div>
        </div>

        <button
          onClick={handleSmartReductionAnalysis}
          disabled={isAnalyzing || items.length === 0}
          className="relative z-10 w-full bg-white text-red-900 hover:bg-red-50 rounded-lg py-3 font-bold text-sm flex justify-center items-center shadow-lg transition-all active:scale-95"
        >
          {isAnalyzing ? <span className="animate-pulse">Analisando Orçamento...</span> : 'Gerar Sugestões de Corte'}
        </button>

        {/* Modal Overlay for Suggestions */}
        {showSuggestions && (
          <div className="absolute inset-0 bg-white z-20 p-4 flex flex-col animate-in fade-in duration-200 text-slate-800">
             <div className="flex justify-between items-center mb-3 flex-shrink-0">
               <h4 className="font-bold text-red-800 text-sm flex items-center gap-2"><TrendingUp className="rotate-180 w-4 h-4"/> Cortes Sugeridos ({suggestions.length})</h4>
               <button onClick={() => setShowSuggestions(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
             </div>
             
             <div className="flex-grow overflow-y-auto pr-1 space-y-2 mb-3 scrollbar-hide">
                 {suggestions.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-center">
                       <Check className="w-8 h-8 text-green-500 mb-2" />
                       <p className="text-xs text-slate-500">Seu orçamento já parece otimizado.</p>
                   </div>
                 ) : (
                   suggestions.map((s, idx) => {
                     const item = items.find(i => i.id === s.itemId);
                     if(!item) return null;
                     const diff = (item.unitValue * item.quantity * item.frequency) - s.suggestedValue;
                     return (
                       <div key={idx} className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 shadow-sm">
                         <div className="flex justify-between font-bold text-slate-700 mb-1">
                             <span>{item.name}</span>
                             <span className="text-red-500 bg-red-50 px-1 rounded">- R$ {diff.toFixed(2)}</span>
                         </div>
                         <div className="text-slate-500 italic leading-tight">{s.reason}</div>
                       </div>
                     )
                   })
                 )}
             </div>

             {suggestions.length > 0 && (
               <button 
                onClick={confirmReduction}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 flex-shrink-0 hover:bg-green-700 shadow-lg shadow-green-100"
               >
                 <Check className="w-4 h-4" /> Aplicar Reduções
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};