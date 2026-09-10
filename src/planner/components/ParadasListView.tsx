import React from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Calendar, 
  CalendarDays, 
  Users, 
  Building2, 
  ArrowRight,
  Check,
  Clock
} from 'lucide-react';
import { format, parseISO, isValid, parse, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ParadaEvent, 
  Task, 
  Specialty 
} from '../types';
import { 
  EXTERNAL_SPECIALTIES_LIST, 
  getEffectiveSpecialtyAvailability,
  getParadaDays 
} from '../constants';

interface ParadasListViewProps {
  paradas: ParadaEvent[];
  selectedParadaId: string | null;
  onSelectParada: (paradaId: string) => void;
  onOpenNewParada: () => void;
  onOpenEditParada: (parada: ParadaEvent) => void;
  onDeleteParada: (paradaId: string) => void;
  onNavigateToBoard: (paradaId: string) => void;
  tasks: Task[];
  planningStartDate: Date;
}

export const ParadasListView: React.FC<ParadasListViewProps> = ({
  paradas,
  selectedParadaId,
  onSelectParada,
  onOpenNewParada,
  onOpenEditParada,
  onDeleteParada,
  onNavigateToBoard,
  tasks,
  planningStartDate,
}) => {
  return (
    <div className="flex-1 space-y-4 overflow-auto">
      <div className="bg-white rounded-xl border border-border-gray shadow-md p-6">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div>
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">
              Registro de Hitos y Paradas Programadas
            </h2>
            <p className="text-xs text-gray-500">
              Defina períodos de intervención por fechas de calendario y disponibilidad diaria de personal contratista y propio.
            </p>
          </div>
          <button 
            type="button"
            onClick={onOpenNewParada}
            className="bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            NUEVA INTERVENCIÓN
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {paradas.map((parada) => {
            const isSelected = parada.id === selectedParadaId;
            const daysInfo = getParadaDays(parada, planningStartDate);
            const { startDate, endDate, durationDays, days } = daysInfo;

            const displayStartDate = format(startDate, 'dd/MM/yyyy');
            const displayEndDate = format(endDate, 'dd/MM/yyyy');
            const fullSpanText = `${format(startDate, "EEEE d 'de' MMMM", { locale: es })} al ${format(endDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}`;

            // Task count for this parada
            const paradaTasksCount = tasks.filter(t => t.paradaId ? t.paradaId === parada.id : true).length;

            // MEH stats
            const mehGlobals = (parada.specialtyAvailability || []).filter(s => s.specialty === 'MEH' && s.count !== null && s.count !== undefined);
            const mehDist = (parada.resourceAvailability || []).filter(r => r.specialty === 'MEH' && r.count !== null && r.count !== undefined);
            const mehCompanies = Array.from(new Set(mehDist.map(r => r.company)));

            // Compute total available MEH across all days of this parada
            let totalMehCapacity = 0;
            days.forEach(d => {
              const cap = getEffectiveSpecialtyAvailability(parada, d.dateStr, 'MEH');
              if (cap !== null) totalMehCapacity += cap;
            });

            return (
              <div 
                key={parada.id} 
                className={`border rounded-xl p-5 flex flex-col gap-4 shadow-2xs transition-all ${
                  isSelected 
                    ? 'bg-orange-50/40 border-brand-orange ring-1 ring-brand-orange/30' 
                    : 'bg-gray-50/90 border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Header row */}
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      isSelected ? 'bg-brand-orange text-white' : 'bg-orange-100/70 text-brand-orange'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-gray-800 tracking-tight">
                          {parada.title}
                        </h3>
                        {isSelected && (
                          <span className="bg-brand-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Activa para Planificación
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-600 font-bold">
                        <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-brand-blue flex items-center gap-1.5 shadow-2xs">
                          <CalendarDays className="w-3.5 h-3.5 text-brand-orange" />
                          {displayStartDate} → {displayEndDate} · {durationDays} {durationDays === 1 ? 'día' : 'días'}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium capitalize hidden sm:inline">
                          {fullSpanText}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigateToBoard(parada.id)}
                      className="bg-brand-blue hover:brightness-110 text-white px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Abrir cronograma de tareas para esta intervención"
                    >
                      <span>Ver Tareas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      type="button"
                      onClick={() => onOpenEditParada(parada)}
                      className="text-brand-blue hover:text-white bg-blue-50 hover:bg-brand-blue border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Editar intervención y disponibilidad"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Está seguro de eliminar la intervención "${parada.title}"?`)) {
                          onDeleteParada(parada.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Eliminar hito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Compact Resource & Contractor Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* MEH Summary */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Users className="w-3 h-3 text-brand-blue" />
                      Mecánicos (MEH)
                    </span>
                    <div className="text-xs font-bold text-gray-700">
                      {totalMehCapacity > 0 ? (
                        <span className="text-brand-blue font-black">
                          Capacidad total: {totalMehCapacity} personas-día
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Sin dotación registrada</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {mehCompanies.length > 0 ? (
                        <span>Empresas: <strong className="text-gray-700">{mehCompanies.join(', ')}</strong></span>
                      ) : (
                        <span className="text-gray-400 italic">Distribución por empresa pendiente</span>
                      )}
                    </div>
                  </div>

                  {/* Other External Specialties */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-brand-orange" />
                      Otras Especialidades
                    </span>
                    <div className="text-xs font-bold text-gray-700 flex flex-wrap gap-1 pt-0.5">
                      {EXTERNAL_SPECIALTIES_LIST.filter(s => s !== 'MEH').some(s => 
                        (parada.resourceAvailability || []).some(r => r.specialty === s && r.count !== null && r.count !== undefined) ||
                        (parada.specialtyAvailability || []).some(g => g.specialty === s && g.count !== null && g.count !== undefined)
                      ) ? (
                        EXTERNAL_SPECIALTIES_LIST.filter(s => s !== 'MEH').map(s => {
                          const has = (parada.resourceAvailability || []).some(r => r.specialty === s && r.count !== null && r.count !== undefined) ||
                                      (parada.specialtyAvailability || []).some(g => g.specialty === s && g.count !== null && g.count !== undefined);
                          if (!has) return null;
                          return (
                            <span key={s} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {s}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin terceros adicionales</span>
                      )}
                    </div>
                  </div>

                  {/* Tasks Planned in this window */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Tareas Asociadas
                    </span>
                    <div className="text-xs font-black text-brand-blue">
                      {paradaTasksCount} {paradaTasksCount === 1 ? 'tarea registrada' : 'tareas registradas'}
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium">
                      Ventana de ejecución de {durationDays} días
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {paradas.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No hay hitos o paradas registradas. Haga clic en "NUEVA INTERVENCIÓN" para definir fechas y contratistas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
