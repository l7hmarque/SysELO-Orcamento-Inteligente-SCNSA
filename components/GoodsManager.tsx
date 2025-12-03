import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BudgetItem, ExpenseType, PARANA_RUBRICS, Rubric } from '../types';
import { Plus, Trash2, AlertTriangle, Search, DollarSign, Loader2, ArrowRight, Package, Wrench, Monitor, Clipboard, X, Check, ListPlus, Sparkles, AlertCircle } from 'lucide-react';
import { validateRubricContext, suggestPrice } from '../services/geminiService';

interface Props {
  items: BudgetItem[];
  onAdd: (item: BudgetItem) => void;
  onUpdate: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
}

// Group definitions
const RUBRIC_GROUPS = [
    { id: 'CONSUMO', label: 'Material de Consumo', prefixes: ['3.3.90.30', '3.3.90.32'], icon: Package },
    { id: 'SERVICOS', label: 'Serviços de Terceiros', prefixes: ['3.3.90.39', '3.3.90.36'], icon: Wrench },
    { id: 'BENS', label: 'Bens Permanentes', prefixes: ['4.4.90.52'], icon: Monitor },
];

interface BulkItem {
    tempId: string;
    name: string;
    quantity: string;
    unitValue: string;
    type: ExpenseType;
    priority: 'Baixa'|'Média'|'Alta';
    isSuggesting?: boolean;
}

// Helper for Masking
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

