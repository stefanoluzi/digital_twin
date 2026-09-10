import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  CalendarDays, 
  Users, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowUpRight, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Layers, 
  Sparkles,
  Info,
  Calendar,
  LayoutGrid,
  Check,
  Download,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  LabelList
} from 'recharts';
import { 
  Task, 
  ParadaEvent, 
  Specialty, 
  Company,
  ProjectInfo
} from '../types';
import { 
  HH_INCLUDED_SPECIALTIES, 
  SPECIALTY_LABELS, 
  SPECIALTY_COLORS, 
  COMPANY_COLORS, 
  getParadaDays 
} from '../constants';
import { 
  buildInterventionThirdPartyStats, 
  DailyThirdPartyStat, 
  TaskThirdPartyStat 
} from '../utils/thirdPartyAnalytics';
import { ExportPdfModal } from './ExportPdfModal';
import { format } from 'date-fns';

interface ThirdPartySummaryViewProps {
  paradas: ParadaEvent[];
  selectedParada: ParadaEvent | null;
  onSelectParada: (paradaId: string) => void;
  tasks: Task[];
  planningStartDate?: Date;
  projectInfo?: ProjectInfo;
  onNavigateToBoard?: () => void;
  onSelectTask?: (task: Task) => void;
}

export const ThirdPartySummaryView: React.FC<ThirdPartySummaryViewProps> = ({
  paradas,
  selectedParada,
  onSelectParada,
  tasks,
  planningStartDate = new Date(),
  projectInfo,
  onNavigateToBoard,
  onSelectTask
}) => {
  // Chart metric toggle: HH vs Personas
  const [chartMetric, setChartMetric] = useState<'hh' | 'people'>('hh');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Filters
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('ALL');
  const [filterCompany, setFilterCompany] = useState<string>('ALL');
  const [searchTask, setSearchTask] = useState<string>('');

  // Selected Day detail state for inspecting specific day
  const [inspectDay, setInspectDay] = useState<DailyThirdPartyStat | null>(null);

  // Compute all analytics
  const stats = useMemo(() => {
    return buildInterventionThirdPartyStats(selectedParada, tasks);
  }, [selectedParada, tasks]);

  const daysInfo = useMemo(() => {
    if (!selectedParada) return { days: [], duration: 0 };
    const { days, durationDays } = getParadaDays(selectedParada);
    return { days, duration: durationDays };
  }, [selectedParada]);

  // Filtered Daily Stats for table view
  const filteredDailyStats = useMemo(() => {
    if (filterDay === 'ALL') return stats.dailyStats;
    const dayIdx = parseInt(filterDay, 10);
    return stats.dailyStats.filter(d => d.dayIndex === dayIdx);
  }, [stats.dailyStats, filterDay]);

  // Filtered Task Stats for top tasks table
  const filteredTaskStats = useMemo(() => {
    return stats.taskStats.filter(item => {
      if (searchTask.trim()) {
        const q = searchTask.toLowerCase();
        const matchesTitle = item.task.title.toLowerCase().includes(q);
        const matchesZone = item.zone.toLowerCase().includes(q);
        const matchesResp = (item.task.responsable || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesZone && !matchesResp) return false;
      }

      if (filterSpecialty !== 'ALL') {
        const spec = filterSpecialty as Specialty;
        if (!item.hhBySpecialty[spec] || item.hhBySpecialty[spec] <= 0) return false;
      }

      if (filterCompany !== 'ALL') {
        if (filterCompany === 'Pendiente') {
          if (!item.companiesSummary.includes('Pendiente')) return false;
        } else {
          if (!item.companiesSummary.includes(filterCompany)) return false;
        }
      }

      return true;
    });
  }, [stats.taskStats, searchTask, filterSpecialty, filterCompany]);

  // Data for Recharts Bar Chart
  const barChartData = useMemo(() => {
    return stats.dailyStats.map(d => {
      if (chartMetric === 'hh') {
        return {
          name: d.dayLabel,
          date: d.dateStr.slice(5),
          fullDate: d.formattedDate,
          total: d.totalHH,
          MEH: d.hhBySpecialty.MEH || 0,
          TUB: d.hhBySpecialty.TUB || 0,
          COB: d.hhBySpecialty.COB || 0,
          LUB: d.hhBySpecialty.LUB || 0,
          shiftSummary: d.shiftHoursSummary
        };
      } else {
        return {
          name: d.dayLabel,
          date: d.dateStr.slice(5),
          fullDate: d.formattedDate,
          total: d.totalPeople,
          MEH: d.peopleBySpecialty.MEH || 0,
          TUB: d.peopleBySpecialty.TUB || 0,
          COB: d.peopleBySpecialty.COB || 0,
          LUB: d.peopleBySpecialty.LUB || 0,
          shiftSummary: d.shiftHoursSummary
        };
      }
    });
  }, [stats.dailyStats, chartMetric]);

  // Custom Tooltip for Stacked Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const metricLabel = chartMetric === 'hh' ? 'HH' : 'Personas';

      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <div>
              <span className="font-black text-white text-sm">{label}</span>
              <span className="text-[10px] text-slate-400 block capitalize">{data.fullDate}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-black block">Total</span>
              <span className="font-black text-amber-400 text-sm">
                {data.total} {metricLabel}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {HH_INCLUDED_SPECIALTIES.map(spec => {
              const val = data[spec] || 0;
              if (val === 0) return null;
              return (
                <div key={spec} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-xs" 
                      style={{ backgroundColor: SPECIALTY_COLORS[spec] }} 
                    />
                    <span className="font-bold text-slate-200">{spec}</span>
                    <span className="text-[10px] text-slate-400">({SPECIALTY_LABELS[spec]?.split('(')[0]})</span>
                  </div>
                  <span className="font-black text-white">{val} {metricLabel}</span>
                </div>
              );
            })}
          </div>

          {data.shiftSummary && Object.keys(data.shiftSummary).length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="font-bold text-slate-300 block mb-0.5">Jornadas computadas:</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.shiftSummary as Record<string, number>).map(([hrs, count]) => (
                  <span key={hrs} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                    {count} pers × {hrs}h
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto text-gray-900 pr-1">
      {/* 1. TOP INTERVENTION BAR */}
      <div className="bg-white rounded-xl border border-border-gray px-4 py-2.5 flex flex-wrap items-center justify-between shadow-xs gap-3 shrink-0">
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Intervención Activa:
            </span>
            <select
              value={selectedParada?.id || ''}
              onChange={e => onSelectParada(e.target.value)}
              className="bg-orange-50 border border-brand-orange/40 text-brand-blue font-black text-xs rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-brand-orange/20 cursor-pointer"
            >
              {paradas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.startDate || 'S/F'} → {p.endDate || 'S/F'})
                </option>
              ))}
              {paradas.length === 0 && <option value="">Sin intervenciones creadas</option>}
            </select>
          </div>

          {selectedParada && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-lg">
              <CalendarDays className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span>
                {selectedParada.startDate || 'S/F'} → {selectedParada.endDate || 'S/F'} · {daysInfo.duration} días
              </span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
            <Info className="w-3 h-3 text-slate-400" />
            <span>Cálculo exclusivo: <strong>MEH, TUB, COB, LUB</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedParada && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="text-xs font-bold text-gray-700 hover:text-brand-orange bg-white hover:bg-orange-50/70 border border-gray-300 hover:border-brand-orange/40 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Descargar informe ejecutivo en PDF del Resumen de Terceros"
            >
              <Download className="w-3.5 h-3.5 text-brand-orange" />
              <span>Exportar PDF Resumen</span>
            </button>
          )}

          {onNavigateToBoard && (
            <button
              type="button"
              onClick={onNavigateToBoard}
              className="text-xs font-bold text-brand-blue hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Ir a Planificación de Tareas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        {/* KPI 1: Total Horas-Hombre */}
        <div className="bg-white rounded-xl border border-border-gray p-3.5 shadow-xs flex flex-col justify-between hover:border-brand-blue/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Total HH</span>
              <Clock className="w-3.5 h-3.5 text-brand-blue" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.totalHH.toLocaleString()} <span className="text-xs font-bold text-slate-500">HH</span>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] text-gray-500 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
            Demanda total estimada
          </div>
        </div>

        {/* KPI 2: Promedio HH / Día */}
        <div className="bg-white rounded-xl border border-border-gray p-3.5 shadow-xs flex flex-col justify-between hover:border-brand-blue/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Promedio HH / Día</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.avgHhPerDay.toLocaleString()} <span className="text-xs font-bold text-slate-500">HH/d</span>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] text-gray-500 font-semibold">
            {stats.totalPeopleDays} personas-día totales
          </div>
        </div>

        {/* KPI 3: Pico de Dotación */}
        <div className="bg-white rounded-xl border border-border-gray p-3.5 shadow-xs flex flex-col justify-between hover:border-brand-blue/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Pico de Dotación</span>
              <Users className="w-3.5 h-3.5 text-brand-orange" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.peakPeopleDay ? stats.peakPeopleDay.count : 0} <span className="text-xs font-bold text-slate-500">pers.</span>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] text-brand-orange font-black truncate">
            {stats.peakPeopleDay ? `${stats.peakPeopleDay.dayLabel} (${stats.peakPeopleDay.dateStr.slice(5)})` : '—'}
          </div>
        </div>

        {/* KPI 4: Pico de HH */}
        <div className="bg-white rounded-xl border border-border-gray p-3.5 shadow-xs flex flex-col justify-between hover:border-brand-blue/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Pico de HH</span>
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.peakHHDay ? stats.peakHHDay.hh.toLocaleString() : 0} <span className="text-xs font-bold text-slate-500">HH</span>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] text-purple-700 font-black truncate">
            {stats.peakHHDay ? `${stats.peakHHDay.dayLabel} (${stats.peakHHDay.dateStr.slice(5)})` : '—'}
          </div>
        </div>

        {/* KPI 5: Definición Empresarial */}
        <div className="bg-white rounded-xl border border-border-gray p-3.5 shadow-xs flex flex-col justify-between hover:border-brand-blue/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Empresa Asignada</span>
              {stats.pendingPercentage === 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.assignedPercentage}% <span className="text-xs font-bold text-emerald-600">cerrada</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${stats.assignedPercentage}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${stats.pendingPercentage}%` }} />
            </div>
            <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-1">
              <span>{stats.assignedCompanyHH} HH asign.</span>
              <span className="text-red-500">{stats.pendingCompanyHH} HH pend.</span>
            </div>
          </div>
        </div>

        {/* KPI 6: Tareas con Terceros */}
        <div className="bg-white rounded-xl border border-border-gray p-3.5 shadow-xs flex flex-col justify-between hover:border-brand-blue/30 transition-colors">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Tareas Tercerizadas</span>
              <Building2 className="w-3.5 h-3.5 text-slate-700" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {stats.thirdPartyTasksCount} <span className="text-xs font-bold text-slate-500">tareas</span>
            </div>
          </div>
          <div className="mt-2 text-[10.5px] text-gray-500 font-semibold flex items-center justify-between">
            <span>{stats.companyStats.filter(c => !c.isPending).length} empresas</span>
            {stats.pendingCompanyTasksCount > 0 && (
              <span className="text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-black text-[9px]">
                {stats.pendingCompanyTasksCount} pend.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. CHARTS GRID (Bars by day + Donuts by Specialty & Company) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Chart 1: Bar Chart per Day (HH or People) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border-gray p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-brand-orange" />
                Demanda Diaria por Especialidad ({chartMetric === 'hh' ? 'Horas-Hombre' : 'Personas'})
              </h3>
              <p className="text-[10.5px] text-gray-400">
                Distribución acumulada diaria en MEH, TUB, COB y LUB
              </p>
            </div>

            {/* Toggle HH / Personas */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMetric('hh')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  chartMetric === 'hh'
                    ? 'bg-brand-blue text-white shadow-2xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Horas-Hombre (HH)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('people')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  chartMetric === 'people'
                    ? 'bg-brand-blue text-white shadow-2xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dotación (Personas)
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 22, right: 15, left: -15, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingBottom: '8px' }}
                />
                <Bar dataKey="MEH" name="MEH (Mecánicos)" stackId="a" fill={SPECIALTY_COLORS.MEH} radius={[0, 0, 0, 0]}>
                  <LabelList 
                    dataKey="MEH" 
                    position="center" 
                    fill="#ffffff" 
                    fontSize={10} 
                    fontWeight={800} 
                    formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')} 
                  />
                </Bar>
                <Bar dataKey="TUB" name="TUB (Tubistas)" stackId="a" fill={SPECIALTY_COLORS.TUB} radius={[0, 0, 0, 0]}>
                  <LabelList 
                    dataKey="TUB" 
                    position="center" 
                    fill="#ffffff" 
                    fontSize={10} 
                    fontWeight={800} 
                    formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')} 
                  />
                </Bar>
                <Bar dataKey="COB" name="COB (Cobristas)" stackId="a" fill={SPECIALTY_COLORS.COB} radius={[0, 0, 0, 0]}>
                  <LabelList 
                    dataKey="COB" 
                    position="center" 
                    fill="#ffffff" 
                    fontSize={10} 
                    fontWeight={800} 
                    formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')} 
                  />
                </Bar>
                <Bar dataKey="LUB" name="LUB (Lubricadores)" stackId="a" fill={SPECIALTY_COLORS.LUB} radius={[4, 4, 0, 0]}>
                  <LabelList 
                    dataKey="LUB" 
                    position="center" 
                    fill="#ffffff" 
                    fontSize={10} 
                    fontWeight={800} 
                    formatter={(val: any) => (Number(val) > 0 ? `${val}` : '')} 
                  />
                  <LabelList 
                    dataKey="total" 
                    position="top" 
                    fill="#0f172a" 
                    fontSize={11} 
                    fontWeight={900} 
                    offset={6}
                    formatter={(val: any) => (Number(val) > 0 ? (chartMetric === 'hh' ? `${val} HH` : `${val} p`) : '')} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2 & 3: Donut Charts (Specialty & Company) in right column */}
        <div className="bg-white rounded-xl border border-border-gray p-4 shadow-xs flex flex-col justify-between gap-4">
          {/* Donut 1: Especialidad */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <PieChartIcon className="w-3.5 h-3.5 text-brand-blue" />
                HH por Especialidad
              </h3>
              <span className="text-[10px] font-black text-brand-blue bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {stats.totalHH} HH
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.specialtyStats.filter(s => s.totalHH > 0)}
                      dataKey="totalHH"
                      nameKey="specialty"
                      cx="50%"
                      cy="50%"
                      innerRadius={26}
                      outerRadius={45}
                      paddingAngle={3}
                    >
                      {stats.specialtyStats.map(entry => (
                        <Cell key={entry.specialty} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-1 text-xs">
                {stats.specialtyStats.map(s => (
                  <div key={s.specialty} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-bold text-gray-800">{s.specialty}</span>
                    </div>
                    <div className="font-black text-gray-900">
                      {s.totalHH} HH <span className="text-gray-400 font-semibold">({s.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-gray-100" />

          {/* Donut 2: Empresa Contratista */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                HH por Empresa
              </h3>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {stats.companyStats.length} grupos
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.companyStats}
                      dataKey="totalHH"
                      nameKey="company"
                      cx="50%"
                      cy="50%"
                      innerRadius={26}
                      outerRadius={45}
                      paddingAngle={3}
                    >
                      {stats.companyStats.map(entry => (
                        <Cell key={entry.company} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-1 text-xs max-h-32 overflow-y-auto pr-1">
                {stats.companyStats.map(c => (
                  <div key={c.company} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className={`font-bold truncate ${c.isPending ? 'text-red-700 font-black' : 'text-gray-800'}`}>
                        {c.label}
                      </span>
                    </div>
                    <div className="font-black text-gray-900 shrink-0">
                      {c.totalHH} HH <span className="text-gray-400 font-semibold">({c.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FILTER BAR */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-brand-orange" />
            Filtros:
          </span>

          {/* Day Filter */}
          <select
            value={filterDay}
            onChange={e => setFilterDay(e.target.value)}
            className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-2.5 py-1 outline-none focus:border-brand-blue cursor-pointer"
          >
            <option value="ALL">Todos los Días ({stats.dailyStats.length})</option>
            {stats.dailyStats.map(d => (
              <option key={d.dayIndex} value={d.dayIndex.toString()}>
                {d.dayLabel} ({d.formattedDate}) · {d.totalHH} HH
              </option>
            ))}
          </select>

          {/* Specialty Filter */}
          <select
            value={filterSpecialty}
            onChange={e => setFilterSpecialty(e.target.value)}
            className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-2.5 py-1 outline-none focus:border-brand-blue cursor-pointer"
          >
            <option value="ALL">Todas las Especialidades (MEH, TUB, COB, LUB)</option>
            {HH_INCLUDED_SPECIALTIES.map(spec => (
              <option key={spec} value={spec}>
                {spec} - {SPECIALTY_LABELS[spec]?.split('(')[0]}
              </option>
            ))}
          </select>

          {/* Company Filter */}
          <select
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-2.5 py-1 outline-none focus:border-brand-blue cursor-pointer"
          >
            <option value="ALL">Todas las Empresas Contratistas</option>
            {stats.companyStats.map(c => (
              <option key={c.company} value={c.company}>
                {c.label} ({c.totalHH} HH)
              </option>
            ))}
          </select>

          {(filterDay !== 'ALL' || filterSpecialty !== 'ALL' || filterCompany !== 'ALL' || searchTask) && (
            <button
              type="button"
              onClick={() => {
                setFilterDay('ALL');
                setFilterSpecialty('ALL');
                setFilterCompany('ALL');
                setSearchTask('');
              }}
              className="text-[11px] font-bold text-brand-orange hover:underline cursor-pointer ml-1"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Task Search */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchTask}
            onChange={e => setSearchTask(e.target.value)}
            placeholder="Buscar tarea o supervisor..."
            className="w-full text-xs pl-8 pr-2.5 py-1 bg-white border border-gray-300 rounded-lg focus:border-brand-blue outline-none"
          />
        </div>
      </div>

      {/* 5. TABLE 1: RESUMEN DE TERCEROS POR DÍA */}
      <div className="bg-white rounded-xl border border-border-gray shadow-xs overflow-hidden">
        <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-blue" />
              Resumen de Terceros por Día
            </h3>
            <span className="text-[10px] text-gray-500 font-semibold">
              Desglose diario de dotación y cómputo de horas-hombre
            </span>
          </div>
          <span className="text-[10.5px] font-black text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
            {filteredDailyStats.length} {filteredDailyStats.length === 1 ? 'día' : 'días'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100/70 border-b border-gray-200 text-[10.5px] font-black text-gray-600 uppercase tracking-wider">
                <th className="py-2 px-3">Día / Fecha</th>
                <th className="py-2 px-3 text-center" style={{ color: SPECIALTY_COLORS.MEH }}>MEH (Mec)</th>
                <th className="py-2 px-3 text-center" style={{ color: SPECIALTY_COLORS.TUB }}>TUB (Tub)</th>
                <th className="py-2 px-3 text-center" style={{ color: SPECIALTY_COLORS.COB }}>COB (Cob)</th>
                <th className="py-2 px-3 text-center" style={{ color: SPECIALTY_COLORS.LUB }}>LUB (Lub)</th>
                <th className="py-2 px-3 text-right text-gray-800 bg-gray-200/50">Total Personas</th>
                <th className="py-2 px-3 text-right text-brand-blue bg-blue-50/70 font-black">Horas-Hombre (HH)</th>
                <th className="py-2 px-3 text-center">Jornadas / Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDailyStats.map(d => {
                const isPeakDay = stats.peakHHDay?.dayIndex === d.dayIndex;
                const isPeakPeople = stats.peakPeopleDay?.dayIndex === d.dayIndex;

                return (
                  <tr 
                    key={d.dayIndex} 
                    className={`hover:bg-blue-50/30 transition-colors ${
                      isPeakDay ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900">{d.dayLabel}</span>
                        <span className="text-[11px] text-gray-500 capitalize">{d.formattedDate}</span>
                        {isPeakDay && (
                          <span className="text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 px-1 py-0.2 rounded">
                            Pico HH
                          </span>
                        )}
                        {isPeakPeople && (
                          <span className="text-[9px] font-black bg-orange-100 text-orange-800 border border-orange-200 px-1 py-0.2 rounded">
                            Pico Dotación
                          </span>
                        )}
                      </div>
                    </td>

                    {/* MEH */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-black text-gray-800">{d.peopleBySpecialty.MEH || 0}</span>
                      <span className="text-[10px] text-gray-400 block">{d.hhBySpecialty.MEH || 0} HH</span>
                    </td>

                    {/* TUB */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-black text-gray-800">{d.peopleBySpecialty.TUB || 0}</span>
                      <span className="text-[10px] text-gray-400 block">{d.hhBySpecialty.TUB || 0} HH</span>
                    </td>

                    {/* COB */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-black text-gray-800">{d.peopleBySpecialty.COB || 0}</span>
                      <span className="text-[10px] text-gray-400 block">{d.hhBySpecialty.COB || 0} HH</span>
                    </td>

                    {/* LUB */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-black text-gray-800">{d.peopleBySpecialty.LUB || 0}</span>
                      <span className="text-[10px] text-gray-400 block">{d.hhBySpecialty.LUB || 0} HH</span>
                    </td>

                    {/* Total Personas */}
                    <td className="py-2.5 px-3 text-right bg-gray-50 font-black text-slate-900">
                      {d.totalPeople} <span className="text-[10px] text-gray-400 font-semibold">pers.</span>
                    </td>

                    {/* Total HH */}
                    <td className="py-2.5 px-3 text-right bg-blue-50/40 font-black text-brand-blue text-sm">
                      {d.totalHH.toLocaleString()} <span className="text-[10px] font-bold">HH</span>
                    </td>

                    {/* Jornadas / Detalle */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {Object.entries(d.shiftHoursSummary).map(([hrs, count]) => (
                          <span 
                            key={hrs}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 ${
                              hrs === '12' 
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-300 font-black shadow-2xs' 
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                            title={`${count} personas con jornada ${hrs === '12' ? 'extendida de 12 horas' : 'estándar de 9 horas'}`}
                          >
                            {hrs === '12' && <Clock className="w-2.5 h-2.5 text-indigo-600" />}
                            {count} × {hrs}h
                          </span>
                        ))}
                        {Object.keys(d.shiftHoursSummary).length === 0 && (
                          <span className="text-[10px] text-gray-400 italic">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot>
              <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                <td className="py-2.5 px-3 text-xs uppercase tracking-wider">TOTAL GENERAL INTERVENCIÓN</td>
                <td className="py-2.5 px-3 text-center">
                  <div>{stats.specialtyStats.find(s => s.specialty === 'MEH')?.totalPeopleDays || 0} pers-d</div>
                  <div className="text-[10px] text-brand-blue">{stats.specialtyStats.find(s => s.specialty === 'MEH')?.totalHH || 0} HH</div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <div>{stats.specialtyStats.find(s => s.specialty === 'TUB')?.totalPeopleDays || 0} pers-d</div>
                  <div className="text-[10px] text-sky-700">{stats.specialtyStats.find(s => s.specialty === 'TUB')?.totalHH || 0} HH</div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <div>{stats.specialtyStats.find(s => s.specialty === 'COB')?.totalPeopleDays || 0} pers-d</div>
                  <div className="text-[10px] text-amber-700">{stats.specialtyStats.find(s => s.specialty === 'COB')?.totalHH || 0} HH</div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <div>{stats.specialtyStats.find(s => s.specialty === 'LUB')?.totalPeopleDays || 0} pers-d</div>
                  <div className="text-[10px] text-emerald-700">{stats.specialtyStats.find(s => s.specialty === 'LUB')?.totalHH || 0} HH</div>
                </td>
                <td className="py-2.5 px-3 text-right bg-gray-200/60 font-black text-slate-900">
                  {stats.totalPeopleDays} pers-d
                </td>
                <td className="py-2.5 px-3 text-right bg-blue-100/70 font-black text-brand-blue text-sm">
                  {stats.totalHH.toLocaleString()} HH
                </td>
                <td className="py-2.5 px-3 text-center text-[10px] text-gray-500">
                  {stats.shiftDistribution.hours9Percent}% 9h · {stats.shiftDistribution.hours12Percent}% 12h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 6. TABLE 2 & 3 (Company Distribution Table & Top Tasks Ranking) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Table 2: DISTRIBUCIÓN POR EMPRESA */}
        <div className="bg-white rounded-xl border border-border-gray shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Distribución por Empresa Contratista
              </h3>
              <span className="text-[10px] text-gray-500 font-semibold">
                Cómputo de HH tercerizadas por especialidad y empresa
              </span>
            </div>
            <span className="text-[10.5px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
              {stats.companyStats.length} registros
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-[10px] font-black text-gray-600 uppercase tracking-wider">
                  <th className="py-2 px-3">Empresa</th>
                  <th className="py-2 px-2 text-right">MEH HH</th>
                  <th className="py-2 px-2 text-right">TUB HH</th>
                  <th className="py-2 px-2 text-right">COB HH</th>
                  <th className="py-2 px-2 text-right">LUB HH</th>
                  <th className="py-2 px-3 text-right bg-blue-50 text-brand-blue font-black">Total HH</th>
                  <th className="py-2 px-2 text-right">% Parada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.companyStats.map(c => (
                  <tr 
                    key={c.company}
                    className={`hover:bg-gray-50 transition-colors ${
                      c.isPending ? 'bg-red-50/40 text-red-950 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className={`font-black ${c.isPending ? 'text-red-700' : 'text-gray-900'}`}>
                          {c.label}
                        </span>
                        {c.isPending && (
                          <span className="text-[9px] font-black bg-red-100 text-red-700 border border-red-200 px-1 py-0.2 rounded">
                            Por definir
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium">{c.hhBySpecialty.MEH || 0}</td>
                    <td className="py-2.5 px-2 text-right font-medium">{c.hhBySpecialty.TUB || 0}</td>
                    <td className="py-2.5 px-2 text-right font-medium">{c.hhBySpecialty.COB || 0}</td>
                    <td className="py-2.5 px-2 text-right font-medium">{c.hhBySpecialty.LUB || 0}</td>
                    <td className="py-2.5 px-3 text-right font-black text-brand-blue bg-blue-50/30">
                      {c.totalHH.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-gray-500">
                      {c.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                  <td className="py-2 px-3 uppercase text-[11px]">TOTAL CONTRATADO</td>
                  <td className="py-2 px-2 text-right">{stats.specialtyStats.find(s => s.specialty === 'MEH')?.totalHH || 0}</td>
                  <td className="py-2 px-2 text-right">{stats.specialtyStats.find(s => s.specialty === 'TUB')?.totalHH || 0}</td>
                  <td className="py-2 px-2 text-right">{stats.specialtyStats.find(s => s.specialty === 'COB')?.totalHH || 0}</td>
                  <td className="py-2 px-2 text-right">{stats.specialtyStats.find(s => s.specialty === 'LUB')?.totalHH || 0}</td>
                  <td className="py-2 px-3 text-right bg-blue-100 text-brand-blue">{stats.totalHH.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Table 3: TAREAS CON MAYOR CONSUMO DE HH */}
        <div className="bg-white rounded-xl border border-border-gray shadow-xs overflow-hidden flex flex-col">
          <div className="bg-gray-50/80 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                Tareas con Mayor Consumo de HH
              </h3>
              <span className="text-[10px] text-gray-500 font-semibold">
                Ranking de tareas tercerizadas por demanda de HH
              </span>
            </div>
            <span className="text-[10.5px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg">
              {filteredTaskStats.length} tareas
            </span>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-[10px] font-black text-gray-600 uppercase tracking-wider sticky top-0 bg-gray-100 z-10">
                  <th className="py-2 px-2 text-center w-8">#</th>
                  <th className="py-2 px-3">Tarea / Zona</th>
                  <th className="py-2 px-2">Especialidades</th>
                  <th className="py-2 px-2 text-center">Jornada</th>
                  <th className="py-2 px-3 text-right text-brand-blue font-black">Total HH</th>
                  <th className="py-2 px-2 text-right">% Parada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTaskStats.map((item, idx) => (
                  <tr 
                    key={item.task.id}
                    onClick={() => onSelectTask && onSelectTask(item.task)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-2 px-2 text-center font-black text-gray-400 group-hover:text-brand-blue">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 max-w-[220px]">
                      <div className="font-bold text-gray-900 line-clamp-1 group-hover:text-brand-blue transition-colors flex items-center gap-1.5">
                        <span>{item.task.title}</span>
                        {(item.shiftsDescription.includes('12') || item.task.workHours === 12) && (
                          <span className="text-[8.5px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0 inline-flex items-center gap-0.5 shadow-2xs" title="Tarea con jornada extendida de 12 horas">
                            <Clock className="w-2.5 h-2.5 text-indigo-600" />
                            12hs
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-bold bg-gray-100 px-1 rounded text-gray-700">{item.zone}</span>
                        <span>· {item.task.responsable || 'Sin supervisor'}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {HH_INCLUDED_SPECIALTIES.map(spec => {
                          const val = item.hhBySpecialty[spec] || 0;
                          if (val === 0) return null;
                          return (
                            <span 
                              key={spec}
                              className="text-[9.5px] font-black px-1.5 py-0.2 rounded border"
                              style={{ 
                                color: SPECIALTY_COLORS[spec], 
                                borderColor: `${SPECIALTY_COLORS[spec]}40`,
                                backgroundColor: `${SPECIALTY_COLORS[spec]}10`
                              }}
                              title={`${val} HH de ${spec}`}
                            >
                              {spec} {val}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {(item.shiftsDescription.includes('12') || item.task.workHours === 12) ? (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-indigo-800 bg-indigo-50 border border-indigo-300 px-1.5 py-0.5 rounded shadow-2xs">
                          <Clock className="w-2.5 h-2.5 text-indigo-600" />
                          {item.shiftsDescription}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.shiftsDescription}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-brand-blue text-sm">
                      {item.totalHH.toLocaleString()} <span className="text-[10px] font-bold">HH</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="font-bold text-gray-700">{item.percentageOfTotal}%</div>
                      <div className="w-12 bg-gray-200 rounded-full h-1 ml-auto mt-1 overflow-hidden">
                        <div 
                          className="bg-brand-blue h-full" 
                          style={{ width: `${Math.min(100, item.percentageOfTotal * 3)}%` }} 
                        />
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredTaskStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                      No se encontraron tareas con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PDF Export Modal */}
      {selectedParada && (
        <ExportPdfModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          parada={selectedParada}
          allTasks={tasks}
          filteredTasks={tasks}
          planningStartDate={format(planningStartDate, 'yyyy-MM-dd')}
          projectInfo={projectInfo}
          initialDocType="terceros"
        />
      )}
    </div>
  );
};
