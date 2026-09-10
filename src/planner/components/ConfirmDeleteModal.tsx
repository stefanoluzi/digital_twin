import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Task, ParadaEvent } from '../types';
import { getParadaDays } from '../constants';

interface ConfirmDeleteModalProps {
  task: Task | null;
  isOpen: boolean;
  selectedParada?: ParadaEvent | null;
  planningStartDate?: Date;
  onClose: () => void;
  onConfirm: (taskId: string) => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  task,
  isOpen,
  selectedParada,
  planningStartDate = new Date(),
  onClose,
  onConfirm
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // Format date display
  let formattedDate = '—';
  if (task.startDate) {
    const parsed = parseISO(task.startDate.includes('T') ? task.startDate : `${task.startDate}T00:00:00`);
    if (isValid(parsed)) {
      formattedDate = format(parsed, 'dd/MM/yyyy', { locale: es });
    }
  } else if (selectedParada) {
    const paradaInfo = getParadaDays(selectedParada, planningStartDate);
    const day = paradaInfo.days[task.startDayOffset];
    if (day) {
      formattedDate = format(day.date, 'dd/MM/yyyy', { locale: es });
    }
  }

  const supervisorName = task.responsable?.trim() || 'Sin supervisor asignado';

  return (
    <div 
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* Modal Header */}
        <div className="bg-red-50/80 px-5 py-3.5 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-sm font-black text-gray-900 tracking-tight">
                Eliminar tarea
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Confirmación de acción destructiva
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5">
          <p className="text-xs text-gray-700 font-medium">
            ¿Seguro que querés eliminar esta tarea?
          </p>

          {/* Task Info Card */}
          <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 space-y-2">
            <div className="flex items-start gap-2">
              {task.criticality === 'Alta' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0 uppercase tracking-wider">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  CRÍTICA
                </span>
              )}
              <h4 className="text-xs font-black text-gray-900 leading-snug">
                "{task.title}"
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-gray-200 text-[11px]">
              <div>
                <span className="text-gray-400 font-bold uppercase text-[9px] block">Zona:</span>
                <span className="font-black text-gray-800">{task.zone}</span>
              </div>
              <div>
                <span className="text-gray-400 font-bold uppercase text-[9px] block">Fecha:</span>
                <span className="font-bold text-gray-800">{formattedDate}</span>
              </div>
              <div className="col-span-2 pt-0.5">
                <span className="text-gray-400 font-bold uppercase text-[9px] block">Supervisor:</span>
                <span className="font-bold text-gray-800">{supervisorName}</span>
              </div>
            </div>
          </div>

          {/* Destructive Warning */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Esta acción no se puede deshacer.</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-2.5">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 transition-colors shadow-2xs cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={() => onConfirm(task.id)}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-black hover:bg-red-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar tarea</span>
          </button>
        </div>
      </div>
    </div>
  );
};
