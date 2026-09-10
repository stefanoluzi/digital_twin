import React from 'react';
import { 
  X, 
  Building2, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ExternalLink,
  Filter,
  Layers,
  ChevronRight
} from 'lucide-react';
import { DailySpecialtyBalance } from '../utils/balanceAnalytics';
import { Task, Company } from '../types';
import { COMPANY_COLORS } from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DailyMehDistributionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  balance: DailySpecialtyBalance | null;
  onFilterPendingTasks?: () => void;
  onOpenTaskEdit?: (task: Task) => void;
  allTasks: Task[];
}

export const DailyMehDistributionPopover: React.FC<DailyMehDistributionPopoverProps> = ({
  isOpen,
  onClose,
  balance,
  onFilterPendingTasks,
  onOpenTaskEdit,
  allTasks
}) => {
  if (!isOpen || !balance) return null;

  let formattedDate = balance.dateStr;
  try {
    const d = new Date(balance.dateStr.includes('T') ? balance.dateStr : `${balance.dateStr}T00:00:00`);
    if (!isNaN(d.getTime())) {
      formattedDate = format(d, "EEEE d 'de' MMMM", { locale: es });
      formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }
  } catch (e) {
    // fallback
  }

  const allCompanyNames: Company[] = ['BFB', 'LOBERAZ', 'EMET', 'COMIBOR', 'TECHINT', 'ANDEMET'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800 tracking-wider uppercase">
                  {balance.dayLabel}
                </span>
                <span className="text-xs text-gray-500 font-medium">{formattedDate}</span>
              </div>
              <h3 className="text-base font-black text-gray-900 leading-tight mt-0.5">
                Distribución de Mecánicos (MEH)
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200/60 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Dual Balance Cards: Capacidad vs Distribución */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Capacidad de Personal */}
            <div className={`p-3.5 rounded-xl border ${
              balance.capacityStatus === 'overloaded'
                ? 'bg-red-50/70 border-red-200'
                : 'bg-blue-50/60 border-blue-200'
            }`}>
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider mb-1.5">
                <span className="text-gray-700">1. Capacidad de Personal</span>
                {balance.capacityStatus === 'overloaded' ? (
                  <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded font-black text-[11px]">
                    <AlertTriangle className="w-3 h-3" />
                    +{balance.capacityGap} Sobrecarga
                  </span>
                ) : balance.capacityStatus === 'availability-pending' ? (
                  <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-bold text-[10px]">
                    No definida
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-black text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Correcta
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-2xl font-black text-gray-900">{balance.assigned}</div>
                <div className="text-xs text-gray-500 font-semibold">
                  / {balance.available !== null ? `${balance.available} disponibles` : '— disp. no definida'}
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                {balance.capacityStatus === 'overloaded'
                  ? `Las tareas programadas superan la dotación global por ${balance.capacityGap} mecánicos.`
                  : balance.capacityStatus === 'availability-pending'
                  ? 'Dotación global no configurada para este día.'
                  : 'La dotación requerida está cubierta dentro de la disponibilidad global.'}
              </p>
            </div>

            {/* 2. Distribución Empresarial */}
            <div className={`p-3.5 rounded-xl border ${
              balance.distributionStatus === 'incomplete'
                ? 'bg-amber-50/70 border-amber-200'
                : balance.distributionStatus === 'overallocated'
                ? 'bg-purple-50/70 border-purple-200'
                : 'bg-emerald-50/60 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider mb-1.5">
                <span className="text-gray-700">2. Distribución Empresas</span>
                {balance.distributionStatus === 'incomplete' ? (
                  <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-black text-[11px]">
                    <AlertTriangle className="w-3 h-3" />
                    {balance.pendingCompany} pendientes
                  </span>
                ) : balance.distributionStatus === 'overallocated' ? (
                  <span className="inline-flex items-center gap-1 text-purple-800 bg-purple-100 px-2 py-0.5 rounded font-black text-[11px]">
                    +{balance.distributed - balance.assigned} sobreasignado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-black text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Completa
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-2xl font-black text-gray-900">{balance.distributed}</div>
                <div className="text-xs text-gray-500 font-semibold">
                  / {balance.assigned} distribuidos a tareas
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                {balance.distributionStatus === 'incomplete'
                  ? `Hay ${balance.pendingCompany} mecánicos requeridos que aún no tienen empresa asignada.`
                  : balance.distributionStatus === 'overallocated'
                  ? 'Inconsistencia: se asignaron más recursos a empresas que los requeridos.'
                  : 'Todos los mecánicos requeridos tienen contratista asignado.'}
              </p>
            </div>
          </div>

          {/* Desglose por Empresa Contratista */}
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-2.5 flex items-center justify-between">
              <span>Reparto entre Empresas Contratistas</span>
              <span className="text-[11px] font-bold text-gray-500">
                Total distribuido: {balance.distributed} / {balance.assigned}
              </span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allCompanyNames.map(comp => {
                const compItem = balance.companyDetails?.[comp];
                const count = compItem?.assigned ?? (balance.companyCounts[comp] || 0);
                const avail = compItem?.available ?? null;
                const isOver = compItem?.status === 'overloaded';
                const isComplete = compItem?.status === 'complete';
                const hasActivity = count > 0 || (avail !== null && avail > 0);

                return (
                  <div 
                    key={comp} 
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${
                      isOver 
                        ? 'bg-red-50/80 border-red-300 shadow-2xs' 
                        : count > 0 
                        ? 'bg-white border-gray-300 shadow-2xs' 
                        : 'bg-gray-100/60 border-gray-200 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: COMPANY_COLORS[comp] || '#64748b' }} 
                      />
                      <span className={`text-xs font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                        {comp}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-black ${isOver ? 'text-red-700' : count > 0 ? 'text-brand-blue' : 'text-gray-400'}`}>
                        {count} / {avail !== null ? avail : '—'}
                      </span>
                      {isOver && (
                        <span className="text-[10px] font-black text-red-700">
                          ⚠+{compItem?.gap}
                        </span>
                      )}
                      {isComplete && (
                        <span className="text-[10px] font-black text-emerald-600">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Empresa Pendiente */}
              <div className={`p-2.5 rounded-lg border flex items-center justify-between col-span-2 sm:col-span-3 ${
                balance.pendingCompany > 0 
                  ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold' 
                  : 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
              }`}>
                <div className="flex items-center gap-2">
                  {balance.pendingCompany > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-xs">
                    {balance.pendingCompany > 0 
                      ? 'Mecánicos sin Empresa Asignada' 
                      : 'Sin pendientes (100% asignado a empresas)'}
                  </span>
                </div>
                <span className={`text-sm font-black ${balance.pendingCompany > 0 ? 'text-amber-900' : 'text-emerald-700'}`}>
                  {balance.pendingCompany}
                </span>
              </div>
            </div>

            {balance.pendingCompany > 0 && onFilterPendingTasks && (
              <div className="mt-2.5 pt-2 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onFilterPendingTasks();
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtrar tareas con empresa pendiente en el tablero</span>
                </button>
              </div>
            )}
          </div>

          {/* Lista de Tareas Programadas para este día */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-2 flex items-center justify-between">
              <span>Tareas con Mecánicos en este Día ({balance.tasks.length})</span>
              <span className="text-[11px] font-bold text-gray-500">
                Suma: {balance.assigned} MEH
              </span>
            </h4>

            {balance.tasks.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
                No hay tareas con requerimientos de mecánicos en este día.
              </div>
            ) : (
              <div className="space-y-2">
                {balance.tasks.map(item => {
                  const rawTask = allTasks.find(t => t.id === item.taskId);
                  return (
                    <div 
                      key={item.taskId}
                      className="p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all flex flex-col gap-1.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                            item.criticality === 'Alta' ? 'bg-red-100 text-red-800' :
                            item.criticality === 'Media' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {item.criticality}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">
                            {item.zone}
                          </span>
                          <span className="font-bold text-gray-900 leading-snug">
                            {item.taskTitle}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="font-black text-brand-blue text-sm">
                            {item.count} MEH
                          </span>
                          {rawTask && onOpenTaskEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenTaskEdit(rawTask);
                                onClose();
                              }}
                              className="p-1 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded cursor-pointer transition-colors"
                              title="Editar tarea"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Allocations breakdown for this task */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
                        <span className="text-[10.5px] text-gray-500 font-semibold">Empresas:</span>
                        {item.companyAllocations.length > 0 ? (
                          item.companyAllocations.map(a => (
                            <span 
                              key={a.company}
                              className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-900 border border-blue-200"
                            >
                              {a.company}: {a.count}
                            </span>
                          ))
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            ⚠ Empresa pendiente ({item.count})
                          </span>
                        )}
                        {item.pendingCompany > 0 && item.companyAllocations.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            +{item.pendingCompany} pend.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-500">
            {balance.dayLabel} · Total {balance.assigned} MEH
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
