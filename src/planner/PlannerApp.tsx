import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  LayoutGrid, 
  Menu, 
  FolderPlus, 
  Search, 
  RotateCcw, 
  Download, 
  HardHat,
  Building2
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  isValid, 
  addDays 
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { 
  Task, 
  Zone, 
  Specialty, 
  SpecialtyRequirement,
  DayAvailability, 
  ParadaEvent, 
  ProjectInfo,
  ExternalSpecialty
} from './types';
import { 
  ZONES, 
  SPECIALTIES_LIST, 
  EXTERNAL_SPECIALTIES, 
  DEFAULT_PROJECT, 
  INITIAL_TASKS, 
  INITIAL_PARADAS, 
  createDefaultAvailability,
  getEffectiveSpecialtyAvailability,
  getParadaDays,
  EXEC_TYPES
} from './constants';
import { TaskModal } from './components/TaskModal';
import { ProjectModal } from './components/ProjectModal';
import { ParadaEditor } from './components/ParadaEditor';
import { PlanningBoardView } from './components/PlanningBoardView';
import { ParadasListView } from './components/ParadasListView';
import { ThirdPartySummaryView } from './components/ThirdPartySummaryView';
import { usePlannerStore } from './store/plannerStore';
import { initializePlannerPersistence, replacePersistentPlannerData } from './services/plannerPersistenceService';
import { parsePlannerBackup, plannerBackupFileName, serializePlannerBackup } from './services/plannerBackupService';
import './planner.css';

