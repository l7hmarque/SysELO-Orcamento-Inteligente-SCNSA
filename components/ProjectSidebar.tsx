import React, { useState } from 'react';
import { BudgetProject } from '../types';
import { FolderPlus, Folder, Calendar, Trash2, ChevronLeft, ChevronRight, Settings } from 'lucide-react';

interface Props {
  projects: BudgetProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (title: string, start: string, end: string) => void;
  onDeleteProject: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export const ProjectSidebar: React.FC<Props> = ({ 
  projects, 
  activeProjectId, 
  onSelectProject, 
  onCreateProject, 
  onDeleteProject,
  isOpen,
  setIsOpen
}) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(newTitle && newStart && newEnd) {
          if (new Date(newEnd) < new Date(newStart)) {
              alert("Data Final não pode ser anterior à Data Inicial.");
              return;
          }
          onCreateProject(newTitle, newStart, newEnd);
          setShowNewForm(false);
          setNewTitle('');
          setNewStart('');
          setNewEnd('');
      }
  };

  return (
    <div className={`bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-300 relative z-50 ${isOpen ? 'w-80' : 'w-16'}`}>
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-3 top-8 bg-red-600 text-white rounded-full p-1 shadow-lg border border-white z-50"
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Header */}
      <div className={`p-4 border-b border-slate-700 flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
          {isOpen ? (
              <span className="text-white font-bold text-sm tracking-wider uppercase">Meus Projetos</span>
          ) : (
              <Folder className="text-white" size={24} />
          )}
      </div>

      {/* Projects List */}
      <div className="flex-grow overflow-y-auto py-4 space-y-1">
          {projects.map(proj => (
              <div 
                key={proj.id}
                className={`group relative flex items-center cursor-pointer transition-colors ${activeProjectId === proj.id ? 'bg-red-900/50 border-l-4 border-red-500' : 'hover:bg-slate-800 border-l-4 border-transparent'}`}
                onClick={() => onSelectProject(proj.id)}
              >
                  <div className={`p-3 ${isOpen ? '' : 'mx-auto'}`}>
                      <Folder size={20} className={activeProjectId === proj.id ? 'text-red-400' : 'text-slate-500'} />
                  </div>
                  
                  {isOpen && (
                      <div className="flex-grow pr-3 py-2 overflow-hidden">
                          <h4 className={`text-sm font-bold truncate ${activeProjectId === proj.id ? 'text-white' : 'text-slate-300'}`}>
                              {proj.title}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Calendar size={10} /> 
                              {new Date(proj.startDate).getFullYear()} - {new Date(proj.endDate).getFullYear()}
                          </div>
                      </div>
                  )}

                  {isOpen && activeProjectId !== proj.id && (
                       <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(proj.id); }}
                        className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-500 transition-all"
                       >
                           <Trash2 size={14} />
                       </button>
                  )}
              </div>
          ))}
      </div>

      {/* Create New Area */}
      <div className="p-4 border-t border-slate-700 bg-slate-900">
          {isOpen ? (
              showNewForm ? (
                  <form onSubmit={handleSubmit} className="bg-slate-800 p-3 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-bottom-2">
                      <h5 className="text-xs font-bold text-white mb-2 uppercase">Novo Projeto</h5>
                      <input 
                        required
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white mb-2 focus:ring-1 focus:ring-red-500 outline-none" 
                        placeholder="Nome do Projeto"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                              <label className="text-[9px] text-slate-400 uppercase">Início</label>
                              <input required type="date" className="w-full bg-slate-700 border-none rounded px-1 py-1 text-[10px] text-white" value={newStart} onChange={e => setNewStart(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-[9px] text-slate-400 uppercase">Fim</label>
                              <input required type="date" className="w-full bg-slate-700 border-none rounded px-1 py-1 text-[10px] text-white" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button type="submit" className="flex-1 bg-red-600 text-white text-xs font-bold py-1.5 rounded hover:bg-red-700">Criar</button>
                          <button type="button" onClick={() => setShowNewForm(false)} className="px-2 text-slate-400 hover:text-white text-xs">Cancelar</button>
                      </div>
                  </form>
              ) : (
                  <button 
                    onClick={() => setShowNewForm(true)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-slate-700"
                  >
                      <FolderPlus size={16} /> Novo Projeto
                  </button>
              )
          ) : (
             <button onClick={() => setIsOpen(true)} className="w-full flex justify-center py-2 text-slate-400 hover:text-white">
                 <FolderPlus size={24} />
             </button>
          )}
      </div>

    </div>
  );
};