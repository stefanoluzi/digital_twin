import { 
  Task, 
  ParadaEvent, 
  Specialty, 
  Company, 
  SpecialtyRequirement 
} from '../types';
import { 
  DEFAULT_DAILY_WORK_HOURS, 
  HH_INCLUDED_SPECIALTIES, 
  SPECIALTY_LABELS, 
  SPECIALTY_COLORS, 
  COMPANY_COLORS, 
  getParadaDays, 
  getTaskRequirementsForDay 
} from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DailyThirdPartyStat {
  dayIndex: number;
  dateStr: string;
  dayLabel: string;
  formattedDate: string;
  peopleBySpecialty: Record<Specialty, number>;
  hhBySpecialty: Record<Specialty, number>;
  totalPeople: number;
  totalHH: number;
  shiftsDetail: Array<{
    taskId: string;
    taskTitle: string;
    zone: string;
    specialty: Specialty;
    count: number;
    hours: number;
    hh: number;
    companySummary: string;
  }>;
  shiftHoursSummary: Record<number, number>; // hours -> people count (e.g. { 9: 18, 12: 4 })
  companiesHH: Record<string, number>;
}

export interface SpecialtyThirdPartyStat {
  specialty: Specialty;
  label: string;
  totalPeopleDays: number;
  totalHH: number;
  percentage: number;
  color: string;
}

export interface CompanyThirdPartyStat {
  company: string; // Company | 'Pendiente'
  label: string;
  isPending: boolean;
  hhBySpecialty: Record<Specialty, number>;
  totalHH: number;
  percentage: number;
  color: string;
}

export interface TaskThirdPartyStat {
  task: Task;
  totalHH: number;
  totalPeopleDays: number;
  hhBySpecialty: Record<Specialty, number>;
  shiftsDescription: string;
  companiesSummary: string;
  zone: string;
  percentageOfTotal: number;
}

export interface InterventionThirdPartyStats {
  totalHH: number;
  avgHhPerDay: number;
  totalPeopleDays: number;
  peakPeopleDay: {
    dayIndex: number;
    dateStr: string;
    dayLabel: string;
    count: number;
  } | null;
  peakHHDay: {
    dayIndex: number;
    dateStr: string;
    dayLabel: string;
    hh: number;
  } | null;
  assignedCompanyHH: number;
  pendingCompanyHH: number;
  assignedPercentage: number;
  pendingPercentage: number;
  thirdPartyTasksCount: number;
  pendingCompanyTasksCount: number;
  dailyStats: DailyThirdPartyStat[];
  specialtyStats: SpecialtyThirdPartyStat[];
  companyStats: CompanyThirdPartyStat[];
  taskStats: TaskThirdPartyStat[];
  shiftDistribution: {
    hours9HH: number;
    hours12HH: number;
    otherHoursHH: number;
    hours9Percent: number;
    hours12Percent: number;
  };
}

/**
 * Obtiene la jornada laboral (horas) para una tarea en un día específico (dayOffset).
 * Si no está definida para ese día, usa la jornada general de la tarea.
 * Si tampoco está definida, usa DEFAULT_DAILY_WORK_HOURS (9h).
 */
export function getTaskDailyWorkHours(task: Task, dayOffset: number): number {
  if (!task) return DEFAULT_DAILY_WORK_HOURS;
  if (task.dailyWorkHours && typeof task.dailyWorkHours[dayOffset] === 'number' && task.dailyWorkHours[dayOffset] > 0) {
    return task.dailyWorkHours[dayOffset];
  }
  if (typeof task.workHours === 'number' && task.workHours > 0) {
    return task.workHours;
  }
  return DEFAULT_DAILY_WORK_HOURS;
}

/**
 * Determina si una tarea cuenta para el resumen de terceros.
 * Incluye tareas ejecutadas por TERCEROS o aquellas con contratistas asignados explícitamente.
 */
export function isTaskThirdParty(task: Task): boolean {
  if (!task) return false;
  if (task.executedBy === 'TERCEROS') return true;
  
  // Si es GMB/GUARDIA pero tiene contratistas externos asignados en alguna especialidad
  const hasAllocations = (task.requirements || []).some(r => 
    r.companyAllocations && r.companyAllocations.some(a => a.count > 0)
  );
  return hasAllocations;
}

