import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Calendar, Layers, Check, Download, Upload, RefreshCw } from 'lucide-react';
import { ProjectInfo, Task, DayAvailability, ParadaEvent } from '../types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProjectModalProps {
  isOpen: boolean;
  currentProject: ProjectInfo;
  onClose: () => void;
  onCreateNewProject: (project: ProjectInfo, mode: 'blank' | 'template') => void;
  onUpdateProject: (project: ProjectInfo) => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  currentProject,
  onClose,
  onCreateNewProject,
  onUpdateProject,
  onExportData,
  onImportData
}) => {
  const [activeTab, setActiveTab] = useState<'new' | 'edit' | 'import_export'>('new');
  const [name, setName] = useState('');
  const [line, setLine] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [initMode, setInitMode] = useState<'blank' | 'template'>('template');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentProject.name || '');
      setLine(currentProject.line || 'Línea de Producción Principal');
      try {
        const d = parseISO(currentProject.startDate);
        setStartDateStr(format(d, 'yyyy-MM-dd'));
      } catch {
        setStartDateStr(format(new Date(), 'yyyy-MM-dd'));
      }
      setImportError(null);
    }
  }, [isOpen, currentProject]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let parsedDate = new Date();
    if (startDateStr) {
      const [y, m, d] = startDateStr.split('-').map(Number);
      if (y && m && d) {
        parsedDate = new Date(y, m - 1, d, 0, 0, 0);
      }
    }

    const newProj: ProjectInfo = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      line: line.trim() || 'Línea de Producción General',
      startDate: parsedDate.toISOString(),
      createdAt: new Date().toISOString()
    };

    onCreateNewProject(newProj, initMode);
    onClose();
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let parsedDate = new Date();
    if (startDateStr) {
      const [y, m, d] = startDateStr.split('-').map(Number);
      if (y && m && d) {
        parsedDate = new Date(y, m - 1, d, 0, 0, 0);
      }
    }

    const updated: ProjectInfo = {
      ...currentProject,
      name: name.trim(),
      line: line.trim() || currentProject.line,
      startDate: parsedDate.toISOString()
    };

    onUpdateProject(updated);
    onClose();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onImportData(file);
      onClose();
    } catch (err: any) {
      setImportError('Error al importar el archivo JSON: ' + (err.message || 'Formato no válido'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-brand-blue px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <FolderPlus className="w-5 h-5 text-brand-orange" />
            <div>
              <h3 className="font-bold text-base tracking-wide">
                Gestión de Proyecto y Planificación
              </h3>
              <p className="text-xs text-white/70">
                Crear nueva semana de parada, modificar parámetros o respaldar datos.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'new'
                ? 'bg-white text-brand-blue border-gray-200 -mb-px'
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            Nuevo Proyecto / Plan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'edit'
                ? 'bg-white text-brand-blue border-gray-200 -mb-px'
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            Editar Proyecto Actual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import_export')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t border-l border-r ${
              activeTab === 'import_export'
                ? 'bg-white text-brand-blue border-gray-200 -mb-px'
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-800'
            }`}
          >
            Exportar / Importar
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'new' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nombre del Proyecto / Planificación <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Parada Mayor Q3 - Laminación"
                  className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Línea de Producción / Sector
                </label>
                <input
                  type="text"
                  value={line}
                  onChange={e => setLine(e.target.value)}
                  placeholder="Ej. Línea de Producción Especiales"
                  className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Fecha de Inicio del Cronograma (Día 1)
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={e => setStartDateStr(e.target.value)}
                  className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Plantilla Inicial
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                    initMode === 'template' ? 'border-brand-blue bg-blue-50/50 text-brand-blue font-bold' : 'border-gray-200 text-gray-600'
                  }`}>
                    <input
                      type="radio"
                      name="initMode"
                      checked={initMode === 'template'}
                      onChange={() => setInitMode('template')}
                      className="text-brand-blue"
                    />
                    <div className="flex flex-col text-xs">
                      <span className="font-black">Cargar Tareas Demo</span>
                      <span className="text-[10px] text-gray-400">Incluye ejemplos en zonas</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                    initMode === 'blank' ? 'border-brand-blue bg-blue-50/50 text-brand-blue font-bold' : 'border-gray-200 text-gray-600'
                  }`}>
                    <input
                      type="radio"
                      name="initMode"
                      checked={initMode === 'blank'}
                      onChange={() => setInitMode('blank')}
                      className="text-brand-blue"
                    />
                    <div className="flex flex-col text-xs">
                      <span className="font-black">Proyecto en Blanco</span>
                      <span className="text-[10px] text-gray-400">Sin tareas precargadas</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-brand-blue rounded-lg hover:brightness-110 shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Crear Proyecto
                </button>
              </div>
            </form>
          )}

          {activeTab === 'edit' && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Nombre del Proyecto Actual
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Línea de Producción
                </label>
                <input
                  type="text"
                  value={line}
                  onChange={e => setLine(e.target.value)}
                  className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Fecha de Inicio del Cronograma
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={e => setStartDateStr(e.target.value)}
                  className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 outline-none focus:border-brand-blue"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-brand-blue rounded-lg hover:brightness-110 shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Actualizar Parámetros
                </button>
              </div>
            </form>
          )}

          {activeTab === 'import_export' && (
            <div className="space-y-5">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider mb-1 flex items-center gap-2">
                  <Download className="w-4 h-4 text-brand-blue" /> Exportar Planificación
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Descargue un respaldo completo de todas las tareas, hitos, disponibilidad de personal y configuración del proyecto en formato JSON.
                </p>
                <button
                  type="button"
                  onClick={onExportData}
                  className="px-4 py-2 text-xs font-black bg-brand-blue text-white rounded-lg hover:brightness-110 flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Descargar Respaldo JSON
                </button>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-brand-orange" /> Importar Planificación
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Cargue un archivo JSON previamente exportado para restaurar su cronograma y recursos.
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileInput}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-brand-orange file:text-white hover:file:brightness-110 cursor-pointer"
                />
                {importError && (
                  <p className="text-xs text-red-500 font-semibold mt-2">{importError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
