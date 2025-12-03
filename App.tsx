import React, { useState, useEffect } from 'react';
import { Box, Users, ClipboardCheck, FileSpreadsheet, Settings } from 'lucide-react';
import { GoodsManager } from './components/GoodsManager';
import { HRManager } from './components/HRManager';
import { SmartTools } from './components/SmartTools';
import { AuditManager } from './components/AuditManager';
import { ProjectSidebar } from './components/ProjectSidebar';
import { SettingsModal } from './components/SettingsModal';
import { generateSpreadsheet } from './utils/excelExport';
import { BudgetItem, HRItem, ReductionSuggestion, calculateHRValues, BudgetProject, TaxRates, DEFAULT_TAX_RATES } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GOODS' | 'HR' | 'AUDIT'>('GOODS');
  const [logoError, setLogoError] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Tax Rates State
  const [taxRates, setTaxRates] = useState<TaxRates>(() => {
      const saved = localStorage.getItem('scfv_tax_rates');
      return saved ? JSON.parse(saved) : DEFAULT_TAX_RATES;
  });

  // Save Tax Rates
  useEffect(() => {
      localStorage.setItem('scfv_tax_rates', JSON.stringify(taxRates));
  }, [taxRates]);

  // State for Projects
  const [projects, setProjects] = useState<BudgetProject[]>(() => {
    const saved = localStorage.getItem('scfv_projects');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // MIGRATION LOGIC
  useEffect(() => {
    const oldItems = localStorage.getItem('scfv_items');
    const oldHr = localStorage.getItem('scfv_hr');
    
    if (projects.length === 0 && (oldItems || oldHr)) {
        const legacyProject: BudgetProject = {
            id: crypto.randomUUID(),
            title: 'Meu Orçamento (Migrado)',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            items: oldItems ? JSON.parse(oldItems) : [],
            hrItems: oldHr ? JSON.parse(oldHr) : [],
            createdAt: Date.now(),
            lastModified: Date.now()
        };
        setProjects([legacyProject]);
        setActiveProjectId(legacyProject.id);
        localStorage.removeItem('scfv_items');
        localStorage.removeItem('scfv_hr');
    } else if (projects.length > 0 && !activeProjectId) {
        setActiveProjectId(projects[0].id);
    } else if (projects.length === 0) {
        const defaultProject: BudgetProject = {
            id: crypto.randomUUID(),
            title: 'Novo Orçamento 2025',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            items: [],
            hrItems: [],
            createdAt: Date.now(),
            lastModified: Date.now()
        };
        setProjects([defaultProject]);
        setActiveProjectId(defaultProject.id);
    }
  }, []);

  // Persistence
  useEffect(() => {
    if(projects.length > 0) {
        localStorage.setItem('scfv_projects', JSON.stringify(projects));
    }
  }, [projects]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const items = activeProject?.items || [];
  const hrItems = activeProject?.hrItems || [];

  const totalGoods = items.reduce((acc, item) => acc + (item.unitValue * item.quantity * item.frequency), 0);
  const totalHR = hrItems.reduce((acc, hr) => acc + calculateHRValues(hr, taxRates).totalAnual, 0);
  const grandTotal = totalGoods + totalHR;

  // Project Actions
  const handleCreateProject = (title: string, startDate: string, endDate: string) => {
      const newProj: BudgetProject = {
          id: crypto.randomUUID(),
          title,
          startDate,
          endDate,
          items: [],
          hrItems: [],
          createdAt: Date.now(),
          lastModified: Date.now()
      };
      setProjects([...projects, newProj]);
      setActiveProjectId(newProj.id);
  };

  const handleDeleteProject = (id: string) => {
      if(projects.length <= 1) {
          alert("Você precisa ter pelo menos um projeto ativo.");
          return;
      }
      if(window.confirm("Tem certeza que deseja excluir este projeto?")) {
          const newProjs = projects.filter(p => p.id !== id);
          setProjects(newProjs);
          if (activeProjectId === id) setActiveProjectId(newProjs[0].id);
      }
  };

  const updateActiveProject = (updatedData: Partial<BudgetProject>) => {
      setProjects(projects.map(p => 
          p.id === activeProjectId ? { ...p, ...updatedData, lastModified: Date.now() } : p
      ));
  };

  // Handlers
  const handleAddItem = (newItem: BudgetItem) => { updateActiveProject({ items: [...items, newItem] }); };
  const handleDeleteItem = (id: string) => { if(window.confirm('Remover item?')) updateActiveProject({ items: items.filter(i => i.id !== id) }); };
  const handleUpdateItem = (u: BudgetItem) => { updateActiveProject({ items: items.map(i => i.id === u.id ? u : i) }); };
  const handleAddHR = (item: HRItem) => { updateActiveProject({ hrItems: [...hrItems, item] }); };
  const handleDeleteHR = (id: string) => { updateActiveProject({ hrItems: hrItems.filter(i => i.id !== id) }); };

  const handleImportConfirmed = (importedItems: BudgetItem[]) => {
      updateActiveProject({ items: [...items, ...importedItems] });
      setActiveTab('GOODS');
      alert(`${importedItems.length} itens importados!`);
  };

  const handleGlobalAdjustment = (percent: number) => {
    if(percent === 0) return;
    const factor = 1 + (percent / 100);
    if(window.confirm(`Aplicar ${percent}% sobre BENS E SERVIÇOS do projeto "${activeProject.title}"?`)) {
        updateActiveProject({
            items: items.map(item => ({ ...item, unitValue: parseFloat((item.unitValue * factor).toFixed(2)) }))
        });
    }
  };

  const handleTargetAdjustment = (target: number) => {
      if (items.length === 0) return;
      const current = items.reduce((acc, i) => acc + (i.unitValue * i.quantity * i.frequency), 0);
      if (current === 0) return;
      const ratio = target / current;
      updateActiveProject({
        items: items.map(item => ({ ...item, unitValue: parseFloat((item.unitValue * ratio).toFixed(2)) }))
      });
  };

  const handleApplyReduction = (suggestions: ReductionSuggestion[]) => {
    const newItems = [...items];
    suggestions.forEach(s => {
      if (s.section === 'GOODS') {
          const index = newItems.findIndex(i => i.id === s.itemId);
          if (index !== -1) {
            const item = newItems[index];
            const denominator = item.quantity * item.frequency;
            if (denominator > 0) {
              const newUnit = s.suggestedValue / denominator;
              newItems[index] = { ...item, unitValue: parseFloat(newUnit.toFixed(2)) };
            }
          }
      }
    });
    updateActiveProject({ items: newItems });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter text-slate-800 overflow-hidden">
      
      <ProjectSidebar 
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-grow flex flex-col h-screen overflow-hidden">
        
        {/* Header with Gradient */}
        <header className="bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-white shadow-xl z-40 flex-shrink-0 relative">
            {/* Deco Line */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
            
            <div className="w-full px-6 h-24 flex items-center justify-between">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-white rounded-xl p-1 shadow-lg flex items-center justify-center overflow-hidden transform hover:scale-105 transition-transform duration-300">
                    {logoError ? (
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            <rect width="100" height="100" fill="#f8fafc"/>
                            <path d="M20 20 h20 v20 h-20 z" fill="#DC2626"/>
                            <path d="M60 20 h20 v20 h-20 z" fill="#DC2626"/>
                            <path d="M20 60 h20 v20 h-20 z" fill="#DC2626"/>
                            <path d="M60 60 h20 v20 h-20 z" fill="#DC2626"/>
                        </svg>
                    ) : (
                        <img 
                            src="logo.png" 
                            alt="Logo SCNSA" 
                            className="w-full h-full object-contain"
                            onError={() => setLogoError(true)}
                        />
                    )}
                </div>
                <div>
                <h1 className="text-lg md:text-xl font-bold leading-tight tracking-wide uppercase font-serif text-white/95">Sociedade Civil<br/>Nossa Senhora Aparecida</h1>
                <p className="text-[10px] md:text-xs text-red-200 uppercase tracking-widest font-semibold mt-1 bg-red-950/30 inline-block px-2 py-0.5 rounded">
                    {activeProject ? activeProject.title : 'Sistema de Orçamentos'}
                </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="hidden md:block text-right pr-6 border-r border-red-700/50">
                    <span className="text-[10px] text-red-300 font-bold uppercase block tracking-wider mb-0.5">Total do Plano</span>
                    <span className="text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotal)}
                    </span>
                </div>
                
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2.5 bg-red-800/50 hover:bg-red-700 text-red-100 rounded-lg shadow-sm border border-red-700 hover:border-red-500 transition-all"
                    title="Configurações de Alíquotas"
                >
                    <Settings className="w-5 h-5" />
                </button>

                <button
                onClick={() => generateSpreadsheet(items, hrItems, activeProject ? activeProject.title : 'Plano_Trabalho', taxRates)}
                disabled={!activeProject}
                className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 font-bold text-sm gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar
                </button>
            </div>
            </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-grow overflow-y-auto px-4 md:px-8 py-8 scrollbar-hide bg-slate-50/50">
            {activeProject ? (
                <div className="max-w-7xl mx-auto">
                    {/* Navigation Tabs */}
                    <div className="flex space-x-1 mb-6 border-b border-slate-200">
                        <button 
                            onClick={() => setActiveTab('GOODS')}
                            className={`flex items-center gap-2 py-3 px-6 text-sm font-bold border-b-2 transition-all ${activeTab === 'GOODS' ? 'border-red-600 text-red-700 bg-white/80 backdrop-blur-sm rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-t-lg'}`}
                        >
                            <Box size={16} /> Bens e Serviços
                        </button>
                        <button 
                            onClick={() => setActiveTab('HR')}
                            className={`flex items-center gap-2 py-3 px-6 text-sm font-bold border-b-2 transition-all ${activeTab === 'HR' ? 'border-red-600 text-red-700 bg-white/80 backdrop-blur-sm rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-t-lg'}`}
                        >
                            <Users size={16} /> Recursos Humanos
                        </button>
                        <button 
                            onClick={() => setActiveTab('AUDIT')}
                            className={`flex items-center gap-2 py-3 px-6 text-sm font-bold border-b-2 transition-all ${activeTab === 'AUDIT' ? 'border-red-600 text-red-700 bg-white/80 backdrop-blur-sm rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-t-lg'}`}
                        >
                            <ClipboardCheck size={16} /> Auditoria
                        </button>
                    </div>

                    {activeTab === 'GOODS' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                            <SmartTools 
                                items={items} 
                                onApplyReduction={handleApplyReduction} 
                                onGlobalAdjustment={handleGlobalAdjustment}
                                onTargetAdjustment={handleTargetAdjustment}
                            />
                            <GoodsManager 
                                items={items} 
                                onAdd={handleAddItem} 
                                onUpdate={handleUpdateItem} 
                                onDelete={handleDeleteItem} 
                            />
                        </div>
                    )}
                    
                    {activeTab === 'HR' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <HRManager 
                                items={hrItems} 
                                onAdd={handleAddHR} 
                                onDelete={handleDeleteHR} 
                                taxRates={taxRates}
                            />
                        </div>
                    )}

                    {activeTab === 'AUDIT' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <AuditManager onImportConfirmed={handleImportConfirmed} />
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-pulse">
                    <Box size={48} className="mb-4 opacity-20"/>
                    <p>Selecione ou crie um projeto para começar.</p>
                </div>
            )}
        </main>
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        currentRates={taxRates}
        onSave={setTaxRates}
      />
    </div>
  );
};

export default App;