export const GoodsManager: React.FC<Props> = ({ items, onAdd, onUpdate, onDelete }) => {
  // Tabs State
  const [activeGroupId, setActiveGroupId] = useState('CONSUMO');
  const [activeRubricCode, setActiveRubricCode] = useState(PARANA_RUBRICS[0].code);
  const [filterText, setFilterText] = useState('');
  
  // Input Refs for Agile Flow
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const valRef = useRef<HTMLInputElement>(null);

  // Form State
  const [itemName, setItemName] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<ExpenseType>(ExpenseType.RECURRING);
  const [priority, setPriority] = useState<'Baixa'|'Média'|'Alta'>('Média');
  
  // AI State
  const [validationWarning, setValidationWarning] = useState<{show: boolean, reason?: string, suggested?: Rubric} | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [suggestedPrice, setSuggestedPrice] = useState<{price: number, confidence: string} | null>(null);

  // Bulk / Paste State
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [manualPasteText, setManualPasteText] = useState('');
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [isSuggestingAll, setIsSuggestingAll] = useState(false);

  // Sync active rubric when group changes
  useEffect(() => {
      const group = RUBRIC_GROUPS.find(g => g.id === activeGroupId);
      if (group) {
          const firstInGroup = PARANA_RUBRICS.find(r => group.prefixes.some(p => r.code.startsWith(p)));
          if (firstInGroup && !group.prefixes.some(p => activeRubricCode.startsWith(p))) {
              setActiveRubricCode(firstInGroup.code);
          }
      }
  }, [activeGroupId]);

  const activeRubric = PARANA_RUBRICS.find(r => r.code === activeRubricCode) || PARANA_RUBRICS[0];

  const currentRubricItems = useMemo(() => {
    return items.filter(i => i.rubricCode === activeRubricCode && i.name.toLowerCase().includes(filterText.toLowerCase()));
  }, [items, activeRubricCode, filterText]);

  const currentRubricTotal = useMemo(() => {
    return currentRubricItems.reduce((acc, i) => acc + (i.unitValue * i.quantity * i.frequency), 0);
  }, [currentRubricItems]);

  const agilePreviewTotal = useMemo(() => {
      const q = parseFloat(quantity.replace(',', '.')) || 0;
      const v = parseCurrency(unitValue);
      const freq = type === ExpenseType.RECURRING ? 12 : 1;
      return q * v * freq;
  }, [quantity, unitValue, type]);

  const getRubricCount = (code: string) => items.filter(i => i.rubricCode === code).length;

  const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
      setter(formatCurrencyMask(e.target.value));
  };

  const handleNameKeyDown = async (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (itemName.length > 3) {
             suggestPrice(itemName).then(res => setSuggestedPrice(res));
          }
          qtyRef.current?.focus();
      }
      if ((e.key === ' ' || e.key === 'Tab') && suggestedPrice && !unitValue) {
          if (e.key === 'Tab') e.preventDefault(); 
          setUnitValue(suggestedPrice.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
          if (e.key === 'Tab') qtyRef.current?.focus();
      }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          valRef.current?.focus();
      }
  };

  const handleValKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestedPrice && !unitValue) {
          e.preventDefault();
          setUnitValue(suggestedPrice.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
          return;
      }
      if (e.key === 'Enter') {
          e.preventDefault();
          handleAgileSubmit();
      }
  };

  const parseImportText = (text: string): BulkItem[] => {
      const rows = text.split(/\r?\n/).filter(line => line.trim());
      if (rows.length === 0) return [];

      return rows.map(row => {
          const cols = row.split(/\t/);
          let name = cols[0].trim();
          let qty = "1";
          let val = "R$ 0,00";

          if (cols.length >= 2) {
              const rawCol1 = cols[1].replace('R$', '').trim();
              const rawCol2 = cols[2] ? cols[2].replace('R$', '').trim() : '';
              const col1Num = parseFloat(rawCol1.replace('.', '').replace(',', '.'));
              const col2Num = rawCol2 ? parseFloat(rawCol2.replace('.', '').replace(',', '.')) : NaN;
              if (!isNaN(col1Num)) {
                  if (!isNaN(col2Num)) {
                      qty = rawCol1.replace('.', ',');
                      val = col2Num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  } else {
                      val = col1Num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  }
              }
          }
          return {
              tempId: crypto.randomUUID(),
              name,
              quantity: qty,
              unitValue: val,
              type: ExpenseType.RECURRING,
              priority: 'Média'
          };
      });
  };

  const processPastedData = (text: string) => {
    const parsed = parseImportText(text);
    if (parsed.length === 0) {
        alert("Nenhum dado reconhecido.");
        return;
    }
    if (parsed.length === 1) {
        const item = parsed[0];
        setItemName(item.name);
        setQuantity(item.quantity);
        setUnitValue(item.unitValue);
        nameRef.current?.focus();
    } else {
        setBulkItems(parsed);
    }
    setShowPasteModal(false);
    setManualPasteText('');
  };

  const handleClipboardPaste = async () => {
      try {
          const text = await navigator.clipboard.readText();
          if (text) {
              processPastedData(text);
          }
      } catch (err) {
          setShowPasteModal(true);
      }
  };

  const updateBulkItem = (id: string, field: keyof BulkItem, value: any) => {
      if (field === 'unitValue') value = formatCurrencyMask(value);
      setBulkItems(prev => prev.map(i => i.tempId === id ? { ...i, [field]: value } : i));
  };

  const removeBulkItem = (id: string) => {
      setBulkItems(prev => prev.filter(i => i.tempId !== id));
  };

  const handleBulkSuggestPrice = async (tempId: string, name: string) => {
    if (!name || name.length < 3) return;
    setBulkItems(prev => prev.map(i => i.tempId === tempId ? { ...i, isSuggesting: true } : i));
    try {
        const result = await suggestPrice(name);
        if (result) {
            setBulkItems(prev => prev.map(i => i.tempId === tempId ? { 
                ...i, 
                unitValue: result.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                isSuggesting: false 
            } : i));
        } else {
             setBulkItems(prev => prev.map(i => i.tempId === tempId ? { ...i, isSuggesting: false } : i));
        }
    } catch (e) {
        setBulkItems(prev => prev.map(i => i.tempId === tempId ? { ...i, isSuggesting: false } : i));
    }
  };

  const handleSuggestAllBulk = async () => {
      setIsSuggestingAll(true);
      const itemsToProcess = bulkItems.filter(i => i.name && (!i.unitValue || i.unitValue === 'R$ 0,00' || i.unitValue === ''));
      for (const item of itemsToProcess) {
          setBulkItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, isSuggesting: true } : i));
          try {
            const res = await suggestPrice(item.name);
            if (res) {
                setBulkItems(prev => prev.map(i => i.tempId === item.tempId ? { 
                    ...i, 
                    unitValue: res.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    isSuggesting: false 
                } : i));
            } else {
                setBulkItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, isSuggesting: false } : i));
            }
          } catch(e) {
             setBulkItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, isSuggesting: false } : i));
          }
      }
      setIsSuggestingAll(false);
  };

  const submitBulkItems = () => {
      let count = 0;
      bulkItems.forEach(b => {
          if (b.name) {
             const rawVal = parseCurrency(b.unitValue);
             onAdd({
                id: crypto.randomUUID(),
                name: b.name,
                rubricCode: activeRubric.code,
                rubricDesc: activeRubric.description,
                type: b.type,
                unitValue: rawVal,
                quantity: parseFloat(b.quantity.replace(',', '.')),
                frequency: b.type === ExpenseType.RECURRING ? 12 : 1,
                priority: b.priority
             });
             count++;
          }
      });
      setBulkItems([]);
      alert(`${count} itens adicionados com sucesso!`);
  };

  const handleAgileSubmit = async () => {
    if (!itemName || !unitValue) return;
    setIsValidating(true);
    const check = await validateRubricContext(itemName, activeRubric);
    setIsValidating(false);
    if (!check.isValid && check.suggestedRubric) {
      setValidationWarning({ show: true, reason: check.reason, suggested: check.suggestedRubric });
      return; 
    }
    finalizeAddItem();
  };

  const finalizeAddItem = (overrideRubric?: Rubric) => {
    const rubricToUse = overrideRubric || activeRubric;
    const newItem: BudgetItem = {
      id: crypto.randomUUID(),
      name: itemName,
      rubricCode: rubricToUse.code,
      rubricDesc: rubricToUse.description,
      type,
      unitValue: parseCurrency(unitValue),
      quantity: parseFloat(quantity.replace(',', '.')),
      frequency: type === ExpenseType.RECURRING ? 12 : 1,
      priority
    };
    onAdd(newItem);
    setItemName('');
    setUnitValue('');
    setQuantity('1');
    setSuggestedPrice(null);
    setValidationWarning(null);
    setPriority('Média');
    if (overrideRubric) {
        const group = RUBRIC_GROUPS.find(g => g.prefixes.some(p => overrideRubric.code.startsWith(p)));
        if (group) setActiveGroupId(group.id);
        setActiveRubricCode(overrideRubric.code);
    }
    nameRef.current?.focus();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6">
      
      {/* 1. Macro Category Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
            {RUBRIC_GROUPS.map(group => {
                const Icon = group.icon;
                const isActive = activeGroupId === group.id;
                return (
                    <button
                        key={group.id}
                        onClick={() => setActiveGroupId(group.id)}
                        className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider flex flex-col md:flex-row items-center justify-center gap-2 transition-colors ${isActive ? 'bg-red-50 text-red-800 border-b-2 border-red-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Icon size={18} className={isActive ? 'text-red-600' : 'text-slate-400'}/>
                        {group.label}
                    </button>
                )
            })}
        </div>
        
        {/* 2. Sub-Tabs */}
        <div className="bg-slate-50/50 p-2">
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {PARANA_RUBRICS
                .filter(rubric => {
                    const group = RUBRIC_GROUPS.find(g => g.id === activeGroupId);
                    return group?.prefixes.some(p => rubric.code.startsWith(p));
                })
                .map(rubric => {
                    const count = getRubricCount(rubric.code);
                    return (
                        <button
                        key={rubric.code}
                        onClick={() => setActiveRubricCode(rubric.code)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap flex items-center gap-2 border ${
                            activeRubricCode === rubric.code
                            ? 'bg-white border-red-200 text-red-700 shadow-sm ring-1 ring-red-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                        >
                        {rubric.shortName}
                        {count > 0 && (
                            <span className={`text-[9px] px-1.5 rounded-full ${activeRubricCode === rubric.code ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
                                {count}
                            </span>
                        )}
                        </button>
                    )
                })}
            </div>
        </div>
      </div>

      {/* 3. INPUT AREA (Agile OR Bulk) */}
      <div className={`rounded-xl shadow-md border relative transition-all duration-300 overflow-hidden ${bulkItems.length > 0 ? 'bg-blue-50/50 border-blue-200 ring-4 ring-blue-50' : 'bg-white border-l-4 border-l-red-500 border-y-slate-100 border-r-slate-100'}`}>
        
        {/* Header Bar */}
        <div className={`flex justify-between items-center p-5 ${bulkItems.length > 0 ? 'bg-blue-100/50 border-b border-blue-200' : 'bg-white'}`}>
            <h4 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                {bulkItems.length > 0 ? (
                    <><ListPlus className="w-5 h-5 text-blue-600" /> Inserção em Lote ({bulkItems.length})</>
                ) : (
                    <><Plus className="w-4 h-4 text-red-500" /> Adicionar: <span className="text-red-600">{activeRubric.description}</span></>
                )}
            </h4>
            <div className="flex items-center gap-3">
                {bulkItems.length > 0 && (
                    <button 
                        onClick={handleSuggestAllBulk}
                        disabled={isSuggestingAll}
                        className="text-[10px] font-bold text-purple-600 hover:bg-purple-50 hover:text-purple-800 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-purple-200 transition-colors shadow-sm bg-white"
                    >
                        {isSuggestingAll ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                        Sugerir Preços (IA)
                    </button>
                )}
                
                <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded hidden md:block">
                    {activeRubric.code}
                </div>
                <button 
                    onClick={handleClipboardPaste}
                    className="text-[10px] font-bold text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-slate-200 bg-white shadow-sm"
                >
                    <Clipboard size={14}/> Colar (Excel)
                </button>
            </div>
        </div>
        
        <div className="p-5">
        {bulkItems.length === 0 ? (
            // STANDARD SINGLE INPUT MODE
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Descrição do Item</label>
                    <input 
                        ref={nameRef}
                        autoFocus
                        type="text" 
                        value={itemName} 
                        onChange={e => setItemName(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        onFocus={(e) => e.target.select()}
                        placeholder="Digite o nome e tecle ENTER..."
                        className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-red-500 focus:bg-white transition-all h-10 px-3 text-slate-700"
                    />
                </div>
                
                <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Qtd</label>
                    <input 
                        ref={qtyRef}
                        type="text"
                        value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^0-9,]/g, ''))}
                        onKeyDown={handleQtyKeyDown}
                        onFocus={(e) => e.target.select()}
                        className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-red-500 focus:bg-white h-10 px-3 text-center text-slate-700"
                    />
                </div>

                <div className="md:col-span-2 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Valor Unit.</label>
                    <input 
                        ref={valRef}
                        type="text"
                        value={unitValue} onChange={e => handleCurrencyInput(e, setUnitValue)}
                        onKeyDown={handleValKeyDown}
                        onFocus={(e) => e.target.select()}
                        placeholder="R$ 0,00"
                        className="w-full border-slate-200 bg-slate-50 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-red-500 focus:bg-white h-10 px-3 text-slate-700"
                    />
                    {suggestedPrice && !unitValue && (
                        <div className="absolute top-10 right-3 text-xs text-blue-500 pointer-events-none flex items-center gap-1 animate-pulse bg-white/80 px-1 rounded">
                            <DollarSign size={10} /> Sugestão: {suggestedPrice.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                    )}
                </div>

                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Recorrência</label>
                    <select 
                        value={type} onChange={e => setType(e.target.value as ExpenseType)}
                        className="w-full border-slate-200 bg-slate-50 rounded-lg text-xs shadow-sm h-10 focus:ring-2 focus:ring-red-500 text-slate-700"
                    >
                        <option value={ExpenseType.RECURRING}>Mensal (x12)</option>
                        <option value={ExpenseType.ONE_OFF}>Único (x1)</option>
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Prioridade</label>
                    <select 
                        value={priority} onChange={e => setPriority(e.target.value as any)}
                        className="w-full border-slate-200 bg-slate-50 rounded-lg text-xs shadow-sm h-10 focus:ring-2 focus:ring-red-500 text-slate-700"
                    >
                        <option value="Média">Média</option>
                        <option value="Alta">Alta</option>
                        <option value="Baixa">Baixa</option>
                    </select>
                </div>

                <div className="md:col-span-1">
                     <div className="hidden md:flex flex-col items-center justify-center mb-1">
                        <span className="text-[8px] uppercase text-slate-400 font-bold">Total</span>
                        <span className="text-[10px] text-red-600 font-bold">{formatCurrency(agilePreviewTotal)}</span>
                     </div>
                    <button 
                        onClick={handleAgileSubmit}
                        disabled={isValidating}
                        className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md shadow-red-200 flex items-center justify-center gap-2 h-10 transition-transform active:scale-95"
                    >
                        {isValidating ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus size={18}/>}
                    </button>
                </div>
            </div>
        ) : (
            // BULK INPUT MODE
            <div className="animate-in fade-in slide-in-from-top-2">
                <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-hide border rounded-lg border-blue-200 shadow-sm bg-white">
                    {/* Header */}
                    <div className="sticky top-0 bg-blue-50/90 backdrop-blur-sm z-10 grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-blue-100">
                        <div className="col-span-4">Descrição</div>
                        <div className="col-span-2">Tipo</div>
                        <div className="col-span-2">Prioridade</div>
                        <div className="col-span-1 text-center">Qtd</div>
                        <div className="col-span-2 text-right">Valor (R$)</div>
                        <div className="col-span-1 text-right">Total</div>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                        {bulkItems.map((item, idx) => {
                            const rawQ = parseFloat(item.quantity.replace(',', '.')) || 0;
                            const rawV = parseCurrency(item.unitValue);
                            const freq = item.type === ExpenseType.RECURRING ? 12 : 1;
                            const rowTotal = rawQ * rawV * freq;

                            return (
                            <div key={item.tempId} className="grid grid-cols-12 gap-4 items-center px-4 py-2 hover:bg-slate-50 transition-colors group">
                                <div className="col-span-4">
                                    <input 
                                        value={item.name} 
                                        onChange={e => updateBulkItem(item.tempId, 'name', e.target.value)}
                                        className="w-full bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 p-0 placeholder-slate-300"
                                        placeholder="Nome do Item"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <select 
                                        value={item.type} 
                                        onChange={e => updateBulkItem(item.tempId, 'type', e.target.value)}
                                        className="w-full bg-transparent border-none text-[10px] p-0 text-slate-600 focus:ring-0 cursor-pointer hover:text-blue-600"
                                    >
                                        <option value={ExpenseType.RECURRING}>Mensal</option>
                                        <option value={ExpenseType.ONE_OFF}>Único</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <select 
                                        value={item.priority} 
                                        onChange={e => updateBulkItem(item.tempId, 'priority', e.target.value)}
                                        className={`w-full bg-transparent border-none text-[10px] p-0 focus:ring-0 cursor-pointer font-bold ${item.priority === 'Alta' ? 'text-red-500' : item.priority === 'Baixa' ? 'text-green-500' : 'text-slate-500'}`}
                                    >
                                        <option value="Baixa">Baixa</option>
                                        <option value="Média">Média</option>
                                        <option value="Alta">Alta</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <input 
                                        value={item.quantity} 
                                        onChange={e => updateBulkItem(item.tempId, 'quantity', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded text-xs text-center py-1 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
                                    />
                                </div>
                                <div className="col-span-2 relative group-input">
                                    <input 
                                        value={item.unitValue} 
                                        onChange={e => updateBulkItem(item.tempId, 'unitValue', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded text-xs text-right py-1 pr-7 focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono transition-all text-slate-700"
                                    />
                                    <button 
                                        onClick={() => handleBulkSuggestPrice(item.tempId, item.name)}
                                        className="absolute right-1 top-1 text-slate-300 hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Sugerir Preço (IA)"
                                        disabled={item.isSuggesting}
                                    >
                                        {item.isSuggesting ? <Loader2 size={12} className="animate-spin text-purple-500"/> : <Sparkles size={12}/>}
                                    </button>
                                </div>
                                <div className="col-span-1 text-right flex items-center justify-end gap-2">
                                    <span className="text-[10px] font-bold text-slate-600">{formatCurrency(rowTotal)}</span>
                                    <button onClick={() => removeBulkItem(item.tempId)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
                
                <div className="flex justify-between items-center mt-4">
                    <div className="text-xs text-blue-600 flex items-center gap-1 bg-blue-100 px-2 py-1 rounded">
                         <AlertCircle size={12} /> Verifique os tipos e prioridades antes de salvar.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setBulkItems([])} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3">Cancelar</button>
                        <button 
                            onClick={submitBulkItems}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transform active:scale-95 transition-all"
                        >
                            <Check size={16} /> Confirmar {bulkItems.length} Itens
                        </button>
                    </div>
                </div>
            </div>
        )}
        </div>

        {validationWarning && (
             <div className="absolute top-full left-0 mt-2 w-full z-20 bg-amber-50 border border-amber-300 p-4 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                    <div className="bg-amber-100 p-2 rounded-full"><AlertTriangle className="text-amber-600 w-5 h-5" /></div>
                    <div className="flex-grow">
                        <h5 className="font-bold text-amber-900">Inconsistência Detectada</h5>
                        <p className="text-xs text-amber-700 mb-3">{validationWarning.reason}</p>
                        <div className="flex gap-2">
                            {validationWarning.suggested && (
                                <button onClick={() => finalizeAddItem(validationWarning.suggested)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm"><ArrowRight size={12} /> Mover para {validationWarning.suggested.shortName}</button>
                            )}
                            <button onClick={() => finalizeAddItem()} className="bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50">Ignorar e Manter</button>
                        </div>
                    </div>
                </div>
             </div>
        )}
      </div>

      {/* 4. Detail Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="relative">
                 <Search className="absolute left-2 top-2 text-slate-400 w-4 h-4" />
                 <input 
                    type="text" 
                    placeholder="Filtrar..." 
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="pl-8 py-1.5 bg-white border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-red-500 w-48 transition-all"
                 />
             </div>
             <div className="text-right">
                 <div className="text-[10px] uppercase font-bold text-slate-500">Total Rubrica</div>
                 <div className="text-lg font-bold text-slate-800 leading-none">{formatCurrency(currentRubricTotal)}</div>
             </div>
         </div>
         
         <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider">
                 <tr>
                     <th className="px-5 py-3">Item</th>
                     <th className="px-5 py-3">Tipo</th>
                     <th className="px-5 py-3 text-center">Prioridade</th>
                     <th className="px-5 py-3 text-right">Unitário</th>
                     <th className="px-5 py-3 text-center">Qtd</th>
                     <th className="px-5 py-3 text-right">Total Anual</th>
                     <th className="px-5 py-3 text-center">Ações</th>
                 </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                 {currentRubricItems.map(item => (
                     <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-5 py-3 font-medium text-slate-700">{item.name}</td>
                         <td className="px-5 py-3">
                             <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${item.type === ExpenseType.RECURRING ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                 {item.type === ExpenseType.RECURRING ? 'Mensal' : 'Único'}
                             </span>
                         </td>
                         <td className="px-5 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.priority === 'Alta' ? 'bg-red-100 text-red-700' : item.priority === 'Baixa' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {item.priority}
                            </span>
                         </td>
                         <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(item.unitValue)}</td>
                         <td className="px-5 py-3 text-center font-mono text-slate-500">{item.quantity} <span className="text-[10px] text-slate-400">x{item.frequency}</span></td>
                         <td className="px-5 py-3 text-right font-bold text-slate-900 bg-slate-50/50">
                             {formatCurrency(item.unitValue * item.quantity * item.frequency)}
                         </td>
                         <td className="px-5 py-3 text-center">
                             <button onClick={() => onDelete(item.id)} className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-md transition-all">
                                 <Trash2 size={16} />
                             </button>
                         </td>
                     </tr>
                 ))}
                 {currentRubricItems.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">Nenhum item encontrado nesta rubrica.</td></tr>
                 )}
             </tbody>
         </table>
      </div>

      {showPasteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
                  <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Clipboard size={18}/> Colar Dados Manualmente</h3>
                      <button onClick={() => setShowPasteModal(false)}><X size={20} className="text-slate-400 hover:text-red-500"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-slate-600 mb-3">Cole seus dados abaixo (Ctrl+V) e clique em Processar.</p>
                      <textarea
                        autoFocus
                        value={manualPasteText}
                        onChange={(e) => setManualPasteText(e.target.value)}
                        className="w-full h-40 p-3 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50"
                        placeholder={`Exemplo:\nArroz 5kg\t10\tR$ 25,00\nFeijão\t20\t8,50`}
                      />
                  </div>
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                      <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:text-slate-700">Cancelar</button>
                      <button onClick={() => processPastedData(manualPasteText)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100">Processar Dados</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};