export default function PlannerApp({ embedded = false }: { embedded?: boolean }) {
  const planner = usePlannerStore();
  const { projectInfo, paradas, tasks, setProjectInfo, setParadas, setTasks } = planner;

  // --- Active View & Selection State ---
  // Views: 1. Hitos y Paradas, 2. Planificación de Tareas, 3. Resumen de Terceros
  const [view, setView] = useState<'paradas' | 'board' | 'terceros'>('board');
  const [selectedParadaId, setSelectedParadaId] = useState<string>(() => {
    return paradas[0]?.id || '';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingParadaState, setEditingParadaState] = useState<{ active: boolean; parada: ParadaEvent | null }>({
    active: false,
    parada: null
  });

  // Filters
  const [filterZone, setFilterZone] = useState<string>('ALL');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('ALL');
  const [filterCriticality, setFilterCriticality] = useState<string>('ALL');
  const [filterExecutedBy, setFilterExecutedBy] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract distinct available supervisors
  const availableSupervisors = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.responsable?.trim()) set.add(t.responsable.trim());
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Synchronize selectedParadaId if paradas list changes
  useEffect(() => {
    if (!selectedParadaId && paradas.length > 0) {
      setSelectedParadaId(paradas[0].id);
    } else if (selectedParadaId && !paradas.some(p => p.id === selectedParadaId)) {
      setSelectedParadaId(paradas[0]?.id || '');
    }
  }, [paradas, selectedParadaId]);

  useEffect(() => { void initializePlannerPersistence(); }, []);

  // Derived planning base start date
  const planningStartDate = useMemo(() => {
    try {
      const parsed = parseISO(projectInfo.startDate);
      if (isValid(parsed)) return parsed;
    } catch (e) {
      console.warn('Invalid startDate in projectInfo', e);
    }
    return new Date();
  }, [projectInfo.startDate]);

  // Currently selected Parada object
  const selectedParada = useMemo(() => {
    return paradas.find(p => p.id === selectedParadaId) || paradas[0] || null;
  }, [paradas, selectedParadaId]);

  // Filtered tasks for the board
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Must match selected parada
      if (selectedParada) {
        if (task.paradaId && task.paradaId !== selectedParada.id) return false;
      }
      if (filterZone !== 'ALL' && task.zone !== filterZone) return false;
      if (filterSupervisor !== 'ALL' && task.responsable !== filterSupervisor) return false;
      if (filterCriticality === 'CRITICAL' && task.criticality !== 'Alta') return false;
      if (filterCriticality === 'MEDIA' && task.criticality !== 'Media') return false;
      if (filterCriticality === 'BAJA' && task.criticality !== 'Baja') return false;
      if (filterExecutedBy !== 'ALL' && task.executedBy !== filterExecutedBy) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesResp = (task.responsable || '').toLowerCase().includes(query);
        const matchesJust = (task.justification || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesResp && !matchesJust) return false;
      }
      return true;
    });
  }, [tasks, selectedParada, filterZone, filterSupervisor, filterCriticality, filterExecutedBy, searchQuery]);

  // Top bar resource summary based on selected Parada
  const topResourceSummary = useMemo(() => {
    if (!selectedParada) return [];

    const daysInfo = getParadaDays(selectedParada, planningStartDate);
    const { days } = daysInfo;

    // Filter tasks for this parada
    const currentTasks = tasks.filter(t => t.paradaId ? t.paradaId === selectedParada.id : true);

    return SPECIALTIES_LIST.filter(s => !EXTERNAL_SPECIALTIES.includes(s) || s === 'MEH').map(spec => {
      let totalNeeded = 0;
      let totalAvailable = 0;

      currentTasks.forEach(task => {
        task.requirements.forEach(req => {
          if (req.specialty === spec) {
            totalNeeded += req.count * task.durationDays;
          }
        });
      });

      days.forEach(day => {
        const avail = getEffectiveSpecialtyAvailability(selectedParada, day.dateStr, spec as ExternalSpecialty);
        if (avail !== null) {
          totalAvailable += avail;
        }
      });

      return {
        spec,
        totalNeeded,
        totalAvailable,
        isOver: totalAvailable > 0 && totalNeeded > totalAvailable
      };
    });
  }, [selectedParada, tasks, planningStartDate]);

  // Auto-optimize schedule within the duration of the selected Parada
  const handleAutoOptimize = () => {
    if (!selectedParada) return;

    const daysInfo = getParadaDays(selectedParada, planningStartDate);
    const maxDays = daysInfo.durationDays;

    const paradaTasks = tasks.filter(t => t.paradaId ? t.paradaId === selectedParada.id : true);
    const otherTasks = tasks.filter(t => t.paradaId && t.paradaId !== selectedParada.id);

    // Sort tasks: Critical tasks first, then Media, then Baja
    const sortedTasks = [...paradaTasks]
      .sort((a, b) => {
        const critWeight = { Alta: 3, Media: 2, Baja: 1 };
        return (critWeight[b.criticality] || 1) - (critWeight[a.criticality] || 1);
      });

    const currentTasks: Task[] = [];

    sortedTasks.forEach(task => {
      let bestOffset = task.startDayOffset;
      let minOverload = Infinity;
      const maxPossibleOffset = Math.max(0, maxDays - task.durationDays);

      for (let offset = 0; offset <= maxPossibleOffset; offset++) {
        let score = 0;
        const tempTasks = [...currentTasks, { ...task, startDayOffset: offset }];
        
        for (let d = 0; d < maxDays; d++) {
          const dateStr = daysInfo.days[d]?.dateStr;
          if (!dateStr) continue;

          // Check primary specialties (MEH, TUB, COB, LUB, CIV)
          (['MEH', 'TUB', 'COB', 'LUB', 'CIV'] as ExternalSpecialty[]).forEach(spec => {
            let specNeeded = 0;
            tempTasks.forEach(t => {
              if (d >= t.startDayOffset && d < t.startDayOffset + t.durationDays) {
                t.requirements.forEach(r => {
                  if (r.specialty === spec) specNeeded += r.count;
                });
              }
            });

            const avail = getEffectiveSpecialtyAvailability(selectedParada, dateStr, spec);
            if (avail !== null && specNeeded > avail) {
              const overload = specNeeded - avail;
              // High penalty for overload
              score += overload * (spec === 'MEH' ? 15 : 10);
            }
          });
        }

        // Slight tie-breaker penalty for moving too far from original offset
        score += Math.abs(offset - task.startDayOffset) * 0.1;

        if (score < minOverload) {
          minOverload = score;
          bestOffset = offset;
        }
      }

      const assignedDay = daysInfo.days[bestOffset];
      currentTasks.push({ 
        ...task, 
        startDayOffset: bestOffset,
        startDate: assignedDay ? assignedDay.dateStr : task.startDate 
      });
    });

    setTasks([...otherTasks, ...currentTasks]);
  };

  // --- Handlers ---
  const handleSelectParada = (paradaId: string) => {
    setSelectedParadaId(paradaId);
  };

  const handleOpenNewTaskModal = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (savedTask: Task) => {
    const exists = tasks.some(t => t.id === savedTask.id);
    if (exists) {
      setTasks(tasks.map(t => t.id === savedTask.id ? savedTask : t));
    } else {
      setTasks([...tasks, savedTask]);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleOpenNewParada = () => {
    setView('paradas');
    setEditingParadaState({ active: true, parada: null });
  };

  const handleOpenEditParada = (parada: ParadaEvent) => {
    setView('paradas');
    setEditingParadaState({ active: true, parada });
  };

  const handleBackFromParadaEditor = () => {
    setEditingParadaState({ active: false, parada: null });
  };

  const handleSaveParada = (savedParada: ParadaEvent) => {
    const exists = paradas.some(p => p.id === savedParada.id);
    let updatedParadas: ParadaEvent[];
    if (exists) {
      updatedParadas = paradas.map(p => p.id === savedParada.id ? savedParada : p);
    } else {
      updatedParadas = [...paradas, savedParada];
    }
    setParadas(updatedParadas);
    setSelectedParadaId(savedParada.id);
    setEditingParadaState({ active: true, parada: savedParada });
  };

  const handleDeleteParada = (paradaId: string) => {
    const remaining = paradas.filter(p => p.id !== paradaId);
    setParadas(remaining);
    if (selectedParadaId === paradaId) {
      setSelectedParadaId(remaining[0]?.id || '');
    }
    setEditingParadaState({ active: false, parada: null });
  };

  const handleNavigateToBoard = (paradaId: string) => {
    setSelectedParadaId(paradaId);
    setView('board');
  };

  const handleCreateNewProject = (newProj: ProjectInfo, mode: 'blank' | 'template') => {
    const nextParadas = mode === 'blank' ? [] : INITIAL_PARADAS;
    const nextTasks = mode === 'blank' ? [] : INITIAL_TASKS;
    void replacePersistentPlannerData({ projectInfo: newProj, tasks: nextTasks, paradas: nextParadas });
    setSelectedParadaId(nextParadas[0]?.id || '');
  };

  const handleExportData = () => {
    const data = { projectInfo, tasks, paradas };
    const blob = new Blob([serializePlannerBackup(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = plannerBackupFileName(data);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (file: File) => {
    try {
      const imported = parsePlannerBackup(await file.text());
      await replacePersistentPlannerData(imported);
      setSelectedParadaId(imported.paradas[0]?.id || '');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al leer el archivo de respaldo.');
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('¿Desea restablecer los datos a la plantilla inicial? Se perderán las tareas actuales.')) {
      void replacePersistentPlannerData({ projectInfo: DEFAULT_PROJECT, tasks: INITIAL_TASKS, paradas: INITIAL_PARADAS });
      setSelectedParadaId(INITIAL_PARADAS[0]?.id || '');
    }
  };

  return (
    <div className={`planner-app planner-workbench flex flex-col ${embedded ? 'h-full' : 'h-screen'} bg-bg-gray font-sans text-gray-900 overflow-hidden`}>
      {/* Header */}
      <header className="planner-workbench-header bg-brand-blue border-b-3 border-brand-orange px-5 h-[52px] flex items-center justify-between sticky top-0 z-40 text-white shrink-0 shadow-md">
        <div className="planner-workbench-title flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
            title="Mostrar / Ocultar menú lateral"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-wider uppercase flex items-center gap-2">
              PLANNER <span className="text-white/80 font-semibold text-xs">| Mantenimiento General</span>
            </h1>
            <span className="text-[10px] text-brand-orange font-bold -mt-0.5">
              {projectInfo.name || 'Proyecto de Planificación'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] uppercase font-bold text-white/60 tracking-widest leading-none">Línea / Sector</span>
            <span className="text-xs font-bold text-white/90">{projectInfo.line || 'Línea de Producción General'}</span>
          </div>

          <div className="hidden md:block h-6 w-[1px] bg-white/20" />

          <div className="flex items-center gap-2">
            <span className={`planner-storage-status planner-storage-${planner.storageStatus.toLowerCase()}`} title={planner.storageError}>
              {planner.storageStatus === 'LOADING' ? 'CARGANDO…' : planner.storageStatus === 'SAVING' ? 'GUARDANDO…' : planner.storageStatus === 'ERROR' ? 'ERROR DE DATOS' : '✓ GUARDADO'}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase font-bold text-white/60 tracking-widest leading-none">Fecha Base</span>
              <span className="text-xs font-black text-white">{format(planningStartDate, "dd/MM/yyyy")}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsProjectModalOpen(true)}
              className="ml-1.5 px-2.5 py-1 bg-brand-orange hover:bg-orange-600 text-white text-xs font-black rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
              title="Crear nuevo proyecto o editar parámetros"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>PROYECTO</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="planner-workbench-body flex-1 flex overflow-hidden min-h-0">
        {/* Collapsible Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="planner-sidebar bg-white border-r border-border-gray flex flex-col shrink-0 overflow-y-auto whitespace-nowrap overflow-hidden shadow-xs z-30"
            >
              <div className="planner-sidebar-inner p-3.5 flex flex-col gap-4 h-full min-w-[280px]">
                {/* Views Nav - Reordered strictly as requested */}
                <div className="planner-sidebar-section planner-sidebar-primary space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                    Vistas del Sistema
                  </label>
                  <nav className="planner-view-nav flex flex-col gap-1">
                    {/* 1. Hitos y Paradas */}
                    <button 
                      type="button"
                      onClick={() => setView('paradas')}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        view === 'paradas' ? "bg-brand-blue text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Hitos y Paradas</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        view === 'paradas' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {paradas.length}
                      </span>
                    </button>

                    {/* 2. Planificación de Tareas */}
                    <button 
                      type="button"
                      onClick={() => setView('board')}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        view === 'board' ? "bg-brand-blue text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Planificación de Tareas</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        view === 'board' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {filteredTasks.length}
                      </span>
                    </button>

                    {/* 3. Resumen de Terceros */}
                    <button 
                      type="button"
                      onClick={() => setView('terceros')}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        view === 'terceros' ? "bg-brand-blue text-white shadow-xs" : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Resumen de Terceros</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                        view === 'terceros' ? 'bg-white/20 text-white' : 'bg-orange-100 text-brand-orange'
                      }`}>
                        HH
                      </span>
                    </button>
                  </nav>
                </div>

                {view === 'board' && <>
                  <div className="h-[1px] bg-gray-200" />

                  {/* Filters */}
                  <div className="planner-sidebar-section planner-filter-stack space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Filtros de Tareas
                    </label>
                    {(filterZone !== 'ALL' || filterSupervisor !== 'ALL' || filterCriticality !== 'ALL' || filterExecutedBy !== 'ALL' || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => { 
                          setFilterZone('ALL'); 
                          setFilterSupervisor('ALL');
                          setFilterCriticality('ALL');
                          setFilterExecutedBy('ALL'); 
                          setSearchQuery(''); 
                        }}
                        className="text-[10px] font-bold text-brand-orange hover:underline cursor-pointer"
                      >
                        Limpiar todo
                      </button>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Buscar tarea, supervisor..."
                      className="w-full text-xs font-medium pl-8 pr-2.5 py-1 border border-gray-200 rounded-md focus:border-brand-blue outline-none"
                    />
                  </div>

                  {/* Criticidad Filter */}
                  <div className="planner-filter-field space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Criticidad
                    </label>
                    <select 
                      value={filterCriticality}
                      onChange={e => setFilterCriticality(e.target.value)}
                      className="w-full text-xs font-bold border border-gray-200 rounded-md p-1 focus:border-brand-blue outline-none bg-white cursor-pointer"
                    >
                      <option value="ALL">Todas las Criticidades</option>
                      <option value="CRITICAL">⚠ Solo Críticas (Alta)</option>
                      <option value="MEDIA">Media</option>
                      <option value="BAJA">Baja</option>
                    </select>
                  </div>

                  {/* Zone Filter */}
                  <div className="planner-filter-field space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Zona de Planta
                    </label>
                    <select 
                      value={filterZone}
                      onChange={e => setFilterZone(e.target.value)}
                      className="w-full text-xs font-bold border border-gray-200 rounded-md p-1 focus:border-brand-blue outline-none bg-white cursor-pointer"
                    >
                      <option value="ALL">Todas las Zonas</option>
                      {ZONES.map(z => {
                        const count = tasks.filter(t => t.zone === z).length;
                        return <option key={z} value={z}>{z} ({count})</option>;
                      })}
                    </select>
                  </div>

                  {/* Supervisor Filter */}
                  <div className="planner-filter-field space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Supervisor / Responsable
                    </label>
                    <select 
                      value={filterSupervisor}
                      onChange={e => setFilterSupervisor(e.target.value)}
                      className="w-full text-xs font-bold border border-gray-200 rounded-md p-1 focus:border-brand-blue outline-none bg-white cursor-pointer"
                    >
                      <option value="ALL">Todos los Supervisores</option>
                      {availableSupervisors.map(sup => {
                        const count = tasks.filter(t => t.responsable === sup).length;
                        return <option key={sup} value={sup}>{sup} ({count})</option>;
                      })}
                    </select>
                  </div>

                  {/* ExecutedBy Filter */}
                  <div className="planner-filter-field space-y-0.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Ejecutor
                    </label>
                    <select 
                      value={filterExecutedBy}
                      onChange={e => setFilterExecutedBy(e.target.value)}
                      className="w-full text-xs font-bold border border-gray-200 rounded-md p-1 focus:border-brand-blue outline-none bg-white cursor-pointer"
                    >
                      <option value="ALL">Todos los Ejecutores</option>
                      {EXEC_TYPES.map(t => {
                        const count = tasks.filter(task => task.executedBy === t).length;
                        return (
                          <option key={t} value={t}>
                            {t === 'GMB' ? 'GMB (Técnicos)' : t === 'GUARDIA' ? 'Guardia Interna' : 'Terceros (Contratistas)'} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  </div>
                </>}

                {/* Sidebar Footer Actions */}
                <div className="planner-sidebar-footer mt-auto space-y-1.5 pt-2 border-t border-gray-200">
                  <button 
                    type="button"
                    onClick={() => setIsProjectModalOpen(true)}
                    className="w-full py-1.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 text-gray-700 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-brand-blue" />
                    Gestión de Proyecto
                  </button>

                  <button 
                    type="button"
                    onClick={handleExportData}
                    className="w-full py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1.5 text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar Respaldo
                  </button>

                  <button 
                    type="button"
                    onClick={handleResetToDefaults}
                    className="w-full py-0.5 text-[9px] text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 cursor-pointer"
                    title="Restablecer plantilla inicial"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restablecer Demo
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area - Maximized height and minimal padding */}
        <main className="planner-content flex-1 flex flex-col p-2.5 md:p-3 gap-2 overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {/* View 1: Hitos y Paradas (List or Full Page Editor) */}
            {view === 'paradas' && (
              <motion.div key="paradas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-auto min-h-0">
                {editingParadaState.active ? (
                  <ParadaEditor
                    parada={editingParadaState.parada}
                    projectStartDate={planningStartDate}
                    onBack={handleBackFromParadaEditor}
                    onSave={handleSaveParada}
                    onDelete={handleDeleteParada}
                  />
                ) : (
                  <ParadasListView
                    paradas={paradas}
                    selectedParadaId={selectedParadaId}
                    onSelectParada={handleSelectParada}
                    onOpenNewParada={handleOpenNewParada}
                    onOpenEditParada={handleOpenEditParada}
                    onDeleteParada={handleDeleteParada}
                    onNavigateToBoard={handleNavigateToBoard}
                    tasks={tasks}
                    planningStartDate={planningStartDate}
                  />
                )}
              </motion.div>
            )}

            {/* View 2: Planificación de Tareas */}
            {view === 'board' && (
              <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden min-h-0">
                <PlanningBoardView
                  paradas={paradas}
                  selectedParada={selectedParada}
                  onSelectParada={handleSelectParada}
                  onOpenNewParada={handleOpenNewParada}
                  onEditParada={handleOpenEditParada}
                  filteredTasks={filteredTasks}
                  allTasks={tasks}
                  planningStartDate={planningStartDate}
                  projectInfo={projectInfo}
                  onOpenNewTaskModal={handleOpenNewTaskModal}
                  onOpenEditTaskModal={handleOpenEditTaskModal}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onAutoOptimize={handleAutoOptimize}
                  filterCriticality={filterCriticality}
                  setFilterCriticality={setFilterCriticality}
                  onNavigateToTerceros={() => setView('terceros')}
                />
              </motion.div>
            )}

            {/* View 3: Resumen de Terceros */}
            {view === 'terceros' && (
              <motion.div key="terceros" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden min-h-0">
                <ThirdPartySummaryView
                  paradas={paradas}
                  selectedParada={selectedParada}
                  onSelectParada={handleSelectParada}
                  tasks={tasks}
                  planningStartDate={planningStartDate}
                  projectInfo={projectInfo}
                  onNavigateToBoard={() => setView('board')}
                  onSelectTask={handleOpenEditTaskModal}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer */}
      <footer className="planner-workbench-footer bg-white border-t border-border-gray px-6 py-2.5 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest shrink-0">
        <p>© 2026 Planta - Planificación General</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><HardHat className="w-3 h-3 text-brand-orange" /> Mantenimiento General</span>
          <div className="flex items-center gap-1 text-green-600">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Control de Operación: {(import.meta as any).env?.VITE_USER_EMAIL || 'SUPERVISOR'}
          </div>
        </div>
      </footer>

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        task={editingTask}
        selectedParada={selectedParada}
        planningStartDate={planningStartDate}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />

      {/* Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        currentProject={projectInfo}
        onClose={() => setIsProjectModalOpen(false)}
        onCreateNewProject={handleCreateNewProject}
        onUpdateProject={(updated) => setProjectInfo(updated)}
        onExportData={handleExportData}
        onImportData={handleImportData}
      />
    </div>
  );
}