/**
 * Obtiene el total de HH consumidas por una tarea sumando exclusivamente
 * las especialidades incluidas (MEH, LUB, COB, TUB).
 */
export function getTaskTotalHH(task: Task, maxDayCount: number = 30): number {
  if (!task || !isTaskThirdParty(task)) return 0;

  let totalHH = 0;
  const daysToInspect = new Set<number>();

  if (task.dailyRequirements) {
    Object.keys(task.dailyRequirements).forEach(k => daysToInspect.add(Number(k)));
  } else {
    for (let d = 0; d < task.durationDays; d++) {
      daysToInspect.add(task.startDayOffset + d);
    }
  }

  daysToInspect.forEach(dayOffset => {
    if (dayOffset < 0 || dayOffset >= maxDayCount) return;
    const reqs = getTaskRequirementsForDay(task, dayOffset);
    const hours = getTaskDailyWorkHours(task, dayOffset);

    reqs.forEach(req => {
      if (HH_INCLUDED_SPECIALTIES.includes(req.specialty)) {
        let count = req.count;
        if (task.executedBy !== 'TERCEROS') {
          // Only count third-party allocations for internal tasks
          count = (req.companyAllocations || []).reduce((acc, a) => acc + (a.count || 0), 0);
        }
        totalHH += count * hours;
      }
    });
  });

  return totalHH;
}

/**
 * Obtiene el desglose de HH por especialidad para una tarea.
 */
export function getTaskHHBySpecialty(task: Task, maxDayCount: number = 30): Record<Specialty, number> {
  const result: Record<Specialty, number> = {
    MEH: 0,
    LUB: 0,
    COB: 0,
    TUB: 0,
    AND: 0,
    TOP: 0,
    CIV: 0
  };

  if (!task || !isTaskThirdParty(task)) return result;

  const daysToInspect = new Set<number>();
  if (task.dailyRequirements) {
    Object.keys(task.dailyRequirements).forEach(k => daysToInspect.add(Number(k)));
  } else {
    for (let d = 0; d < task.durationDays; d++) {
      daysToInspect.add(task.startDayOffset + d);
    }
  }

  daysToInspect.forEach(dayOffset => {
    if (dayOffset < 0 || dayOffset >= maxDayCount) return;
    const reqs = getTaskRequirementsForDay(task, dayOffset);
    const hours = getTaskDailyWorkHours(task, dayOffset);

    reqs.forEach(req => {
      if (HH_INCLUDED_SPECIALTIES.includes(req.specialty)) {
        let count = req.count;
        if (task.executedBy !== 'TERCEROS') {
          count = (req.companyAllocations || []).reduce((acc, a) => acc + (a.count || 0), 0);
        }
        result[req.specialty] = (result[req.specialty] || 0) + count * hours;
      }
    });
  });

  return result;
}

/**
 * Obtiene el desglose de HH por empresa (incluyendo Pendiente) para una tarea.
 */
export function getTaskHHByCompany(task: Task, maxDayCount: number = 30): Record<string, number> {
  const result: Record<string, number> = {};

  if (!task || !isTaskThirdParty(task)) return result;

  const daysToInspect = new Set<number>();
  if (task.dailyRequirements) {
    Object.keys(task.dailyRequirements).forEach(k => daysToInspect.add(Number(k)));
  } else {
    for (let d = 0; d < task.durationDays; d++) {
      daysToInspect.add(task.startDayOffset + d);
    }
  }

  daysToInspect.forEach(dayOffset => {
    if (dayOffset < 0 || dayOffset >= maxDayCount) return;
    const reqs = getTaskRequirementsForDay(task, dayOffset);
    const hours = getTaskDailyWorkHours(task, dayOffset);

    reqs.forEach(req => {
      if (HH_INCLUDED_SPECIALTIES.includes(req.specialty)) {
        let assignedCount = 0;

        if (req.companyAllocations) {
          req.companyAllocations.forEach(alloc => {
            if (alloc.count > 0) {
              assignedCount += alloc.count;
              result[alloc.company] = (result[alloc.company] || 0) + alloc.count * hours;
            }
          });
        }

        if (task.executedBy === 'TERCEROS') {
          const pendingCount = Math.max(0, req.count - assignedCount);
          if (pendingCount > 0) {
            result['Pendiente'] = (result['Pendiente'] || 0) + pendingCount * hours;
          }
        }
      }
    });
  });

  return result;
}

