import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Plus, 
  Minus, 
  Trash2, 
  Building2, 
  Copy, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Clock,
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  Task, 
  Specialty, 
  Company, 
  SpecialtyRequirement, 
  CompanyAllocation, 
  ExternalSpecialty 
} from '../types';
import { 
  SPECIALTIES_LIST, 
  SPECIALTY_LABELS, 
  SPECIALTY_COMPANIES, 
  EXTERNAL_SPECIALTIES,
  getDefaultAllocationsForSpecialty,
  getRequirementAssignedCount,
  getRequirementAllocationSummary
} from '../constants';

interface DayResourceAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  dayIndex: number;
  dayLabel: string;
  dayDateFormatted?: string;
  initialRequirements: SpecialtyRequirement[];
  prevDayRequirements?: SpecialtyRequirement[];
  onSave: (updatedRequirements: SpecialtyRequirement[], workHours?: number) => void;
}

export const DayResourceAssignmentModal: React.FC<DayResourceAssignmentModalProps> = ({
  isOpen,
  onClose,
  task,
  dayIndex,
  dayLabel,
  dayDateFormatted,
  initialRequirements,
  prevDayRequirements,
  onSave
}) => {
  const [requirements, setRequirements] = useState<SpecialtyRequirement[]>([]);
  const [workHoursMode, setWorkHoursMode] = useState<'9' | '12' | 'custom'>('9');
  const [customHours, setCustomHours] = useState<number>(9);

  // Synchronize state when opening or task changes
  useEffect(() => {
    if (isOpen && task) {
      // Deep clone initial requirements
      setRequirements(
        JSON.parse(JSON.stringify(initialRequirements || []))
      );
      const initialHours = task.dailyWorkHours?.[dayIndex] ?? task.workHours ?? 9;
      if (initialHours === 9) {
        setWorkHoursMode('9');
        setCustomHours(9);
      } else if (initialHours === 12) {
        setWorkHoursMode('12');
        setCustomHours(12);
      } else {
        setWorkHoursMode('custom');
        setCustomHours(initialHours);
      }
    }
  }, [isOpen, task, initialRequirements, dayIndex]);

  if (!isOpen || !task) return null;

  const currentWorkHours = workHoursMode === '9' ? 9 : workHoursMode === '12' ? 12 : Math.max(1, customHours || 9);

  // Specialties defined in the task's general definition
  const taskDefinedSpecs = (task.requirements || []).map(r => r.specialty);
  // Specialties not yet assigned on this day
  const availableSpecsToAdd = SPECIALTIES_LIST.filter(
    s => !requirements.some(r => r.specialty === s)
  );

  // Helper to add a specialty
  const handleAddSpecialty = (spec: Specialty, suggestedCount?: number) => {
    const isExt = EXTERNAL_SPECIALTIES.includes(spec);
    // Find if task already had a general count for this spec
    const existingTaskReq = (task.requirements || []).find(r => r.specialty === spec);
    const count = suggestedCount ?? (existingTaskReq ? existingTaskReq.count : (isExt ? 1 : 2));
    
    // Auto-assign company if single contractor or if existing in task
    let companyAllocations: CompanyAllocation[] = [];
    if (existingTaskReq?.companyAllocations && existingTaskReq.companyAllocations.length > 0) {
      companyAllocations = JSON.parse(JSON.stringify(existingTaskReq.companyAllocations));
    } else {
      companyAllocations = getDefaultAllocationsForSpecialty(spec, count);
    }

    setRequirements(prev => [
      ...prev,
      {
        specialty: spec,
        count: isExt ? 1 : Math.max(1, count),
        companyAllocations
      }
    ]);
  };

  // Helper to remove a single specialty from this day
  const handleRemoveSpecialty = (spec: Specialty) => {
    setRequirements(prev => prev.filter(r => r.specialty !== spec));
  };

  // Helper to update count
  const handleCountChange = (spec: Specialty, newCount: number) => {
    const isExt = EXTERNAL_SPECIALTIES.includes(spec);
    const safeCount = isExt ? 1 : Math.max(1, newCount);
    
    setRequirements(prev => prev.map(r => {
      if (r.specialty !== spec) return r;
      
      // If single company, auto-update allocation count
      const allowedCompanies = SPECIALTY_COMPANIES[spec as ExternalSpecialty] || [];
      let updatedAllocs = r.companyAllocations ? [...r.companyAllocations] : [];
      if (allowedCompanies.length === 1 && updatedAllocs.length > 0) {
        updatedAllocs = [{ company: allowedCompanies[0], count: safeCount }];
      }

      return {
        ...r,
        count: safeCount,
        companyAllocations: updatedAllocs
      };
    }));
  };

  // Helper to update company allocation for a specialty
  const handleCompanyAllocationChange = (spec: Specialty, comp: Company, newAllocCount: number) => {
    const safeVal = Math.max(0, newAllocCount);
    setRequirements(prev => prev.map(r => {
      if (r.specialty !== spec) return r;

      const currentAllocs = r.companyAllocations ? [...r.companyAllocations] : [];
      const existingIdx = currentAllocs.findIndex(a => a.company === comp);

      if (safeVal === 0) {
        if (existingIdx >= 0) {
          currentAllocs.splice(existingIdx, 1);
        }
      } else {
        if (existingIdx >= 0) {
          currentAllocs[existingIdx] = { company: comp, count: safeVal };
        } else {
          currentAllocs.push({ company: comp, count: safeVal });
        }
      }

      return {
        ...r,
        companyAllocations: currentAllocs
      };
    }));
  };

  // Quick auto-assign entire count to a single company
  const handleAutoAssignAllToCompany = (spec: Specialty, comp: Company, count: number) => {
    setRequirements(prev => prev.map(r => {
      if (r.specialty !== spec) return r;
      return {
        ...r,
        companyAllocations: [{ company: comp, count }]
      };
    }));
  };

  // Clear allocations for a specialty (leaves as Empresa pendiente)
  const handleClearCompanyAllocations = (spec: Specialty) => {
    setRequirements(prev => prev.map(r => {
      if (r.specialty !== spec) return r;
      return {
        ...r,
        companyAllocations: []
      };
    }));
  };

  // Copy resources from previous day
  const handleCopyPrevDay = () => {
    if (prevDayRequirements && prevDayRequirements.length > 0) {
      setRequirements(JSON.parse(JSON.stringify(prevDayRequirements)));
    }
  };

  // Save handler
  const handleSave = () => {
    onSave(requirements, currentWorkHours);
    onClose();
  };

  const totalPeopleOnDay = requirements.reduce((sum, r) => sum + r.count, 0);
  const totalHhOnDay = totalPeopleOnDay * currentWorkHours;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 backdrop-blur-2xs p-3 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/20 text-brand-orange flex items-center justify-center font-black">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Asignación Diaria de Recursos
              </span>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>{dayLabel}</span>
                {dayDateFormatted && (
                  <span className="text-xs font-semibold text-slate-300">({dayDateFormatted})</span>
                )}
              </h3>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Reference Banner */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tarea</span>
            <p className="font-bold text-slate-800 truncate">{task.title}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Zona / Responsable</span>
            <span className="font-bold text-slate-700">{task.zone} · {task.responsable || 'Sin asignar'}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
          
          {/* Work Hours (Jornada) Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-blue" />
                Jornada Laboral del Día:
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                Duración de turno aplicada al cálculo de HH
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWorkHoursMode('9')}
                  className={`px-2.5 py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
                    workHoursMode === '9'
                      ? 'bg-brand-blue text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  9 h
                </button>
                <button
                  type="button"
                  onClick={() => setWorkHoursMode('12')}
                  className={`px-2.5 py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
                    workHoursMode === '12'
                      ? 'bg-brand-blue text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  12 h
                </button>
                <button
                  type="button"
                  onClick={() => setWorkHoursMode('custom')}
                  className={`px-2.5 py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
                    workHoursMode === 'custom'
                      ? 'bg-brand-blue text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Personalizada
                </button>
              </div>

              {workHoursMode === 'custom' && (
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-0.5">
                  <span className="text-[10px] font-bold text-slate-500">Horas:</span>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={customHours}
                    onChange={e => setCustomHours(Math.max(1, parseInt(e.target.value) || 9))}
                    className="w-10 text-center font-black text-xs outline-none text-slate-900"
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Quick Shortcuts Section */}
          <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-brand-blue uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                Recursos definidos en la tarea:
              </span>

              {prevDayRequirements && prevDayRequirements.length > 0 && requirements.length === 0 && (
                <button
                  type="button"
                  onClick={handleCopyPrevDay}
                  className="text-[11px] font-bold text-slate-600 hover:text-brand-blue flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs hover:border-brand-blue"
                  title="Copiar la misma asignación que el día anterior"
                >
                  <Copy className="w-3 h-3 text-brand-blue" />
                  <span>Copiar día anterior</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(task.requirements || []).map(tr => {
                const isAlreadyAdded = requirements.some(r => r.specialty === tr.specialty);
                return (
                  <button
                    key={tr.specialty}
                    type="button"
                    onClick={() => handleAddSpecialty(tr.specialty, tr.count)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      isAlreadyAdded
                        ? 'bg-slate-200 text-slate-500 opacity-60 cursor-not-allowed'
                        : 'bg-white text-slate-800 border border-slate-300 hover:border-brand-blue hover:text-brand-blue hover:shadow-xs'
                    }`}
                    disabled={isAlreadyAdded}
                  >
                    <Plus className="w-3 h-3 text-brand-orange" />
                    <span>+ {tr.specialty}</span>
                    <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded text-[10px]">
                      {tr.count}
                    </span>
                  </button>
                );
              })}

              {availableSpecsToAdd
                .filter(s => !taskDefinedSpecs.includes(s))
                .map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleAddSpecialty(s)}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-white text-slate-600 border border-dashed border-slate-300 hover:border-slate-400 hover:text-slate-900 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-400" />
                    <span>+ {s}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Active Requirements List for This Day */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-orange" />
                Especialidades asignadas a este día ({requirements.length}):
              </label>

              {requirements.length > 0 && (
                <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  Total personas: {totalPeopleOnDay}
                </span>
              )}
            </div>

            {requirements.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-2 bg-slate-50/50">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-600">
                  Sin recursos asignados para este día.
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Seleccioná una especialidad arriba para asignar recursos específicos a esta tarea en este día.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requirements.map(req => {
                  const isExternal = EXTERNAL_SPECIALTIES.includes(req.specialty);
                  const allowedCompanies = SPECIALTY_COMPANIES[req.specialty as ExternalSpecialty] || [];
                  const allocSummary = getRequirementAllocationSummary(req);

                  return (
                    <div 
                      key={req.specialty}
                      className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-3 hover:border-slate-300 transition-colors"
                    >
                      {/* Row Header: Specialty badge, Count Stepper, and Delete button */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-black text-xs">
                            {req.specialty}
                          </span>
                          <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                            {SPECIALTY_LABELS[req.specialty] || req.specialty}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Stepper */}
                          {!isExternal ? (
                            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-black text-slate-400 uppercase mr-1 hidden sm:inline">Cant:</span>
                              <button
                                type="button"
                                onClick={() => handleCountChange(req.specialty, req.count - 1)}
                                disabled={req.count <= 1}
                                className="w-6 h-6 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-30 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-black text-slate-900">
                                {req.count}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCountChange(req.specialty, req.count + 1)}
                                className="w-6 h-6 rounded bg-slate-900 text-white hover:bg-slate-800 font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              1 serv.
                            </span>
                          )}

                          {/* Delete resource button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecialty(req.specialty)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title={`Eliminar ${req.specialty} de este día`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Company Allocation Block */}
                      <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-brand-orange" />
                            Empresa / Contratista:
                          </span>

                          {allowedCompanies.length > 1 && req.companyAllocations && req.companyAllocations.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleClearCompanyAllocations(req.specialty)}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              Dejar pendiente
                            </button>
                          )}
                        </div>

                        {allowedCompanies.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic">
                            Sin contratistas específicos requeridos.
                          </div>
                        ) : allowedCompanies.length === 1 ? (
                          <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-md border border-slate-200">
                            <span className="font-bold text-slate-800">{allowedCompanies[0]}</span>
                            <span className="text-[10.5px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {req.count} asignado(s)
                            </span>
                          </div>
                        ) : (
                          /* Multi-company distribution (e.g. MEH: BFB, LOBERAZ, EMET, COMIBOR) */
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {allowedCompanies.map(comp => {
                                const alloc = req.companyAllocations?.find(a => a.company === comp);
                                const val = alloc ? alloc.count : 0;
                                const isAllocated = val > 0;

                                return (
                                  <div 
                                    key={comp}
                                    className={`p-1.5 rounded-md border flex flex-col justify-between transition-colors ${
                                      isAllocated ? 'bg-orange-50/70 border-brand-orange/40' : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-slate-800 truncate">{comp}</span>
                                      {val === 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleAutoAssignAllToCompany(req.specialty, comp, req.count)}
                                          className="text-[9px] font-black text-brand-blue hover:underline cursor-pointer"
                                        >
                                          Todo
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleCompanyAllocationChange(req.specialty, comp, val - 1)}
                                        disabled={val <= 0}
                                        className="w-5 h-5 rounded bg-slate-100 border border-slate-300 text-slate-600 disabled:opacity-20 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <span className={`text-xs font-black ${val > 0 ? 'text-brand-orange' : 'text-slate-400'}`}>
                                        {val}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCompanyAllocationChange(req.specialty, comp, val + 1)}
                                        className="w-5 h-5 rounded bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Status indicator for this specialty */}
                            <div className={`px-2 py-1 rounded text-[11px] font-bold flex items-center justify-between ${
                              allocSummary.isOver 
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : allocSummary.isComplete
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              <span>
                                {allocSummary.isOver 
                                  ? `⚠ Sobre-asignado (+${allocSummary.assigned - req.count})`
                                  : allocSummary.isComplete
                                  ? `✓ Asignación completa (${allocSummary.label})`
                                  : `${allocSummary.assigned} asignados · ${allocSummary.pending} pendientes`}
                              </span>
                              <span className="font-black text-[10.5px]">
                                {allocSummary.assigned} / {req.count}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {requirements.length > 0 ? (
              <span className="text-xs font-bold text-slate-600">
                Se guardarán <strong className="text-slate-900 font-black">{requirements.length}</strong> especialidades ({totalPeopleOnDay} personas) para este día.
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400 italic">
                El día quedará vacío (sin recursos).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-black hover:brightness-110 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Asignación</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
