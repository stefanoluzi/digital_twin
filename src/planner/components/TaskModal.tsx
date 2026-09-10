import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  HardHat, 
  AlertTriangle, 
  Zap, 
  Check, 
  Trash2, 
  Calendar, 
  User, 
  MapPin, 
  CalendarDays, 
  Layers, 
  Building2, 
  Plus, 
  Minus,
  HelpCircle,
  Pencil
} from 'lucide-react';
import { 
  Task, 
  Zone, 
  Specialty, 
  Impact, 
  ExecutedBy, 
  SpecialtyRequirement, 
  ParadaEvent, 
  ExternalSpecialty, 
  Company 
} from '../types';
import { 
  ZONES, 
  SPECIALTIES_LIST, 
  EXTERNAL_SPECIALTIES, 
  SPECIALTY_LABELS, 
  SPECIALTY_COMPANIES, 
  IMPACTS_LIST, 
  EXEC_TYPES, 
  getParadaDays,
  getRequirementAllocationSummary,
  getDefaultAllocationsForSpecialty
} from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QuickResourcePopover } from './QuickResourcePopover';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  selectedParada?: ParadaEvent | null;
  planningStartDate: Date;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  selectedParada,
  planningStartDate,
  onClose,
  onSave,
  onDelete
}) => {
  const paradaInfo = useMemo(() => {
    return getParadaDays(selectedParada, planningStartDate);
  }, [selectedParada, planningStartDate]);

  const [form, setForm] = useState<Task>({
    id: '',
    paradaId: selectedParada?.id,
    startDate: paradaInfo.days[0]?.dateStr,
    title: '',
    justification: '',
    zone: 'COBA',
    executedBy: 'GMB',
    responsable: '',
    impacts: ['INO'],
    criticality: 'Media',
    startDayOffset: 0,
    durationDays: 1,
    requirements: [{ specialty: 'MEH', count: 4, companyAllocations: [] }]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingPopoverReq, setEditingPopoverReq] = useState<SpecialtyRequirement | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      let computedOffset = task.startDayOffset;
      if (task.startDate && paradaInfo.startDate) {
        const tDate = new Date(task.startDate.includes('T') ? task.startDate : `${task.startDate}T00:00:00`);
        const diff = Math.round((tDate.getTime() - paradaInfo.startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < paradaInfo.durationDays) {
          computedOffset = diff;
        }
      }
      
      const safeOffset = Math.max(0, Math.min(computedOffset, paradaInfo.durationDays - 1));
      const safeDuration = Math.max(1, Math.min(task.durationDays, paradaInfo.durationDays - safeOffset));

      setForm({
        ...task,
        paradaId: task.paradaId || selectedParada?.id,
        startDayOffset: safeOffset,
        durationDays: safeDuration,
        requirements: task.requirements.length > 0 
          ? [...task.requirements] 
          : [{ specialty: 'MEH', count: 4, companyAllocations: [] }]
      });
    } else {
      setForm({
        id: Math.random().toString(36).substr(2, 9),
        paradaId: selectedParada?.id,
        startDate: paradaInfo.days[0]?.dateStr,
        title: '',
        justification: '',
        zone: 'COBA',
        executedBy: 'GMB',
        responsable: '',
        impacts: ['INO'],
        criticality: 'Media',
        startDayOffset: 0,
        durationDays: 1,
        requirements: [{ specialty: 'MEH', count: 4, companyAllocations: [] }]
      });
    }
    setErrors({});
  }, [task, isOpen, selectedParada, paradaInfo]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) {
      errs.title = 'El título de la tarea es obligatorio';
    }
    if (!form.justification?.trim()) {
      errs.justification = 'La justificación / motivo de la necesidad es obligatoria';
    }
    if (form.durationDays < 1 || form.durationDays > paradaInfo.durationDays) {
      errs.durationDays = `La duración debe ser entre 1 y ${paradaInfo.durationDays} días`;
    }
    if (form.startDayOffset < 0 || form.startDayOffset >= paradaInfo.durationDays) {
      errs.startDayOffset = `El día de inicio debe ser entre 0 y ${paradaInfo.durationDays - 1}`;
    }
    if (form.startDayOffset + form.durationDays > paradaInfo.durationDays) {
      errs.durationDays = `La duración excede el rango de ${paradaInfo.durationDays} días de la intervención`;
    }
    if (form.requirements.length === 0) {
      errs.requirements = 'Debe asignar al menos una especialidad o recurso';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleToggleImpact = (impact: Impact) => {
    if (form.impacts.includes(impact)) {
      if (form.impacts.length === 1) return;
      setForm({ ...form, impacts: form.impacts.filter(i => i !== impact) });
    } else {
      setForm({ ...form, impacts: [...form.impacts, impact] });
    }
  };

  const handleRequirementCountChange = (spec: Specialty, newCount: number) => {
    const isExternal = EXTERNAL_SPECIALTIES.includes(spec);
    const count = isExternal ? 1 : Math.max(1, newCount);

    setForm({
      ...form,
      requirements: form.requirements.map(r => {
        if (r.specialty === spec) {
          // If the specialty only has 1 company, update allocation count as well
          const allowed = SPECIALTY_COMPANIES[spec as ExternalSpecialty] || [];
          let allocs = r.companyAllocations || [];
          if (allowed.length === 1 && allocs.length === 1) {
            allocs = [{ company: allowed[0], count }];
          }
          return { ...r, count, companyAllocations: allocs };
        }
        return r;
      })
    });
  };

  const handleAddRequirement = (spec: Specialty) => {
    if (form.requirements.some(r => r.specialty === spec)) return;
    const isExternal = EXTERNAL_SPECIALTIES.includes(spec);
    const count = isExternal ? 1 : 2;
    const defaultAllocs = getDefaultAllocationsForSpecialty(spec, count);

    setForm({
      ...form,
      requirements: [
        ...form.requirements,
        { specialty: spec, count, companyAllocations: defaultAllocs }
      ]
    });
  };

  const handleRemoveRequirement = (spec: Specialty) => {
    if (form.requirements.length <= 1) {
      alert('Debe conservar al menos un recurso.');
      return;
    }
    setForm({
      ...form,
      requirements: form.requirements.filter(r => r.specialty !== spec)
    });
  };

  const handleQuickPopoverSave = (updatedReq: SpecialtyRequirement) => {
    setForm({
      ...form,
      requirements: form.requirements.map(r => 
        r.specialty === updatedReq.specialty ? updatedReq : r
      )
    });
    setEditingPopoverReq(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const matchedDay = paradaInfo.days[form.startDayOffset];
    const taskStartDateStr = matchedDay ? matchedDay.dateStr : form.startDate;

    onSave({
      ...form,
      paradaId: selectedParada?.id || form.paradaId,
      startDate: taskStartDateStr
    });
  };

  const unselectedSpecialties = SPECIALTIES_LIST.filter(
    s => !form.requirements.some(r => r.specialty === s)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-gray-800">
        {/* Header */}
        <div className="bg-brand-blue px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <HardHat className="w-5 h-5 text-brand-orange" />
            <div>
              <h3 className="font-bold text-base tracking-wide">
                {task?.id ? 'Editar Tarea Completa' : 'Nueva Tarea de Mantenimiento'}
              </h3>
              <p className="text-xs text-white/70">
                Configure trabajo, fechas operativas y requerimientos por especialidad y empresa.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Parada Context Banner */}
        {selectedParada && (
          <div className="bg-orange-50/90 border-b border-brand-orange/20 px-6 py-2 flex items-center justify-between text-xs text-brand-orange font-bold shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Intervención Activa: <strong className="text-gray-800 font-black">{selectedParada.title}</strong></span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-600 font-semibold">
              <CalendarDays className="w-3.5 h-3.5 text-brand-orange" />
              <span>{format(paradaInfo.startDate, 'dd/MM/yyyy')} → {format(paradaInfo.endDate, 'dd/MM/yyyy')} ({paradaInfo.durationDays} {paradaInfo.durationDays === 1 ? 'día' : 'días'})</span>
            </div>
          </div>
        )}

        {/* Body (3 Structured Sections) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: TRABAJO */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
              <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-black flex items-center justify-center">
                1
              </span>
              <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Trabajo y Responsables
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Título de la Tarea <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej. Cambio de rodillos y alineación de guías"
                  className={`w-full text-sm font-medium border rounded-lg p-2.5 outline-none transition-all ${
                    errors.title ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10'
                  }`}
                />
                {errors.title && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Justificación / Necesidad de la Tarea <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.justification || ''}
                  onChange={e => setForm({ ...form, justification: e.target.value })}
                  rows={2}
                  placeholder="Explique el motivo, riesgo operativo o hallazgo que justifica esta intervención..."
                  className={`w-full text-sm border rounded-lg p-2.5 outline-none transition-all ${
                    errors.justification ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10'
                  }`}
                />
                {errors.justification && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.justification}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Zona de Planta
                </label>
                <select
                  value={form.zone}
                  onChange={e => setForm({ ...form, zone: e.target.value as Zone })}
                  className="w-full text-xs font-bold border border-gray-300 bg-white rounded-md p-2 outline-none focus:border-brand-blue cursor-pointer"
                >
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Ejecutado Por
                </label>
                <select
                  value={form.executedBy}
                  onChange={e => setForm({ ...form, executedBy: e.target.value as ExecutedBy })}
                  className="w-full text-xs font-bold border border-gray-300 bg-white rounded-md p-2 outline-none focus:border-brand-blue cursor-pointer"
                >
                  {EXEC_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t === 'GMB' ? 'GMB (Técnicos)' : t === 'GUARDIA' ? 'Guardia Interna' : 'Contratistas (Terceros)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Supervisor / Resp.
                </label>
                <input
                  type="text"
                  value={form.responsable || ''}
                  onChange={e => setForm({ ...form, responsable: e.target.value })}
                  placeholder="Nombre supervisor..."
                  className="w-full text-xs font-semibold border border-gray-300 bg-white rounded-md p-2 outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Criticidad
                </label>
                <select
                  value={form.criticality}
                  onChange={e => setForm({ ...form, criticality: e.target.value as Task['criticality'] })}
                  className={`w-full text-xs font-black border rounded-md p-2 outline-none cursor-pointer ${
                    form.criticality === 'Alta' 
                      ? 'bg-red-50 text-red-700 border-red-300' 
                      : form.criticality === 'Media' 
                      ? 'bg-amber-50 text-amber-800 border-amber-300' 
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  <option value="Alta">⚠ Alta (Crítica)</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>

            {/* Impactos */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Impactos Operativos
              </label>
              <div className="flex flex-wrap gap-2">
                {IMPACTS_LIST.map(imp => {
                  const isSelected = form.impacts.includes(imp);
                  return (
                    <button
                      key={imp}
                      type="button"
                      onClick={() => handleToggleImpact(imp)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        isSelected
                          ? imp === 'HSE'
                            ? 'bg-red-500 text-white border-red-600 shadow-xs'
                            : imp === 'INO'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : imp === 'CALIDAD'
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {imp}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: PROGRAMACIÓN */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
              <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-black flex items-center justify-center">
                2
              </span>
              <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Programación Operativa
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Día de Inicio
                </label>
                <select
                  value={form.startDayOffset}
                  onChange={e => setForm({ ...form, startDayOffset: parseInt(e.target.value) })}
                  className="w-full text-xs font-bold border border-gray-300 bg-white rounded-md p-2 outline-none focus:border-brand-blue cursor-pointer"
                >
                  {paradaInfo.days.map((d, i) => (
                    <option key={i} value={i}>
                      Día {i + 1} - {format(d.date, "EEE d/MM", { locale: es }).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Duración (Días)
                </label>
                <input
                  type="number"
                  min="1"
                  max={paradaInfo.durationDays - form.startDayOffset}
                  value={form.durationDays}
                  onChange={e => setForm({ ...form, durationDays: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs font-bold border border-gray-300 bg-white rounded-md p-2 outline-none focus:border-brand-blue"
                />
                {errors.durationDays && <p className="text-[10px] text-red-500 font-bold mt-0.5">{errors.durationDays}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Jornada Laboral
                </label>
                <select
                  value={form.workHours ?? 9}
                  onChange={e => setForm({ ...form, workHours: parseInt(e.target.value, 10) || 9 })}
                  className={`w-full text-xs font-bold border rounded-md p-2 outline-none cursor-pointer ${
                    (form.workHours ?? 9) === 12
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-black'
                      : 'bg-white text-gray-800 border-gray-300'
                  }`}
                >
                  <option value={9}>9 Horas (Estándar)</option>
                  <option value={12}>12 Horas (Extendida)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: RECURSOS NECESARIOS & EMPRESAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-black flex items-center justify-center">
                  3
                </span>
                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Recursos Necesarios y Asignación de Empresas
                </h4>
              </div>

              {unselectedSpecialties.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Agregar:</span>
                  {unselectedSpecialties.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => handleAddRequirement(spec)}
                      className="px-2 py-0.5 text-[10px] font-black rounded bg-gray-100 hover:bg-brand-blue hover:text-white text-gray-700 border border-gray-200 transition-colors cursor-pointer"
                    >
                      + {spec}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {form.requirements.map(req => {
                const summary = getRequirementAllocationSummary(req);
                const isExternal = EXTERNAL_SPECIALTIES.includes(req.specialty);
                const allowedCompanies = SPECIALTY_COMPANIES[req.specialty as ExternalSpecialty] || [];

                return (
                  <div 
                    key={req.specialty}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-xs font-black text-gray-800">
                          {SPECIALTY_LABELS[req.specialty] || req.specialty}
                        </span>
                        <span className="text-[10px] text-gray-400 block">
                          {isExternal ? 'Recurso Externo' : 'Especialidad Operativa'}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    {!isExternal && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRequirementCountChange(req.specialty, req.count - 1)}
                          disabled={req.count <= 1}
                          className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-700 disabled:opacity-30 font-bold text-xs flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-black text-brand-blue">
                          {req.count}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRequirementCountChange(req.specialty, req.count + 1)}
                          className="w-6 h-6 rounded bg-brand-blue text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Company Allocation Pill & Trigger */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPopoverReq(req)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                          summary.isComplete
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : summary.isOver
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : summary.assigned > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                        title="Modificar asignación de empresas contratistas"
                      >
                        <Building2 className="w-3.5 h-3.5 text-brand-orange" />
                        <span>{summary.label}</span>
                        <Pencil className="w-3 h-3 text-gray-400" />
                      </button>

                      {form.requirements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRequirement(req.specialty)}
                          className="p-1 rounded-md text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Eliminar recurso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {errors.requirements && <p className="text-xs text-red-500 font-semibold mt-1">{errors.requirements}</p>}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center shrink-0">
          {task?.id && onDelete ? (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Tarea
            </button>
          ) : <div />}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-lg bg-brand-blue text-white text-xs font-black hover:brightness-110 shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Guardar Tarea
            </button>
          </div>
        </div>
      </div>

      {/* Quick Resource Popover from modal if clicked */}
      {editingPopoverReq && (
        <QuickResourcePopover
          requirement={editingPopoverReq}
          taskTitle={form.title || 'Nueva Tarea'}
          onSave={handleQuickPopoverSave}
          onClose={() => setEditingPopoverReq(null)}
        />
      )}

      {/* Mandatory Delete Confirmation Modal */}
      {task && (
        <ConfirmDeleteModal
          isOpen={showConfirmDelete}
          task={task}
          selectedParada={selectedParada}
          planningStartDate={planningStartDate}
          onClose={() => setShowConfirmDelete(false)}
          onConfirm={(taskId) => {
            setShowConfirmDelete(false);
            if (onDelete) {
              onDelete(taskId);
            }
          }}
        />
      )}
    </div>
  );
};