/**
 * Construye todas las estadísticas de tercerización y HH para la intervención seleccionada.
 */
export function buildInterventionThirdPartyStats(
  intervention: ParadaEvent | null,
  allTasks: Task[]
): InterventionThirdPartyStats {
  const emptyResult: InterventionThirdPartyStats = {
    totalHH: 0,
    avgHhPerDay: 0,
    totalPeopleDays: 0,
    peakPeopleDay: null,
    peakHHDay: null,
    assignedCompanyHH: 0,
    pendingCompanyHH: 0,
    assignedPercentage: 100,
    pendingPercentage: 0,
    thirdPartyTasksCount: 0,
    pendingCompanyTasksCount: 0,
    dailyStats: [],
    specialtyStats: [],
    companyStats: [],
    taskStats: [],
    shiftDistribution: {
      hours9HH: 0,
      hours12HH: 0,
      otherHoursHH: 0,
      hours9Percent: 100,
      hours12Percent: 0
    }
  };

  if (!intervention) return emptyResult;

  const { days } = getParadaDays(intervention);
  const interventionTasks = allTasks.filter(t => t.paradaId ? t.paradaId === intervention.id : true);
  const thirdPartyTasks = interventionTasks.filter(isTaskThirdParty);

  let totalInterventionHH = 0;
  let totalAssignedHH = 0;
  let totalPendingHH = 0;
  let totalPeopleDays = 0;

  const globalSpecialtyHH: Record<Specialty, number> = {
    MEH: 0,
    LUB: 0,
    COB: 0,
    TUB: 0,
    AND: 0,
    TOP: 0,
    CIV: 0
  };

  const globalSpecialtyPeopleDays: Record<Specialty, number> = {
    MEH: 0,
    LUB: 0,
    COB: 0,
    TUB: 0,
    AND: 0,
    TOP: 0,
    CIV: 0
  };

  const globalCompanyHH: Record<string, { totalHH: number; bySpec: Record<Specialty, number> }> = {};

  let hours9HH = 0;
  let hours12HH = 0;
  let otherHoursHH = 0;

  // Compute Daily Stats
  const dailyStats: DailyThirdPartyStat[] = days.map((day, dayIndex) => {
    const peopleBySpecialty: Record<Specialty, number> = {
      MEH: 0,
      LUB: 0,
      COB: 0,
      TUB: 0,
      AND: 0,
      TOP: 0,
      CIV: 0
    };

    const hhBySpecialty: Record<Specialty, number> = {
      MEH: 0,
      LUB: 0,
      COB: 0,
      TUB: 0,
      AND: 0,
      TOP: 0,
      CIV: 0
    };

    const shiftsDetail: DailyThirdPartyStat['shiftsDetail'] = [];
    const shiftHoursSummary: Record<number, number> = {};
    const companiesHH: Record<string, number> = {};

    thirdPartyTasks.forEach(task => {
      const reqs = getTaskRequirementsForDay(task, dayIndex);
      const hours = getTaskDailyWorkHours(task, dayIndex);

      reqs.forEach(req => {
        if (HH_INCLUDED_SPECIALTIES.includes(req.specialty)) {
          let count = req.count;
          let assignedCount = 0;

          if (req.companyAllocations && req.companyAllocations.length > 0) {
            req.companyAllocations.forEach(alloc => {
              if (alloc.count > 0) {
                assignedCount += alloc.count;
                const allocHH = alloc.count * hours;
                companiesHH[alloc.company] = (companiesHH[alloc.company] || 0) + allocHH;
                totalAssignedHH += allocHH;

                if (!globalCompanyHH[alloc.company]) {
                  globalCompanyHH[alloc.company] = {
                    totalHH: 0,
                    bySpec: { MEH: 0, LUB: 0, COB: 0, TUB: 0, AND: 0, TOP: 0, CIV: 0 }
                  };
                }
                globalCompanyHH[alloc.company].totalHH += allocHH;
                globalCompanyHH[alloc.company].bySpec[req.specialty] += allocHH;
              }
            });
          }

          if (task.executedBy === 'TERCEROS') {
            const pendingCount = Math.max(0, count - assignedCount);
            if (pendingCount > 0) {
              const pendingHH = pendingCount * hours;
              companiesHH['Pendiente'] = (companiesHH['Pendiente'] || 0) + pendingHH;
              totalPendingHH += pendingHH;

              if (!globalCompanyHH['Pendiente']) {
                globalCompanyHH['Pendiente'] = {
                  totalHH: 0,
                  bySpec: { MEH: 0, LUB: 0, COB: 0, TUB: 0, AND: 0, TOP: 0, CIV: 0 }
                };
              }
              globalCompanyHH['Pendiente'].totalHH += pendingHH;
              globalCompanyHH['Pendiente'].bySpec[req.specialty] += pendingHH;
            }
          } else {
            // Task is internal with specific third party allocation
            count = assignedCount;
          }

          if (count > 0) {
            const reqHH = count * hours;
            peopleBySpecialty[req.specialty] += count;
            hhBySpecialty[req.specialty] += reqHH;

            globalSpecialtyHH[req.specialty] += reqHH;
            globalSpecialtyPeopleDays[req.specialty] += count;

            shiftHoursSummary[hours] = (shiftHoursSummary[hours] || 0) + count;

            if (hours === 9) hours9HH += reqHH;
            else if (hours === 12) hours12HH += reqHH;
            else otherHoursHH += reqHH;

            let compLabel = 'Pendiente';
            if (req.companyAllocations && req.companyAllocations.length > 0) {
              const allocs = req.companyAllocations.filter(a => a.count > 0);
              if (allocs.length > 0) {
                compLabel = allocs.map(a => `${a.company} (${a.count})`).join(', ');
                const pend = count - assignedCount;
                if (pend > 0) compLabel += ` + Pendiente (${pend})`;
              }
            }

            shiftsDetail.push({
              taskId: task.id,
              taskTitle: task.title,
              zone: task.zone,
              specialty: req.specialty,
              count,
              hours,
              hh: reqHH,
              companySummary: compLabel
            });
          }
        }
      });
    });

    const dayTotalPeople = HH_INCLUDED_SPECIALTIES.reduce((acc, spec) => acc + peopleBySpecialty[spec], 0);
    const dayTotalHH = HH_INCLUDED_SPECIALTIES.reduce((acc, spec) => acc + hhBySpecialty[spec], 0);

    totalInterventionHH += dayTotalHH;
    totalPeopleDays += dayTotalPeople;

    let formattedDate = day.dateStr;
    try {
      formattedDate = format(day.date, 'EEEE d/MM', { locale: es });
    } catch {
      // fallback
    }

    return {
      dayIndex,
      dateStr: day.dateStr,
      dayLabel: day.label,
      formattedDate,
      peopleBySpecialty,
      hhBySpecialty,
      totalPeople: dayTotalPeople,
      totalHH: dayTotalHH,
      shiftsDetail,
      shiftHoursSummary,
      companiesHH
    };
  });

  // Peaks Calculation
  let peakPeopleDay: InterventionThirdPartyStats['peakPeopleDay'] = null;
  let peakHHDay: InterventionThirdPartyStats['peakHHDay'] = null;

  dailyStats.forEach(d => {
    if (!peakPeopleDay || d.totalPeople > peakPeopleDay.count) {
      peakPeopleDay = {
        dayIndex: d.dayIndex,
        dateStr: d.dateStr,
        dayLabel: d.dayLabel,
        count: d.totalPeople
      };
    }

    if (!peakHHDay || d.totalHH > peakHHDay.hh) {
      peakHHDay = {
        dayIndex: d.dayIndex,
        dateStr: d.dateStr,
        dayLabel: d.dayLabel,
        hh: d.totalHH
      };
    }
  });

  // Specialty Stats
  const specialtyStats: SpecialtyThirdPartyStat[] = HH_INCLUDED_SPECIALTIES.map(spec => {
    const hh = globalSpecialtyHH[spec] || 0;
    const pct = totalInterventionHH > 0 ? Math.round((hh / totalInterventionHH) * 100) : 0;
    return {
      specialty: spec,
      label: SPECIALTY_LABELS[spec] || spec,
      totalPeopleDays: globalSpecialtyPeopleDays[spec] || 0,
      totalHH: hh,
      percentage: pct,
      color: SPECIALTY_COLORS[spec] || '#2563eb'
    };
  }).sort((a, b) => b.totalHH - a.totalHH);

  // Company Stats
  const companyStats: CompanyThirdPartyStat[] = Object.entries(globalCompanyHH)
    .filter(([_, data]) => data.totalHH > 0)
    .map(([company, data]) => {
      const isPending = company === 'Pendiente' || company === 'SIN_EMPRESA';
      const pct = totalInterventionHH > 0 ? Math.round((data.totalHH / totalInterventionHH) * 100) : 0;
      return {
        company,
        label: isPending ? 'Empresa Pendiente' : company,
        isPending,
        hhBySpecialty: data.bySpec,
        totalHH: data.totalHH,
        percentage: pct,
        color: COMPANY_COLORS[company] || (isPending ? '#ef4444' : '#64748b')
      };
    })
    .sort((a, b) => {
      if (a.isPending) return 1;
      if (b.isPending) return -1;
      return b.totalHH - a.totalHH;
    });

  // Task Stats
  let pendingCompanyTasksCount = 0;
  const taskStats: TaskThirdPartyStat[] = thirdPartyTasks.map(task => {
    const taskHH = getTaskTotalHH(task, days.length);
    const specHH = getTaskHHBySpecialty(task, days.length);
    const compHH = getTaskHHByCompany(task, days.length);

    if (compHH['Pendiente'] && compHH['Pendiente'] > 0) {
      pendingCompanyTasksCount++;
    }

    const uniqueHours = new Set<number>();
    days.forEach((_, idx) => {
      if (getTaskRequirementsForDay(task, idx).length > 0) {
        uniqueHours.add(getTaskDailyWorkHours(task, idx));
      }
    });

    let shiftsDescription = '9 h estándar';
    if (uniqueHours.size === 1) {
      shiftsDescription = `${Array.from(uniqueHours)[0]} h`;
    } else if (uniqueHours.size > 1) {
      shiftsDescription = `Mixta (${Array.from(uniqueHours).map(h => `${h}h`).join('/')})`;
    }

    const companies = Object.keys(compHH).filter(k => compHH[k] > 0);
    const companiesSummary = companies.length > 0 ? companies.join(', ') : 'Sin definir';

    const pct = totalInterventionHH > 0 ? Number(((taskHH / totalInterventionHH) * 100).toFixed(1)) : 0;

    let totalPeopleDaysForTask = 0;
    days.forEach((_, idx) => {
      const reqs = getTaskRequirementsForDay(task, idx);
      reqs.forEach(r => {
        if (HH_INCLUDED_SPECIALTIES.includes(r.specialty)) {
          totalPeopleDaysForTask += r.count;
        }
      });
    });

    return {
      task,
      totalHH: taskHH,
      totalPeopleDays: totalPeopleDaysForTask,
      hhBySpecialty: specHH,
      shiftsDescription,
      companiesSummary,
      zone: task.zone,
      percentageOfTotal: pct
    };
  })
  .filter(t => t.totalHH > 0)
  .sort((a, b) => b.totalHH - a.totalHH);

  const avgHhPerDay = days.length > 0 ? Math.round(totalInterventionHH / days.length) : 0;
  const assignedPercentage = totalInterventionHH > 0 ? Math.round((totalAssignedHH / totalInterventionHH) * 100) : 100;
  const pendingPercentage = totalInterventionHH > 0 ? Math.max(0, 100 - assignedPercentage) : 0;

  const totalShiftHH = hours9HH + hours12HH + otherHoursHH;
  const hours9Percent = totalShiftHH > 0 ? Math.round((hours9HH / totalShiftHH) * 100) : 100;
  const hours12Percent = totalShiftHH > 0 ? Math.round((hours12HH / totalShiftHH) * 100) : 0;

  return {
    totalHH: totalInterventionHH,
    avgHhPerDay,
    totalPeopleDays,
    peakPeopleDay,
    peakHHDay,
    assignedCompanyHH: totalAssignedHH,
    pendingCompanyHH: totalPendingHH,
    assignedPercentage,
    pendingPercentage,
    thirdPartyTasksCount: thirdPartyTasks.length,
    pendingCompanyTasksCount,
    dailyStats,
    specialtyStats,
    companyStats,
    taskStats,
    shiftDistribution: {
      hours9HH,
      hours12HH,
      otherHoursHH,
      hours9Percent,
      hours12Percent
    }
  };
}
