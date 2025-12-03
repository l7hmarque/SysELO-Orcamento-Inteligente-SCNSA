import React, { useState } from 'react';
import { Upload, AlertTriangle, Check, X, FileSpreadsheet, Loader2, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '../utils/excelImport';
import { auditImportedData } from '../services/geminiService';
import { BudgetItem } from '../types';

interface Props {
    onImportConfirmed: (items: BudgetItem[]) => void;
}

export const AuditManager: React.FC<Props> = ({ onImportConfirmed }) => {
    const [step, setStep] = useState<'UPLOAD' | 'AUDIT'>('UPLOAD');
    const [isLoading, setIsLoading] = useState(false);
    const [auditData, setAuditData] = useState<{ items: BudgetItem[], warnings: string[] } | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const rawData = await parseExcelFile(file);
            const result = await auditImportedData(rawData);
            setAuditData(result);
            setStep('AUDIT');
        } catch (err) {
            alert('Erro ao ler arquivo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRow = (id: string) => {
        if (auditData) {
            setAuditData({
                ...auditData,
                items: auditData.items.filter(i => i.id !== id)
            });
        }
    };

    const handleUpdateRow = (id: string, field: keyof BudgetItem, value: any) => {
        if (!auditData) return;
        setAuditData({
            ...auditData,
            items: auditData.items.map(i => i.id === id ? { ...i, [field]: value } : i)
        });
    };

    const handleFinish = () => {
        if (auditData) {
            onImportConfirmed(auditData.items);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
            {/* Header */}
            <div className="bg-red-900 p-6 rounded-t-xl text-white flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="text-red-400" /> Auditoria de Planilha Externa
                    </h2>
                    <p className="text-red-200 text-sm mt-1">Importe, analise inconsistências e limpe dados antes de adicionar ao orçamento.</p>
                </div>
                {step === 'AUDIT' && (
                    <button 
                        onClick={() => setStep('UPLOAD')}
                        className="text-xs bg-red-800 hover:bg-red-700 px-3 py-1 rounded text-red-200"
                    >
                        Reiniciar
                    </button>
                )}
            </div>

            <div className="flex-grow p-8">
                {step === 'UPLOAD' && (
                    <div className="h-full flex flex-col items-center justify-center space-y-6">
                        <div className="w-full max-w-xl border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-red-50 hover:border-red-300 transition-all p-12 text-center relative">
                            {isLoading ? (
                                <div className="flex flex-col items-center animate-in fade-in">
                                    <Loader2 className="animate-spin text-red-600 w-12 h-12 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-700">A Inteligência Artificial está analisando...</h3>
                                    <p className="text-slate-500">Identificando rubricas, valores atípicos e erros de formatação.</p>
                                </div>
                            ) : (
                                <>
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="bg-white p-4 rounded-full shadow-sm inline-block mb-4">
                                        <Upload className="text-red-600 w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700">Clique ou arraste sua planilha aqui</h3>
                                    <p className="text-slate-500 text-sm mt-2">Suporta arquivos .xlsx com múltiplas abas.</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {step === 'AUDIT' && auditData && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        {/* Warnings Board */}
                        {auditData.warnings.length > 0 && (
                            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                                <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
                                    <AlertTriangle size={18} /> Inconsistências Detectadas pela IA
                                </h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    {auditData.warnings.map((warn, i) => (
                                        <li key={i} className="text-sm text-amber-700">{warn}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Interactive Table */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <span className="font-bold text-slate-700 text-sm">Pré-visualização dos Dados ({auditData.items.length} itens)</span>
                                <span className="text-xs text-slate-500">Edite os valores diretamente ou exclua linhas inválidas.</span>
                            </div>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3">Descrição</th>
                                            <th className="px-4 py-3">Rubrica Sugerida</th>
                                            <th className="px-4 py-3 w-24">Qtd</th>
                                            <th className="px-4 py-3 w-32">Valor (R$)</th>
                                            <th className="px-4 py-3 w-16 text-center">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {auditData.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50 group">
                                                <td className="px-4 py-2">
                                                    <input 
                                                        value={item.name} 
                                                        onChange={(e) => handleUpdateRow(item.id, 'name', e.target.value)}
                                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-700 font-medium"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded w-fit">{item.rubricCode}</span>
                                                        <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{item.rubricDesc}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number"
                                                        value={item.quantity} 
                                                        onChange={(e) => handleUpdateRow(item.id, 'quantity', parseFloat(e.target.value))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right focus:bg-white"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number"
                                                        value={item.unitValue} 
                                                        onChange={(e) => handleUpdateRow(item.id, 'unitValue', parseFloat(e.target.value))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right focus:bg-white font-mono"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button 
                                                        onClick={() => handleDeleteRow(item.id)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                                        title="Descartar linha"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {step === 'AUDIT' && (
                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-4">
                    <div className="mr-auto flex items-center gap-2 text-slate-500 text-sm">
                        <AlertCircle size={16} />
                        <span>Verifique se todos os itens "Lixo" foram removidos.</span>
                    </div>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm"
                    >
                        Descartar Tudo
                    </button>
                    <button 
                        onClick={handleFinish}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 font-bold text-sm flex items-center gap-2"
                    >
                        <Check size={18} /> Aprovar e Importar
                    </button>
                </div>
            )}
        </div>
    );
};