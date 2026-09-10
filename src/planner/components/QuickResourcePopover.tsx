import React, { useState } from 'react';
import { X, Check, Plus, Minus, AlertTriangle, Building2, HelpCircle } from 'lucide-react';
import { Specialty, Company, SpecialtyRequirement, CompanyAllocation, ExternalSpecialty } from '../types';
import { SPECIALTY_COMPANIES, SPECIALTY_LABELS, EXTERNAL_SPECIALTIES, getRequirementAssignedCount } from '../constants';

interface QuickResourcePopoverProps {
  requirement: SpecialtyRequirement;
  taskTitle: string;
  onSave: (updatedReq: SpecialtyRequirement) => void;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
}

export const QuickResourcePopover: React.FC<QuickResourcePopoverProps> = ({
  requirement,
  taskTitle,
  onSave,
  onClose,
  anchorPosition
}) => {
  const isExternal = EXTERNAL_SPECIALTIES.includes(requirement.specialty);
  const allowedCompanies = SPECIALTY_COMPANIES[requirement.specialty as ExternalSpecialty] || [];

  const [count, setCount] = useState<number>(requirement.count || 1);
  const [allocations, setAllocations] = useState<Record<Company, number>>(() => {
    const map: Partial<Record<Company, number>> = {};
    allowedCompanies.forEach(c => {
      map[c] = 0;
    });
    (requirement.companyAllocations || []).forEach(a => {
      map[a.company] = a.count;
    });
    return map as Record<Company, number>;
  });

  const assignedCount: number = (Object.values(allocations) as number[]).reduce((sum: number, val: number) => sum + (val || 0), 0);
  const pendingCount: number = count - assignedCount;
  const isOver: boolean = assignedCount > count;
  const isComplete: boolean = assignedCount === count && count > 0;

  const handleAllocationChange = (comp: Company, val: number) => {
    const safeVal = Math.max(0, val);
    setAllocations(prev => ({
      ...prev,
      [comp]: safeVal
    }));
  };

  const handleAutoAssignFirst = (comp: Company) => {
    setAllocations(prev => ({
      ...prev,
      [comp]: count
    }));
  };

  const handleClearAllocations = () => {
    const cleared: Partial<Record<Company, number>> = {};
    allowedCompanies.forEach(c => {
      cleared[c] = 0;
    });
    setAllocations(cleared as Record<Company, number>);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAllocations: CompanyAllocation[] = [];
    (Object.entries(allocations) as [Company, number][]).forEach(([c, num]) => {
      if (num > 0) {
        finalAllocations.push({ company: c, count: num });
      }
    });

    onSave({
      specialty: requirement.specialty,
      count: isExternal ? 1 : Math.max(1, count),
      companyAllocations: finalAllocations
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-3">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Popover Header */}
        <div className="bg-brand-blue text-white px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-white/70 uppercase tracking-widest block">
              Edición Rápida de Recursos
            </span>
            <h4 className="text-sm font-black flex items-center gap-1.5">
              {SPECIALTY_LABELS[requirement.specialty] || requirement.specialty}
            </h4>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-4 space-y-4 text-gray-800">
          {/* Task reference */}
          <div className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200 line-clamp-1 italic">
            Tarea: <strong className="text-gray-700 not-italic">{taskTitle}</strong>
          </div>

          {/* Quantity Stepper */}
          {!isExternal && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between">
              <div>
                <label className="text-[11px] font-black text-gray-600 uppercase tracking-wider block">
                  Técnicos Necesarios
                </label>
                <span className="text-[10px] text-gray-400 font-semibold">
                  (Requerimiento total del puesto)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCount(prev => Math.max(1, prev - 1))}
                  className="w-7 h-7 rounded-md bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-black text-sm flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={count}
                  onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center text-sm font-black py-1 border border-gray-300 rounded-md bg-white outline-none focus:border-brand-blue"
                />
                <button
                  type="button"
                  onClick={() => setCount(prev => prev + 1)}
                  className="w-7 h-7 rounded-md bg-brand-blue text-white hover:brightness-110 font-black text-sm flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Company Allocation Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-orange" />
                Empresa / Distribución
              </label>

              {allowedCompanies.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearAllocations}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Limpiar asignación
                </button>
              )}
            </div>

            {allowedCompanies.length === 0 ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                Especialidad sin contratistas específicos asociados.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allowedCompanies.map(company => {
                  const val = allocations[company] || 0;
                  return (
                    <div 
                      key={company}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                        val > 0 ? 'bg-orange-50/60 border-brand-orange/30' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">{company}</span>
                        {val === 0 && allowedCompanies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleAutoAssignFirst(company)}
                            className="text-[9px] text-brand-blue font-bold hover:underline cursor-pointer"
                          >
                            Asignar todo
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(company, val - 1)}
                          disabled={val <= 0}
                          className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-30 hover:bg-gray-100 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={count * 2}
                          value={val === 0 ? '' : val}
                          placeholder="0"
                          onChange={e => handleAllocationChange(company, parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-xs font-black py-0.5 border border-gray-300 rounded bg-white outline-none focus:border-brand-orange"
                        />
                        <button
                          type="button"
                          onClick={() => handleAllocationChange(company, val + 1)}
                          className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Validation Banner */}
            <div className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-between ${
              isOver 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : isComplete 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <div className="flex items-center gap-1.5">
                {isOver ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : isComplete ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <HelpCircle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {isOver
                    ? `⚠ Se asignaron ${assignedCount - count} más que los ${count} requeridos`
                    : isComplete
                    ? 'Asignación completa'
                    : `${assignedCount} asignados · ${pendingCount} pendientes`}
                </span>
              </div>
              <span className="font-black text-[11px]">
                {assignedCount} / {count}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-black hover:brightness-110 shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
