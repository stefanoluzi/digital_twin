import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Zap, 
  Calendar, 
  User, 
  MapPin, 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  HelpCircle,
  Settings2,
  FileText
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

import { Task, SpecialtyRequirement, ParadaEvent, Specialty, ExternalSpecialty } from '../types';
import { 
  SPECIALTIES_LIST, 
  SPECIALTY_LABELS, 
  EXTERNAL_SPECIALTIES, 
  getParadaDays, 
  getRequirementAllocationSummary,
  getDefaultAllocationsForSpecialty
} from '../constants';
import { QuickResourcePopover } from './QuickResourcePopover';

interface TaskDrawerProps {
  task: Task | null;
  selectedParada: ParadaEvent | null;
  planningStartDate: Date;
  onClose: () => void;
  onUpdateTask: (updatedTask: Task) => void;
  onOpenFullEdit: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  task,
  selectedParada,
  planningStartDate,
  onClose,
  onUpdateTask,
  onOpenFullEdit,
  onDeleteTask
}) => {
  const [editingRequirement, setEditingRequirement] = useState<SpecialtyRequirement | null>(null);
  const [showAddSpecialtyMenu, setShowAddSpecialtyMenu] = useState(false);

  if (!task) return null;

  const paradaInfo = getParadaDays(selectedParada, planningStartDate);
  const currentDayInfo = paradaInfo.days[task.startDayOffset];
  const duration = task.durationDays;
  const maxDayOffset = paradaInfo.durationDays - duration;

  const handleShiftDay = (delta: number) => {
    const nextOffset = task.startDayOffset + delta;
    if (nextOffset >= 0 && nextOffset <= maxDayOffset) {
      const nextDay = paradaInfo.days[nextOffset];
      let nextDailyReqs = task.dailyRequirements;
      if (task.dailyRequirements) {
        const shifted: Record<number, SpecialtyRequirement[]> = {};
        Object.entries(task.dailyRequirements).forEach(([d, reqs]) => {
          if (Array.isArray(reqs)) {
            shifted[Number(d) + delta] = reqs as SpecialtyRequirement[];
          }
        });
        nextDailyReqs = shifted;
      }
      onUpdateTask({
        ...task,
        startDayOffset: nextOffset,
        startDate: nextDay ? nextDay.dateStr : task.startDate,
        dailyRequirements: nextDailyReqs
      });
    }
  };

  const handleSaveRequirement = (updatedReq: SpecialtyRequirement) => {
    const nextRequirements = task.requirements.map(r => 
      r.specialty === updatedReq.specialty ? updatedReq : r
    );
    onUpdateTask({
      ...task,
      requirements: nextRequirements
    });
    setEditingRequirement(null);
  };

  const handleAddSpecialty = (spec: Specialty) => {
    const exists = task.requirements.some(r => r.specialty === spec);
    if (exists) return;

    const isExternal = EXTERNAL_SPECIALTIES.includes(spec);
    const count = isExternal ? 1 : 2;
    const defaultAllocs = getDefaultAllocationsForSpecialty(spec, count);

    const newReq: SpecialtyRequirement = {
      specialty: spec,
      count,
      companyAllocations: defaultAllocs
    };

    onUpdateTask({
      ...task,
      requirements: [...task.requirements, newReq]
    });
    setShowAddSpecialtyMenu(false);
  };

  const handleDeleteRequirement = (spec: Specialty) => {
    if (task.requirements.length <= 1) {
      alert('La tarea debe tener al menos un recurso asignado.');
      return;
    }
    onUpdateTask({
      ...task,
      requirements: task.requirements.filter(r => r.specialty !== spec)
    });
  };

  const availableSpecialtiesToAdd = SPECIALTIES_LIST.filter(
    spec => !task.requirements.some(r => r.specialty === spec)
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="relative ml-auto w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50 h-full overflow-hidden text-gray-800"
      >
        {/* Drawer Header */}
        <div className={`p-4 border-b shrink-0 flex items-start justify-between gap-3 ${
          task.criticality === 'Alta' 
            ? 'bg-red-50/80 border-red-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {task.criticality === 'Alta' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                  <AlertTriangle className="w-3 h-3" />
                  CRÍTICA
                </span>
              ) : task.criticality === 'Media' ? (
                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  MEDIA
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                  BAJA
                </span>
              )}

              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                ZONA: {task.zone}
              </span>
            </div>

            <h3 className="text-sm font-black text-gray-900 leading-snug">
              {task.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors cursor-pointer"
            title="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Programación & Día */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand-orange" />
                Programación Operativa
              </label>
            </div>

            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5">
              <div>
                <div className="text-xs font-black text-gray-900">
                  {currentDayInfo ? (
                    <>
                      {currentDayInfo.label} · {format(currentDayInfo.date, 'EEEE d/MM', { locale: es }).toUpperCase()}
                    </>
                  ) : (
                    `Día ${task.startDayOffset + 1}`
                  )}
                </div>
                <span className="text-[10px] text-gray-500 font-semibold">
                  Duración: <strong>{duration} {duration === 1 ? 'día' : 'días'}</strong>
                </span>
              </div>

              {/* Quick Shift buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={task.startDayOffset <= 0}
                  onClick={() => handleShiftDay(-1)}
                  className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Mover a día anterior (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={task.startDayOffset >= maxDayOffset}
                  onClick={() => handleShiftDay(1)}
                  className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Mover a día siguiente (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Jornada Laboral (9h estándar vs 12h extendida) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-brand-orange" />
                  Régimen de Jornada
                </label>
                {(task.workHours ?? 9) === 12 && (
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                    12hs activas
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => onUpdateTask({ ...task, workHours: 9 })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    (task.workHours ?? 9) === 9
                      ? 'bg-white text-slate-900 shadow-xs border border-gray-200 font-black'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>9h Estándar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateTask({ ...task, workHours: 12 })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    (task.workHours ?? 9) === 12
                      ? 'bg-indigo-600 text-white shadow-xs border border-indigo-700 font-black'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Clock className="w-3 h-3 text-indigo-300" />
                  <span>12h Extendida</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recursos Requeridos & Distribución */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-brand-orange" />
                Recursos y Empresas
              </label>

              {availableSpecialtiesToAdd.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddSpecialtyMenu(!showAddSpecialtyMenu)}
                    className="text-[10px] font-bold text-brand-blue hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Agregar recurso
                  </button>

                  {showAddSpecialtyMenu && (
                    <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-30 min-w-[160px]">
                      {availableSpecialtiesToAdd.map(spec => (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => handleAddSpecialty(spec)}
                          className="w-full text-left px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                        >
                          <span>{spec}</span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            {SPECIALTY_LABELS[spec]?.split('(')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {task.requirements.map(req => {
                const summary = getRequirementAllocationSummary(req);
                const isExternal = EXTERNAL_SPECIALTIES.includes(req.specialty);

                return (
                  <div
                    key={req.specialty}
                    className={`p-3 rounded-xl border transition-all ${
                      summary.isOver
                        ? 'bg-red-50/70 border-red-200'
                        : summary.isComplete
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-900">
                            {SPECIALTY_LABELS[req.specialty] || req.specialty}
                          </span>
                          {!isExternal && (
                            <span className="text-xs font-black bg-white px-1.5 py-0.5 rounded border border-gray-300 text-brand-blue">
                              {req.count} {req.count === 1 ? 'técnico' : 'técnicos'}
                            </span>
                          )}
                        </div>

                        {/* Distribution badge */}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {summary.isComplete ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {summary.label}
                            </span>
                          ) : summary.isOver ? (
                            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {summary.label} (⚠ Excedido en {summary.assigned - req.count})
                            </span>
                          ) : summary.assigned > 0 ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              {summary.label}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <HelpCircle className="w-3 h-3 text-gray-400" />
                              Empresa pendiente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit requirement distribution button */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequirement(req)}
                          className="px-2 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-100 text-brand-blue text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Modificar cantidad y asignación por empresa"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                        {task.requirements.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRequirement(req.specialty)}
                            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Quitar especialidad"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supervisor, Ejecutor, Impactos */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs">
            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                Supervisor / Resp.
              </span>
              <span className="font-black text-gray-800 flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {task.responsable || 'Sin asignar'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                Ejecutor
              </span>
              <span className="font-black text-gray-800 mt-0.5 block">
                {task.executedBy}
              </span>
            </div>

            <div className="col-span-2 pt-2 border-t border-gray-200">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                Impactos Operativos
              </span>
              <div className="flex flex-wrap gap-1.5">
                {task.impacts.map(impact => (
                  <span
                    key={impact}
                    className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                      impact === 'HSE' ? 'bg-red-100 text-red-700 border border-red-200' :
                      impact === 'INO' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      impact === 'CALIDAD' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {impact}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Justificación Operativa */}
          {task.justification && (
            <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-3.5">
              <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1 mb-1">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                Justificación y Motivo de la Tarea
              </label>
              <p className="text-xs text-gray-700 italic leading-relaxed">
                "{task.justification}"
              </p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFullEdit(task);
            }}
            className="px-4 py-2 bg-brand-blue text-white text-xs font-black rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Editar Tarea Completa
          </button>
        </div>
      </motion.aside>

      {/* Contextual Quick Resource Popover inside drawer if active */}
      {editingRequirement && (
        <QuickResourcePopover
          requirement={editingRequirement}
          taskTitle={task.title}
          onSave={handleSaveRequirement}
          onClose={() => setEditingRequirement(null)}
        />
      )}
    </div>
  );
};
