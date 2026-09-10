import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Check, 
  Trash2, 
  Users, 
  Building2, 
  ArrowRight, 
  Copy, 
  Eraser, 
  Info,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Save,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  ParadaEvent, 
  ExternalSpecialty, 
  Company, 
  DailyExternalResourceAvailability, 
  DailySpecialtyAvailability 
} from '../types';
import { 
  EXTERNAL_SPECIALTIES_LIST, 
  EXTERNAL_SPECIALTY_LABELS, 
  SPECIALTY_COMPANIES 
} from '../constants';
import { 
  format, 
  parseISO, 
  isValid, 
  addDays, 
  differenceInCalendarDays,
  parse
} from 'date-fns';
import { es } from 'date-fns/locale';

interface ParadaEditorProps {
  parada: ParadaEvent | null;
  projectStartDate: Date;
  onBack: () => void;
  onSave: (savedParada: ParadaEvent) => void;
  onDelete?: (paradaId: string) => void;
}

export const ParadaEditor: React.FC<ParadaEditorProps> = ({
  parada,
  projectStartDate,
  onBack,
  onSave,
  onDelete
}) => {
  const isEditing = Boolean(parada && parada.id);

  const [title, setTitle] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  
  // Key format: `${date}__${specialty}` -> number | null (Dotación global informada por programación)
  const [dailySpecialtyAvailabilityMap, setDailySpecialtyAvailabilityMap] = useState<Record<string, number | null>>({});

  // Key format: `${date}__${specialty}__${company}` -> number | null (Distribución por empresa contratista)
  const [dailyAvailabilityMap, setDailyAvailabilityMap] = useState<Record<string, number | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize or reset form when parada changes
  useEffect(() => {
    if (parada) {
      setTitle(parada.title || '');

      let startStr = '';
      let endStr = '';

      if (parada.startDate) {
        try {
          const d = parada.startDate.includes('T') ? parseISO(parada.startDate) : parse(parada.startDate, 'yyyy-MM-dd', new Date());
          if (isValid(d)) startStr = format(d, 'yyyy-MM-dd');
        } catch {
          // ignore
        }
      }
      if (!startStr) {
        const d = addDays(projectStartDate, parada.startDayOffset || 0);
        startStr = format(d, 'yyyy-MM-dd');
      }

      if (parada.endDate) {
        try {
          const d = parada.endDate.includes('T') ? parseISO(parada.endDate) : parse(parada.endDate, 'yyyy-MM-dd', new Date());
          if (isValid(d)) endStr = format(d, 'yyyy-MM-dd');
        } catch {
          // ignore
        }
      }
      if (!endStr) {
        try {
          const startD = parse(startStr, 'yyyy-MM-dd', new Date());
          const d = addDays(startD, Math.max(0, (parada.durationDays || 1) - 1));
          endStr = format(d, 'yyyy-MM-dd');
        } catch {
          endStr = startStr;
        }
      }

      setStartDateStr(startStr);
      setEndDateStr(endStr);

      // Populate dailySpecialtyAvailabilityMap (Global specialty totals)
      const specMap: Record<string, number | null> = {};
      if (Array.isArray(parada.specialtyAvailability)) {
        parada.specialtyAvailability.forEach((item: any) => {
          if (item.date) {
            specMap[`${item.date}__${item.specialty}`] = item.count;
          } else {
            // Backward-compatibility if date was missing
            try {
              const s = parse(startStr, 'yyyy-MM-dd', new Date());
              const e = parse(endStr, 'yyyy-MM-dd', new Date());
              if (isValid(s) && isValid(e) && e >= s) {
                const diff = differenceInCalendarDays(e, s);
                for (let i = 0; i <= diff; i++) {
                  const dStr = format(addDays(s, i), 'yyyy-MM-dd');
                  specMap[`${dStr}__${item.specialty}`] = item.count;
                }
              }
            } catch {
              // ignore
            }
          }
        });
      }
      setDailySpecialtyAvailabilityMap(specMap);

      // Populate dailyAvailabilityMap (Company distributions)
      const map: Record<string, number | null> = {};
      if (Array.isArray(parada.resourceAvailability)) {
        parada.resourceAvailability.forEach((item: any) => {
          if (item.date) {
            map[`${item.date}__${item.specialty}__${item.company}`] = item.count;
          } else {
            try {
              const s = parse(startStr, 'yyyy-MM-dd', new Date());
              const e = parse(endStr, 'yyyy-MM-dd', new Date());
              if (isValid(s) && isValid(e) && e >= s) {
                const diff = differenceInCalendarDays(e, s);
                for (let i = 0; i <= diff; i++) {
                  const dStr = format(addDays(s, i), 'yyyy-MM-dd');
                  map[`${dStr}__${item.specialty}__${item.company}`] = item.count;
                }
              }
            } catch {
              // ignore
            }
          }
        });
      }
      setDailyAvailabilityMap(map);
    } else {
      // New Parada default
      setTitle('Nueva Intervención');
      const startD = projectStartDate;
      const endD = addDays(projectStartDate, 6); // 7 days default
      const sStr = format(startD, 'yyyy-MM-dd');
      const eStr = format(endD, 'yyyy-MM-dd');
      setStartDateStr(sStr);
      setEndDateStr(eStr);
      setDailySpecialtyAvailabilityMap({});
      setDailyAvailabilityMap({});
    }
    setErrors({});
    setIsDirty(false);
  }, [parada, projectStartDate]);

  // Derived formatted date preview in Spanish
  const startDateFormatted = useMemo(() => {
    if (!startDateStr) return '';
    try {
      const d = parse(startDateStr, 'yyyy-MM-dd', new Date());
      if (isValid(d)) {
        return format(d, "EEEE d 'de' MMMM, yyyy", { locale: es });
      }
    } catch {
      // ignore
    }
    return '';
  }, [startDateStr]);

  const endDateFormatted = useMemo(() => {
    if (!endDateStr) return '';
    try {
      const d = parse(endDateStr, 'yyyy-MM-dd', new Date());
      if (isValid(d)) {
        return format(d, "EEEE d 'de' MMMM, yyyy", { locale: es });
      }
    } catch {
      // ignore
    }
    return '';
  }, [endDateStr]);

  // Dynamic list of days between startDate and endDate (Supports > 7 days up to 120 days)
  const datesList = useMemo(() => {
    if (!startDateStr || !endDateStr) return [];
    try {
      const s = parse(startDateStr, 'yyyy-MM-dd', new Date());
      const e = parse(endDateStr, 'yyyy-MM-dd', new Date());
      if (!isValid(s) || !isValid(e) || e < s) return [];
      
      const diff = differenceInCalendarDays(e, s);
      const totalDays = Math.min(diff + 1, 120);

      return Array.from({ length: totalDays }, (_, i) => {
        const d = addDays(s, i);
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          dayNameShort: format(d, 'EEE', { locale: es }).toUpperCase().replace('.', ''),
          dayNumber: format(d, 'd'),
          dayMonth: format(d, 'd/MM'),
          fullDisplay: format(d, "EEEE d 'de' MMMM", { locale: es })
        };
      });
    } catch {
      return [];
    }
  }, [startDateStr, endDateStr]);

  // Metrics for header quick status
  const mehStats = useMemo(() => {
    if (datesList.length === 0) return { globalDefinedDays: 0, fullyDistributedDays: 0, totalGlobal: 0, totalDist: 0 };
    let globalDefinedDays = 0;
    let fullyDistributedDays = 0;
    let totalGlobal = 0;
    let totalDist = 0;

    const companies = SPECIALTY_COMPANIES.MEH || [];

    datesList.forEach(day => {
      const gKey = `${day.dateStr}__MEH`;
      const gVal = dailySpecialtyAvailabilityMap[gKey];
      const hasGlobal = gVal !== null && gVal !== undefined;

      let dayDistSum = 0;
      let hasAnyCompany = false;
      companies.forEach(comp => {
        const cVal = dailyAvailabilityMap[`${day.dateStr}__MEH__${comp}`];
        if (typeof cVal === 'number') {
          dayDistSum += cVal;
          hasAnyCompany = true;
        }
      });

      if (hasGlobal && gVal !== null) {
        globalDefinedDays += 1;
        totalGlobal += gVal;
        if (hasAnyCompany && dayDistSum === gVal) {
          fullyDistributedDays += 1;
        }
      } else if (hasAnyCompany) {
        totalDist += dayDistSum;
      }
      if (hasAnyCompany) {
        totalDist += dayDistSum;
      }
    });

    return {
      globalDefinedDays,
      fullyDistributedDays,
      totalGlobal,
      totalDist
    };
  }, [datesList, dailySpecialtyAvailabilityMap, dailyAvailabilityMap]);

  // Change handler for global specialty total (e.g. MEH Total Disponible)
  const handleSpecialtyTotalChange = (dateStr: string, specialty: ExternalSpecialty, value: string) => {
    setIsDirty(true);
    const key = `${dateStr}__${specialty}`;
    if (value.trim() === '') {
      setDailySpecialtyAvailabilityMap(prev => ({ ...prev, [key]: null }));
    } else {
      const parsed = parseInt(value, 10);
      setDailySpecialtyAvailabilityMap(prev => ({ 
        ...prev, 
        [key]: isNaN(parsed) ? null : Math.max(0, parsed) 
      }));
    }
  };

  // Repeat global specialty total across remaining days
  const handleSpecialtyRepeatRight = (specialty: ExternalSpecialty, fromIndex: number) => {
    if (datesList.length <= 1 || fromIndex >= datesList.length - 1) return;
    setIsDirty(true);
    const sourceDate = datesList[fromIndex].dateStr;
    const sourceKey = `${sourceDate}__${specialty}`;
    const valueToRepeat = dailySpecialtyAvailabilityMap[sourceKey] !== undefined ? dailySpecialtyAvailabilityMap[sourceKey] : null;

    setDailySpecialtyAvailabilityMap(prev => {
      const nextMap = { ...prev };
      for (let i = fromIndex + 1; i < datesList.length; i++) {
        const targetDate = datesList[i].dateStr;
        nextMap[`${targetDate}__${specialty}`] = valueToRepeat;
      }
      return nextMap;
    });
  };

  // Clear global specialty row
  const handleSpecialtyClearRow = (specialty: ExternalSpecialty) => {
    setIsDirty(true);
    setDailySpecialtyAvailabilityMap(prev => {
      const nextMap = { ...prev };
      datesList.forEach(d => {
        const key = `${d.dateStr}__${specialty}`;
        nextMap[key] = null;
      });
      return nextMap;
    });
  };

  // Change handler for company distribution cell
  const handleCellChange = (dateStr: string, specialty: ExternalSpecialty, company: Company, value: string) => {
    setIsDirty(true);
    const key = `${dateStr}__${specialty}__${company}`;
    if (value.trim() === '') {
      setDailyAvailabilityMap(prev => ({ ...prev, [key]: null }));
    } else {
      const parsed = parseInt(value, 10);
      setDailyAvailabilityMap(prev => ({ 
        ...prev, 
        [key]: isNaN(parsed) ? null : Math.max(0, parsed) 
      }));
    }
  };

  // Productivity Action A: Repetir hacia la derecha
  const handleRepeatRight = (specialty: ExternalSpecialty, company: Company, fromIndex: number) => {
    if (datesList.length <= 1 || fromIndex >= datesList.length - 1) return;
    setIsDirty(true);
    const sourceDate = datesList[fromIndex].dateStr;
    const sourceKey = `${sourceDate}__${specialty}__${company}`;
    const valueToRepeat = dailyAvailabilityMap[sourceKey] !== undefined ? dailyAvailabilityMap[sourceKey] : null;

    setDailyAvailabilityMap(prev => {
      const nextMap = { ...prev };
      for (let i = fromIndex + 1; i < datesList.length; i++) {
        const targetDate = datesList[i].dateStr;
        nextMap[`${targetDate}__${specialty}__${company}`] = valueToRepeat;
      }
      return nextMap;
    });
  };

  // Productivity Action B: Copiar día anterior
  const handleCopyPreviousDay = (targetDayIndex: number) => {
    if (targetDayIndex <= 0 || targetDayIndex >= datesList.length) return;
    setIsDirty(true);
    const prevDate = datesList[targetDayIndex - 1].dateStr;
    const targetDate = datesList[targetDayIndex].dateStr;

    // 1. Copy global specialty totals
    setDailySpecialtyAvailabilityMap(prev => {
      const nextMap = { ...prev };
      EXTERNAL_SPECIALTIES_LIST.forEach(spec => {
        const prevKey = `${prevDate}__${spec}`;
        const targetKey = `${targetDate}__${spec}`;
        if (prev[prevKey] !== undefined) {
          nextMap[targetKey] = prev[prevKey];
        }
      });
      return nextMap;
    });

    // 2. Copy company breakdowns
    setDailyAvailabilityMap(prev => {
      const nextMap = { ...prev };
      EXTERNAL_SPECIALTIES_LIST.forEach(spec => {
        const companies = SPECIALTY_COMPANIES[spec] || [];
        companies.forEach(comp => {
          const prevKey = `${prevDate}__${spec}__${comp}`;
          const targetKey = `${targetDate}__${spec}__${comp}`;
          if (prev[prevKey] !== undefined) {
            nextMap[targetKey] = prev[prevKey];
          }
        });
      });
      return nextMap;
    });
  };

  // Productivity Action C: Limpiar fila
  const handleClearRow = (specialty: ExternalSpecialty, company: Company) => {
    setIsDirty(true);
    setDailyAvailabilityMap(prev => {
      const nextMap = { ...prev };
      datesList.forEach(d => {
        const key = `${d.dateStr}__${specialty}__${company}`;
        nextMap[key] = null;
      });
      return nextMap;
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) {
      errs.title = 'El título de la intervención es obligatorio.';
    }
    if (!startDateStr) {
      errs.startDate = 'Debe seleccionar una fecha de inicio.';
    }
    if (!endDateStr) {
      errs.endDate = 'Debe seleccionar una fecha de finalización.';
    }
    if (startDateStr && endDateStr) {
      const startD = parse(startDateStr, 'yyyy-MM-dd', new Date());
      const endD = parse(endDateStr, 'yyyy-MM-dd', new Date());
      if (isValid(startD) && isValid(endD) && endD < startD) {
        errs.endDate = 'La fecha de finalización no puede ser anterior a la de inicio.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      // Scroll to top to see validation errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const startD = parse(startDateStr, 'yyyy-MM-dd', new Date());
    const endD = parse(endDateStr, 'yyyy-MM-dd', new Date());

    const startDayOffset = differenceInCalendarDays(startD, projectStartDate);
    const durationDays = Math.max(1, differenceInCalendarDays(endD, startD) + 1);

    // 1. Build specialtyAvailability array for global totals
    const specialtyAvailability: DailySpecialtyAvailability[] = [];
    datesList.forEach(d => {
      EXTERNAL_SPECIALTIES_LIST.forEach(spec => {
        const key = `${d.dateStr}__${spec}`;
        const val = dailySpecialtyAvailabilityMap[key];
        if (val !== undefined) {
          specialtyAvailability.push({
            date: d.dateStr,
            specialty: spec,
            count: val
          });
        }
      });
    });

    // 2. Build resourceAvailability array for company distributions
    const resourceAvailability: DailyExternalResourceAvailability[] = [];
    datesList.forEach(d => {
      EXTERNAL_SPECIALTIES_LIST.forEach(spec => {
        const companies = SPECIALTY_COMPANIES[spec] || [];
        companies.forEach(comp => {
          const key = `${d.dateStr}__${spec}__${comp}`;
          const val = dailyAvailabilityMap[key];
          if (val !== undefined) {
            resourceAvailability.push({
              date: d.dateStr,
              specialty: spec,
              company: comp,
              count: val
            });
          }
        });
      });
    });

    const savedParada: ParadaEvent = {
      id: parada?.id || Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      startDate: startDateStr,
      endDate: endDateStr,
      startDayOffset,
      durationDays,
      specialtyAvailability,
      resourceAvailability
    };

    onSave(savedParada);
    setIsDirty(false);
    setShowSavedFeedback(true);
    setTimeout(() => {
      setShowSavedFeedback(false);
    }, 3000);
  };

  const handleBackClick = () => {
    if (isDirty) {
      if (window.confirm('Hay modificaciones sin guardar en esta intervención. ¿Desea salir y descartar los cambios?')) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-gray-50/50 min-h-[calc(100vh-120px)] animate-in fade-in duration-200">
      {/* 1. STICKY TOP ACTION & NAVIGATION HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Back & Breadcrumb title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackClick}
              className="group flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-brand-blue bg-gray-100/80 hover:bg-blue-50 px-3 py-2 rounded-lg border border-gray-200/80 hover:border-blue-200 transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Volver a Hitos y Paradas</span>
            </button>

            <div className="hidden sm:block h-5 w-px bg-gray-200" />

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight line-clamp-1">
                  {title.trim() || (isEditing ? 'Editar Intervención' : 'Nueva Intervención')}
                </h1>
                {isEditing ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                    Parada Programada
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0">
                    Nueva
                  </span>
                )}
              </div>

              {datesList.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium mt-0.5">
                  <span className="flex items-center gap-1 text-gray-700 font-bold">
                    <CalendarDays className="w-3 h-3 text-brand-orange" />
                    {datesList[0]?.dayMonth} → {datesList[datesList.length - 1]?.dayMonth}
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-gray-600">
                    {datesList.length} {datesList.length === 1 ? 'día' : 'días'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Indicators & Save Actions */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Quick status summary badge for MEH */}
            {datesList.length > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-xs">
                <span className="text-[11px] font-bold text-gray-600">
                  MEH global: <strong className="text-brand-blue font-black">{mehStats.globalDefinedDays}/{datesList.length} días</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-[11px] font-bold text-gray-600">
                  Distribución completa: <strong className={mehStats.fullyDistributedDays === datesList.length ? "text-emerald-600 font-black" : "text-amber-800 font-black"}>
                    {mehStats.fullyDistributedDays}/{datesList.length} días
                  </strong>
                </span>
              </div>
            )}

            {/* Saved Toast Feedback */}
            {showSavedFeedback && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold animate-in fade-in slide-in-from-top-1">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Cambios guardados</span>
              </div>
            )}

            {/* Primary Save Button */}
            <button
              type="button"
              onClick={handleSave}
              className="bg-brand-blue hover:brightness-110 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar cambios</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* SECTION 1: DATOS GENERALES */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-50 rounded-lg text-brand-orange">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  DATOS GENERALES DE LA INTERVENCIÓN
                </h2>
                <p className="text-[11px] text-gray-500">
                  Defina el nombre identificatorio y el rango de calendario de la parada.
                </p>
              </div>
            </div>

            {datesList.length > 0 && (
              <span className="text-xs font-black text-brand-blue bg-blue-50 px-3 py-1 rounded-md border border-blue-100">
                {datesList.length} {datesList.length === 1 ? 'día programado' : 'días programados'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Nombre de la intervención */}
            <div className="lg:col-span-6 space-y-1">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Nombre / Título de la Intervención <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => {
                  setIsDirty(true);
                  setTitle(e.target.value);
                }}
                placeholder="Ej. REX Agosto 2026 / Parada Horno de Fusión"
                className={`w-full text-sm font-semibold border rounded-lg p-2.5 outline-none transition-all ${
                  errors.title ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10'
                }`}
              />
              {errors.title ? (
                <p className="text-xs text-red-500 mt-1 font-semibold">{errors.title}</p>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Nombre descriptivo visible en el tablero y reportes de parada.
                </p>
              )}
            </div>

            {/* Fecha Inicio */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Fecha de Inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDateStr}
                onChange={e => {
                  setIsDirty(true);
                  const newStart = e.target.value;
                  setStartDateStr(newStart);
                  if (endDateStr && newStart > endDateStr) {
                    setEndDateStr(newStart);
                  }
                }}
                className={`w-full text-xs font-bold border rounded-lg p-2.5 bg-white outline-none focus:border-brand-blue ${
                  errors.startDate ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'
                }`}
              />
              {startDateFormatted && (
                <p className="text-[11px] text-brand-blue font-medium capitalize mt-1 pl-0.5">
                  {startDateFormatted}
                </p>
              )}
              {errors.startDate && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.startDate}</p>}
            </div>

            {/* Fecha Fin */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Fecha de Finalización <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                min={startDateStr || undefined}
                value={endDateStr}
                onChange={e => {
                  setIsDirty(true);
                  setEndDateStr(e.target.value);
                }}
                className={`w-full text-xs font-bold border rounded-lg p-2.5 bg-white outline-none focus:border-brand-blue ${
                  errors.endDate ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'
                }`}
              />
              {endDateFormatted && (
                <p className="text-[11px] text-brand-blue font-medium capitalize mt-1 pl-0.5">
                  {endDateFormatted}
                </p>
              )}
              {errors.endDate && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.endDate}</p>}
            </div>
          </div>
        </section>

        {/* SECTION 2: DISPONIBILIDAD DE TERCEROS (FULL WIDTH MATRIX) */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg text-brand-blue">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  DISPONIBILIDAD DE TERCEROS Y CONTRATISTAS
                </h2>
                <p className="text-[11px] text-gray-500">
                  Matriz diaria por especialidad y empresa. Para <strong className="text-gray-800">MEH (Mecánicos)</strong> cargue la dotación global y distribuya por contratista.
                </p>
              </div>
            </div>

            {/* Quick legend & Productivity hints */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /> Vacío = Pendiente
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-blue inline-block" /> 0 o N = Confirmado
              </span>
              <span className="hidden sm:inline text-gray-300">|</span>
              <span className="hidden sm:flex items-center gap-1 text-gray-600 font-semibold">
                <ArrowRight className="w-3 h-3 text-brand-orange" /> Repetir hacia la derecha
              </span>
            </div>
          </div>

          {datesList.length === 0 ? (
            <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 text-xs font-bold space-y-2">
              <Calendar className="w-8 h-8 mx-auto text-gray-300" />
              <p>Seleccione fechas válidas de inicio y finalización para desplegar la matriz de recursos.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {/* Responsive horizontal scroll container with sticky columns */}
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  {/* Table Header Row (Sticky top of the table) */}
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gray-100/95 border-b border-gray-200 text-xs font-black text-gray-700">
                      {/* Fixed Left Column for Specialty / Company */}
                      <th className="sticky left-0 bg-gray-100 z-30 py-3 px-4 border-r border-gray-200 w-64 min-w-[220px] max-w-[260px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <span className="uppercase tracking-wider text-[11px] text-gray-700 font-black">
                          Especialidad / Empresa
                        </span>
                      </th>

                      {/* Day Columns */}
                      {datesList.map((day, idx) => (
                        <th 
                          key={day.dateStr} 
                          className="py-2.5 px-2 text-center border-r border-gray-200 last:border-r-0 min-w-[105px] max-w-[130px] font-bold"
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-black text-brand-blue">
                              {day.dayNameShort} {day.dayNumber}
                            </span>
                            <span className="text-[10px] text-gray-500 font-normal">
                              {day.dayMonth}
                            </span>

                            {/* Action: Copiar día anterior */}
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleCopyPreviousDay(idx)}
                                title={`Copiar dotación y empresas del día anterior (${datesList[idx - 1].dayNameShort} ${datesList[idx - 1].dayNumber})`}
                                className="mt-1 text-[9px] font-bold text-gray-500 hover:text-brand-blue bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-1.5 py-0.5 rounded transition-all flex items-center gap-1 shadow-2xs"
                              >
                                <Copy className="w-2.5 h-2.5" />
                                <span>Copiar ant.</span>
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {EXTERNAL_SPECIALTIES_LIST.map((spec) => {
                      const companies = SPECIALTY_COMPANIES[spec] || [];
                      const specLabel = EXTERNAL_SPECIALTY_LABELS[spec] || spec;
                      const isMEH = spec === 'MEH';

                      // Calculate distributed sum per day
                      const dailyDistributed = datesList.map(day => {
                        let sum = 0;
                        let hasAny = false;
                        companies.forEach(comp => {
                          const val = dailyAvailabilityMap[`${day.dateStr}__${spec}__${comp}`];
                          if (typeof val === 'number') {
                            sum += val;
                            hasAny = true;
                          }
                        });
                        return { sum, hasAny };
                      });

                      // Calculate global totals and pending differences
                      const dailyGlobals = datesList.map((day, idx) => {
                        const globalKey = `${day.dateStr}__${spec}`;
                        const rawGlobal = dailySpecialtyAvailabilityMap[globalKey];
                        const hasGlobal = rawGlobal !== null && rawGlobal !== undefined;
                        const globalCount = hasGlobal ? rawGlobal : null;
                        const dist = dailyDistributed[idx];
                        
                        let pending: number | null = null;
                        if (hasGlobal && globalCount !== null) {
                          pending = globalCount - (dist.hasAny ? dist.sum : 0);
                        }

                        return {
                          hasGlobal,
                          globalCount,
                          distSum: dist.sum,
                          hasDist: dist.hasAny,
                          pending
                        };
                      });

                      return (
                        <React.Fragment key={spec}>
                          {/* Specialty Group Header Row */}
                          <tr className="bg-gray-50/90 font-black text-gray-800 border-t-2 border-gray-200">
                            <td 
                              colSpan={datesList.length + 1} 
                              className="py-2.5 px-4 text-xs text-brand-blue tracking-wide uppercase bg-blue-50/50"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-xs">{specLabel}</span>
                                  {isMEH && (
                                    <span className="text-[10px] lowercase font-normal bg-brand-blue/10 text-brand-blue px-2.5 py-0.5 rounded-full font-medium">
                                      dotación global + distribución por contratista
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* MEH ONLY: PROMINENT TOTAL DISPONIBLE ROW */}
                          {isMEH && (
                            <tr className="bg-blue-50/60 border-y-2 border-blue-200">
                              {/* Sticky Left Header for Total Disponible */}
                              <td className="sticky left-0 bg-blue-50 z-10 py-2.5 px-3 border-r border-blue-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-brand-blue uppercase tracking-wider flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-brand-orange" />
                                      TOTAL DISPONIBLE
                                    </span>
                                    <span className="text-[9px] text-gray-500 font-medium">
                                      Informado por Programación
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {datesList.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleSpecialtyRepeatRight(spec, 0)}
                                        title="Repetir dotación hacia todos los días de la parada"
                                        className="text-[10px] text-gray-500 hover:text-brand-blue hover:bg-white p-1 rounded transition-colors"
                                      >
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleSpecialtyClearRow(spec)}
                                      title="Limpiar dotación global"
                                      className="text-[10px] text-gray-400 hover:text-red-500 hover:bg-white p-1 rounded transition-colors"
                                    >
                                      <Eraser className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Input cell for each day */}
                              {datesList.map((day, dIdx) => {
                                const key = `${day.dateStr}__${spec}`;
                                const rawVal = dailySpecialtyAvailabilityMap[key];
                                const displayVal = rawVal === null || rawVal === undefined ? '' : rawVal;

                                return (
                                  <td 
                                    key={day.dateStr} 
                                    className="py-2 px-2 text-center border-r border-blue-200 last:border-r-0 bg-blue-50/40"
                                  >
                                    <div className="relative flex items-center justify-center">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="–"
                                        value={displayVal}
                                        onChange={e => handleSpecialtyTotalChange(day.dateStr, spec, e.target.value)}
                                        className={`w-16 h-8 text-center rounded text-xs font-black outline-none transition-all placeholder:text-gray-400 shadow-2xs ${
                                          rawVal !== null && rawVal !== undefined
                                            ? 'bg-white border-2 border-brand-blue text-brand-blue font-black focus:ring-2 focus:ring-brand-blue/20'
                                            : 'bg-white border border-blue-200 text-gray-700 hover:border-brand-blue/50 focus:border-brand-blue'
                                        }`}
                                      />
                                      {dIdx < datesList.length - 1 && rawVal !== null && rawVal !== undefined && (
                                        <button
                                          type="button"
                                          onClick={() => handleSpecialtyRepeatRight(spec, dIdx)}
                                          title={`Replicar ${rawVal} hacia los días siguientes`}
                                          className="absolute -right-1 text-gray-400 hover:text-brand-orange transition-colors opacity-0 hover:opacity-100 focus:opacity-100 z-1"
                                        >
                                          <ArrowRight className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          )}

                          {/* Subheader for Company distribution */}
                          {isMEH && (
                            <tr className="bg-gray-50/60 text-[10px] text-gray-500 uppercase font-black tracking-wider">
                              <td colSpan={datesList.length + 1} className="py-1 px-4 bg-gray-50/80 border-b border-gray-200">
                                Distribución por empresa contratista:
                              </td>
                            </tr>
                          )}

                          {/* Contractor Company Rows */}
                          {companies.length === 0 ? (
                            <tr>
                              <td 
                                colSpan={datesList.length + 1} 
                                className="py-4 px-4 text-center text-xs text-gray-400 italic font-medium bg-white"
                              >
                                {specLabel} ({spec}) — empresas contratistas no configuradas
                              </td>
                            </tr>
                          ) : (
                            <>
                              {companies.map((comp) => (
                                <tr key={comp} className="hover:bg-blue-50/20 transition-colors">
                                  {/* Sticky Company Title */}
                                  <td className="sticky left-0 bg-white hover:bg-blue-50/20 z-10 py-2 px-3 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 font-bold text-gray-800 pl-1">
                                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span>{comp}</span>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {datesList.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRepeatRight(spec, comp, 0)}
                                            title="Repetir primer valor hacia la derecha (todos los días)"
                                            className="text-[10px] text-gray-400 hover:text-brand-blue hover:bg-blue-50 p-1 rounded transition-colors"
                                          >
                                            <ArrowRight className="w-3 h-3" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleClearRow(spec, comp)}
                                          title="Limpiar fila (vaciar todos los días)"
                                          className="text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                        >
                                          <Eraser className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Day input cells */}
                                  {datesList.map((day, dIdx) => {
                                    const key = `${day.dateStr}__${spec}__${comp}`;
                                    const rawVal = dailyAvailabilityMap[key];
                                    const displayVal = rawVal === null || rawVal === undefined ? '' : rawVal;

                                    return (
                                      <td 
                                        key={day.dateStr} 
                                        className="py-1.5 px-2 text-center border-r border-gray-200 last:border-r-0"
                                      >
                                        <div className="relative flex items-center justify-center">
                                          <input
                                            type="number"
                                            min="0"
                                            placeholder="–"
                                            value={displayVal}
                                            onChange={e => handleCellChange(day.dateStr, spec, comp, e.target.value)}
                                            className={`w-14 h-7.5 text-center rounded text-xs font-black outline-none transition-all placeholder:text-gray-300 ${
                                              rawVal !== null && rawVal !== undefined
                                                ? 'bg-blue-50/70 border border-blue-300 text-brand-blue font-black focus:ring-1 focus:ring-brand-blue'
                                                : 'bg-gray-50/80 border border-gray-200 text-gray-700 hover:border-gray-300 focus:bg-white focus:border-brand-blue'
                                            }`}
                                          />
                                          {dIdx < datesList.length - 1 && rawVal !== null && rawVal !== undefined && (
                                            <button
                                              type="button"
                                              onClick={() => handleRepeatRight(spec, comp, dIdx)}
                                              title={`Replicar ${rawVal} hacia los días siguientes`}
                                              className="absolute -right-1 text-gray-300 hover:text-brand-orange transition-colors opacity-0 hover:opacity-100 focus:opacity-100 z-1"
                                            >
                                              <ArrowRight className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}

                              {/* TOTAL DISTRIBUIDO ROW */}
                              <tr className="bg-gray-100/80 font-bold border-t border-gray-200 text-xs">
                                <td className="sticky left-0 bg-gray-100 z-10 py-1.5 px-4 border-r border-gray-200 text-[11px] font-black text-gray-700 uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                  {isMEH ? 'TOTAL DISTRIBUIDO' : `TOTAL ${spec}`}
                                </td>
                                {dailyDistributed.map((tot, idx) => (
                                  <td 
                                    key={datesList[idx].dateStr} 
                                    className="py-1.5 px-2 text-center border-r border-gray-200 last:border-r-0"
                                  >
                                    <span className={`text-xs font-black inline-block px-2 py-0.5 rounded ${
                                      tot.hasAny 
                                        ? 'bg-gray-700 text-white shadow-2xs' 
                                        : 'text-gray-400 font-normal'
                                    }`}>
                                      {tot.hasAny ? tot.sum : '–'}
                                    </span>
                                  </td>
                                ))}
                              </tr>

                              {/* MEH ONLY: PENDIENTE DE ASIGNAR ROW */}
                              {isMEH && (
                                <tr className="bg-gray-50 font-bold border-b border-gray-200 text-xs">
                                  <td className="sticky left-0 bg-gray-50 z-10 py-1.5 px-4 border-r border-gray-200 text-[11px] font-black text-gray-600 uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                                    PENDIENTE DE ASIGNAR
                                  </td>
                                  {dailyGlobals.map((g, idx) => {
                                    if (!g.hasGlobal || g.pending === null) {
                                      return (
                                        <td 
                                          key={datesList[idx].dateStr} 
                                          className="py-1.5 px-2 text-center border-r border-gray-200 last:border-r-0 text-gray-400"
                                        >
                                          –
                                        </td>
                                      );
                                    }

                                    const isComplete = g.pending === 0;
                                    const isPending = g.pending > 0;
                                    const isOver = g.pending < 0;

                                    return (
                                      <td 
                                        key={datesList[idx].dateStr} 
                                        className="py-1.5 px-2 text-center border-r border-gray-200 last:border-r-0"
                                      >
                                        {isComplete && (
                                          <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block">
                                            0
                                          </span>
                                        )}
                                        {isPending && (
                                          <span className="text-[11px] font-black text-brand-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block" title={`${g.pending} mecánicos pendientes de asignar a empresa`}>
                                            {g.pending}
                                          </span>
                                        )}
                                        {isOver && (
                                          <span className="text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded inline-block" title={`La distribución por empresas supera la dotación global en ${Math.abs(g.pending)} mecánicos`}>
                                            +{Math.abs(g.pending)}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Informative Status Banner for MEH Validation Rules */}
              {datesList.some(day => {
                const gKey = `${day.dateStr}__MEH`;
                const gVal = dailySpecialtyAvailabilityMap[gKey];
                return gVal !== null && gVal !== undefined;
              }) && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs space-y-2">
                  <span className="font-black text-gray-600 text-[11px] uppercase tracking-wider block">
                    Estado de Asignación Diaria (Mecánicos MEH):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {datesList.map(day => {
                      const gKey = `${day.dateStr}__MEH`;
                      const gVal = dailySpecialtyAvailabilityMap[gKey];
                      if (gVal === null || gVal === undefined) return null;

                      let distSum = 0;
                      let hasAnyDist = false;
                      const mehCompanies = SPECIALTY_COMPANIES.MEH || [];
                      mehCompanies.forEach(comp => {
                        const val = dailyAvailabilityMap[`${day.dateStr}__MEH__${comp}`];
                        if (typeof val === 'number') {
                          distSum += val;
                          hasAnyDist = true;
                        }
                      });

                      const pending = gVal - (hasAnyDist ? distSum : 0);

                      if (pending < 0) {
                        return (
                          <div key={day.dateStr} className="flex items-center gap-2 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>
                              {day.dayNameShort} {day.dayNumber}: Exceso de {Math.abs(pending)} mecánicos ({distSum}/{gVal})
                            </span>
                          </div>
                        );
                      }

                      if (pending > 0) {
                        return (
                          <div key={day.dateStr} className="flex items-center gap-2 text-brand-blue font-medium bg-blue-50/70 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs">
                            <Info className="w-3.5 h-3.5 shrink-0 text-brand-blue" />
                            <span>
                              {day.dayNameShort} {day.dayNumber}: <strong className="font-bold">{pending}</strong> pendientes de asignar ({distSum}/{gVal})
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={day.dateStr} className="flex items-center gap-2 text-emerald-700 text-xs font-medium bg-emerald-50/80 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span>
                            {day.dayNameShort} {day.dayNumber}: Distribución completa ({gVal} mecánicos)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. FOOTER ACTIONS BAR */}
        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-wrap justify-between items-center gap-3 shadow-2xs">
          {isEditing && onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Está seguro de eliminar esta intervención programada?')) {
                  onDelete(parada!.id);
                }
              }}
              className="text-red-600 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 px-3.5 py-2 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar esta intervención</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={handleBackClick}
              className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancelar / Descartar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-lg bg-brand-blue text-white text-xs font-black hover:brightness-110 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Guardar cambios</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
