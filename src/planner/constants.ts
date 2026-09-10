import { 
  Zone, 
  Specialty, 
  Company, 
  ExternalSpecialty, 
  DailyExternalResourceAvailability, 
  DailySpecialtyAvailability,
  Impact, 
  ExecutedBy, 
  Task, 
  DayAvailability, 
  ParadaEvent, 
  ProjectInfo,
  CompanyAllocation,
  SpecialtyRequirement 
} from './types';

export const ZONES: Zone[] = ['COBA', 'HG', 'LP', 'LCO', 'ZTREF', 'REMA', 'LRE', 'PENF', 'SHAC', 'GENERAL'];

export const SPECIALTIES_LIST: Specialty[] = ['MEH', 'AND', 'TOP', 'CIV', 'TUB', 'COB', 'LUB'];

export const DEFAULT_DAILY_WORK_HOURS = 9;

export const HH_INCLUDED_SPECIALTIES: Specialty[] = [
  'MEH',
  'LUB',
  'COB',
  'TUB'
];

export const SPECIALTY_COLORS: Record<Specialty, string> = {
  MEH: '#2563eb', // Indigo/Blue
  TUB: '#0284c7', // Sky Blue
  COB: '#d97706', // Amber
  LUB: '#059669', // Emerald
  AND: '#8b5cf6', // Purple
  TOP: '#64748b', // Slate
  CIV: '#78716c'  // Stone
};

export const COMPANY_COLORS: Record<string, string> = {
  BFB: '#2563eb',
  LOBERAZ: '#d97706',
  COMIBOR: '#7c3aed',
  EMET: '#059669',
  TECHINT: '#0891b2',
  ANDEMET: '#ea580c',
  Pendiente: '#ef4444',
  'Empresa pendiente': '#ef4444',
  'SIN_EMPRESA': '#ef4444'
};

export const EXTERNAL_SPECIALTIES: Specialty[] = ['AND', 'TOP'];

export const EXTERNAL_SPECIALTIES_LIST: ExternalSpecialty[] = ['MEH', 'TUB', 'COB', 'LUB', 'CIV', 'TOP', 'AND'];

export const EXTERNAL_SPECIALTY_LABELS: Record<ExternalSpecialty, string> = {
  MEH: 'Mecánicos (MEH)',
  TUB: 'Tubistas (TUB)',
  COB: 'Cobristas (COB)',
  LUB: 'Lubricadores (LUB)',
  CIV: 'Civiles (CIV)',
  TOP: 'Topografía (TOP)',
  AND: 'Andamios (AND)'
};

export const SPECIALTY_COMPANIES: Record<ExternalSpecialty, Company[]> = {
  MEH: ['BFB', 'LOBERAZ', 'EMET', 'COMIBOR'],
  TUB: ['BFB'],
  COB: ['BFB'],
  LUB: ['BFB'],
  CIV: ['TECHINT'],
  TOP: ['TECHINT'],
  AND: ['ANDEMET']
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  MEH: 'Mecánico (MEH)',
  AND: 'Andamios (AND - Externo)',
  TOP: 'Topografía (TOP - Externo)',
  CIV: 'Civil (CIV)',
  TUB: 'Tubista (TUB)',
  COB: 'Cobrista (COB)',
  LUB: 'Lubricación (LUB)'
};

export const IMPACTS_LIST: Impact[] = ['INO', 'CALIDAD', 'HSE', 'EFICIENCIA'];

export const EXEC_TYPES: ExecutedBy[] = ['GMB', 'GUARDIA', 'TERCEROS'];

export const DEFAULT_PROJECT: ProjectInfo = {
  id: 'default-proj-1',
  name: 'Planificación Semanal de Mantenimiento',
  line: 'Línea de Producción General',
  startDate: new Date().toISOString(),
  createdAt: new Date().toISOString()
};

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    paradaId: 'parada-1',
    startDate: '2026-08-17',
    title: 'Cambio de rodillos en mesa de entrada',
    justification: 'Desgaste por fricción detectado en la última inspección de vibraciones.',
    zone: 'COBA',
    executedBy: 'GMB',
    responsable: 'Juan Pérez',
    impacts: ['INO', 'EFICIENCIA'],
    criticality: 'Alta',
    startDayOffset: 0,
    durationDays: 2,
    requirements: [
      { 
        specialty: 'MEH', 
        count: 4,
        companyAllocations: [
          { company: 'BFB', count: 4 }
        ]
      },
      { 
        specialty: 'LUB', 
        count: 1,
        companyAllocations: [
          { company: 'BFB', count: 1 }
        ]
      }
    ]
  },
  {
    id: 'task-2',
    paradaId: 'parada-1',
    startDate: '2026-08-18',
    title: 'Inspección e instalación de andamios en horno',
    justification: 'Requisito mandatorio de seguridad y acceso para inspección refractaria.',
    zone: 'HG',
    executedBy: 'TERCEROS',
    responsable: 'Carlos Gómez',
    impacts: ['HSE'],
    criticality: 'Media',
    startDayOffset: 1,
    durationDays: 1,
    requirements: [
      { specialty: 'AND', count: 1, companyAllocations: [{ company: 'ANDEMET', count: 1 }] },
      { 
        specialty: 'MEH', 
        count: 6,
        companyAllocations: [
          { company: 'BFB', count: 4 },
          { company: 'LOBERAZ', count: 2 }
        ]
      }
    ]
  },
  {
    id: 'task-3',
    paradaId: 'parada-1',
    startDate: '2026-08-19',
    title: 'Alineación topográfica de guías de laminación',
    justification: 'Corrección de deriva dimensional reportada por control de calidad.',
    zone: 'LP',
    executedBy: 'TERCEROS',
    responsable: 'Martín Suárez',
    impacts: ['CALIDAD'],
    criticality: 'Alta',
    startDayOffset: 2,
    durationDays: 1,
    requirements: [
      { specialty: 'TOP', count: 1, companyAllocations: [{ company: 'TECHINT', count: 1 }] },
      { 
        specialty: 'MEH', 
        count: 4,
        companyAllocations: [] // Empresa pendiente
      }
    ]
  },
  {
    id: 'task-4',
    paradaId: 'parada-1',
    startDate: '2026-08-20',
    title: 'Reparación de tuberías de refrigeración en enfriador',
    justification: 'Micro-fuga en circuito cerrado de agua desmineralizada.',
    zone: 'PENF',
    executedBy: 'GUARDIA',
    responsable: 'Roberto Díaz',
    impacts: ['EFICIENCIA', 'HSE'],
    criticality: 'Media',
    startDayOffset: 3,
    durationDays: 2,
    requirements: [
      { 
        specialty: 'TUB', 
        count: 2,
        companyAllocations: [
          { company: 'BFB', count: 2 }
        ]
      },
      { 
        specialty: 'COB', 
        count: 1,
        companyAllocations: [
          { company: 'BFB', count: 1 }
        ]
      }
    ]
  }
];

export const INITIAL_PARADAS: ParadaEvent[] = [
  { 
    id: 'parada-1', 
    title: 'REX Agosto 2026', 
    startDate: '2026-08-17',
    endDate: '2026-08-23',
    startDayOffset: 0, 
    durationDays: 7,
    specialtyAvailability: [
      { date: '2026-08-17', specialty: 'MEH', count: 18 },
      { date: '2026-08-18', specialty: 'MEH', count: 18 },
      { date: '2026-08-19', specialty: 'MEH', count: 16 },
      { date: '2026-08-20', specialty: 'MEH', count: 12 },
      { date: '2026-08-21', specialty: 'MEH', count: 10 },
      { date: '2026-08-22', specialty: 'MEH', count: 8 },
      { date: '2026-08-23', specialty: 'MEH', count: 8 },
      { date: '2026-08-17', specialty: 'TUB', count: 4 },
      { date: '2026-08-18', specialty: 'TUB', count: 5 },
      { date: '2026-08-19', specialty: 'TUB', count: 4 },
      { date: '2026-08-20', specialty: 'TUB', count: 2 }
    ],
    resourceAvailability: [
      { date: '2026-08-17', specialty: 'MEH', company: 'BFB', count: 8 },
      { date: '2026-08-17', specialty: 'MEH', company: 'LOBERAZ', count: 4 },
      { date: '2026-08-17', specialty: 'MEH', company: 'EMET', count: 6 },
      { date: '2026-08-18', specialty: 'MEH', company: 'BFB', count: 10 },
      { date: '2026-08-18', specialty: 'MEH', company: 'LOBERAZ', count: 8 },
      { date: '2026-08-17', specialty: 'TUB', company: 'BFB', count: 4 },
      { date: '2026-08-18', specialty: 'TUB', company: 'BFB', count: 5 },
      { date: '2026-08-19', specialty: 'TOP', company: 'TECHINT', count: 2 }
    ]
  },
  { 
    id: 'parada-2', 
    title: 'Parada Sierra de Fin de Semana', 
    startDate: '2026-08-28',
    endDate: '2026-08-30',
    startDayOffset: 11, 
    durationDays: 3,
    specialtyAvailability: [
      { date: '2026-08-28', specialty: 'MEH', count: 12 },
      { date: '2026-08-29', specialty: 'MEH', count: 10 },
      { date: '2026-08-30', specialty: 'MEH', count: 6 }
    ],
    resourceAvailability: [
      { date: '2026-08-28', specialty: 'MEH', company: 'BFB', count: 12 },
      { date: '2026-08-29', specialty: 'MEH', company: 'BFB', count: 10 },
      { date: '2026-08-30', specialty: 'MEH', company: 'BFB', count: 6 }
    ]
  }
];

/**
 * Helper para obtener las fechas reales de un Hito o Parada.
 * Soporta cualquier cantidad de días (desde 1 hasta N días).
 */
export function getParadaDays(parada: ParadaEvent | null | undefined, fallbackDate: Date = new Date()): {
  startDate: Date;
  endDate: Date;
  days: { date: Date; dateStr: string; dayIndex: number; label: string; fullLabel: string }[];
  durationDays: number;
} {
  if (!parada) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(fallbackDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      return {
        date: d,
        dateStr,
        dayIndex: i,
        label: `Día ${i + 1}`,
        fullLabel: `Día ${i + 1}`
      };
    });
    return {
      startDate: fallbackDate,
      endDate: days[days.length - 1].date,
      days,
      durationDays: 7
    };
  }

  let start: Date;
  if (parada.startDate) {
    start = new Date(parada.startDate.includes('T') ? parada.startDate : `${parada.startDate}T00:00:00`);
    if (isNaN(start.getTime())) {
      start = fallbackDate;
    }
  } else {
    start = new Date(fallbackDate);
    start.setDate(start.getDate() + (parada.startDayOffset || 0));
  }

  let duration = parada.durationDays || 1;
  if (parada.endDate && parada.startDate) {
    const end = new Date(parada.endDate.includes('T') ? parada.endDate : `${parada.endDate}T00:00:00`);
    if (!isNaN(end.getTime()) && end >= start) {
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) {
        duration = diffDays;
      }
    }
  }

  duration = Math.max(1, duration);

  const days = Array.from({ length: duration }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: d,
      dateStr,
      dayIndex: i,
      label: `Día ${i + 1}`,
      fullLabel: `Día ${i + 1}`
    };
  });

  const endDate = days[days.length - 1].date;

  return {
    startDate: start,
    endDate,
    days,
    durationDays: duration
  };
}

/**
 * Helper centralizado para obtener la disponibilidad efectiva de una especialidad en una fecha.
 * Para MEH (u otra especialidad):
 * 1. Si existe dotación global (specialtyAvailability) para ese día, se devuelve ese valor oficial.
 * 2. Si no hay dotación global pero hay empresas cargadas (resourceAvailability), se devuelve la suma de empresas.
 * 3. Si no hay ninguna información, devuelve null.
 */
export function getEffectiveSpecialtyAvailability(
  parada: ParadaEvent,
  date: string,
  specialty: ExternalSpecialty
): number | null {
  // 1. Buscar dotación global informada
  const globalItem = parada.specialtyAvailability?.find(
    s => s.specialty === specialty && (s.date === date || (!s.date && !date))
  );

  if (globalItem && globalItem.count !== null && globalItem.count !== undefined) {
    return globalItem.count;
  }

  // 2. Si no hay dotación global, calcular suma de empresas con valor definido
  const companyItems = (parada.resourceAvailability || []).filter(
    r => r.specialty === specialty && (r.date === date || (!r.date && !date)) && r.count !== null && r.count !== undefined
  );

  if (companyItems.length > 0) {
    return companyItems.reduce((acc, curr) => acc + (typeof curr.count === 'number' ? curr.count : 0), 0);
  }

  return null;
}

/**
 * Retorna la disponibilidad configurada en el Hito/Parada para una empresa y especialidad específica en una fecha.
 * Si no está configurada, retorna null.
 */
export function getEffectiveCompanyAvailability(
  parada: ParadaEvent | null,
  date: string,
  specialty: ExternalSpecialty,
  company: Company
): number | null {
  if (!parada || !parada.resourceAvailability) return null;
  const item = parada.resourceAvailability.find(
    r => r.specialty === specialty && r.company === company && (r.date === date || (!r.date && !date))
  );
  if (item && item.count !== null && item.count !== undefined) {
    return item.count;
  }
  return null;
}

export const createDefaultAvailability = (): DayAvailability[] => {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOffset: i,
    specialties: {
      MEH: 10,
      AND: null,
      TOP: null,
      CIV: 2,
      TUB: 4,
      COB: 2,
      LUB: 2
    }
  }));
};

/**
 * Retorna la suma de personas asignadas a empresas en un requerimiento.
 */
export function getRequirementAssignedCount(req: SpecialtyRequirement): number {
  if (!req.companyAllocations || req.companyAllocations.length === 0) return 0;
  return req.companyAllocations.reduce((sum, alloc) => sum + (alloc.count || 0), 0);
}

/**
 * Retorna la cantidad pendiente de asignación por empresa.
 */
export function getRequirementPendingCount(req: SpecialtyRequirement): number {
  const assigned = getRequirementAssignedCount(req);
  return Math.max(0, req.count - assigned);
}

/**
 * Análisis del estado de asignación por empresa para un requerimiento de especialidad.
 */
export function getRequirementAllocationSummary(req: SpecialtyRequirement): {
  assigned: number;
  pending: number;
  isOver: boolean;
  isComplete: boolean;
  isPending: boolean;
  label: string;
} {
  const assigned = getRequirementAssignedCount(req);
  const pending = req.count - assigned;
  const isOver = assigned > req.count;
  const isComplete = assigned === req.count && req.count > 0;
  const isPending = assigned < req.count;

  let label = '';
  if (req.companyAllocations && req.companyAllocations.length > 0) {
    const activeAllocs = req.companyAllocations.filter(a => a.count > 0);
    if (activeAllocs.length > 0) {
      label = activeAllocs.map(a => `${a.company} ${a.count}`).join(' + ');
      if (pending > 0) {
        label += ` (${pending} pend.)`;
      }
    } else {
      label = 'Empresa pendiente';
    }
  } else {
    label = 'Empresa pendiente';
  }

  return {
    assigned,
    pending: Math.max(0, pending),
    isOver,
    isComplete,
    isPending,
    label
  };
}

/**
 * Asigna automáticamente la empresa si la especialidad solo tiene 1 empresa disponible.
 */
export function getDefaultAllocationsForSpecialty(specialty: Specialty, count: number): CompanyAllocation[] {
  const allowedCompanies = SPECIALTY_COMPANIES[specialty as ExternalSpecialty] || [];
  if (allowedCompanies.length === 1 && count > 0) {
    return [{ company: allowedCompanies[0], count }];
  }
  return [];
}

/**
 * Retorna los requerimientos de especialidad efectivos para una tarea en un día específico (dayOffset).
 * Si la tarea tiene dailyRequirements definido, es la fuente de verdad:
 * retorna los requerimientos de ese día si existen, o [] si no hay recursos ese día.
 * Si no tiene dailyRequirements, retorna task.requirements si está dentro del rango activo.
 */
export function getTaskRequirementsForDay(task: Task, dayOffset: number): SpecialtyRequirement[] {
  if (!task) return [];
  if (task.dailyRequirements) {
    const daily = task.dailyRequirements[dayOffset];
    if (Array.isArray(daily)) {
      return daily;
    }
    return [];
  }
  if (dayOffset >= task.startDayOffset && dayOffset < task.startDayOffset + task.durationDays) {
    return Array.isArray(task.requirements) ? task.requirements : [];
  }
  return [];
}

/**
 * Determina si una tarea tiene asignación activa en un día específico.
 */
export function isTaskActiveOnDay(task: Task, dayOffset: number): boolean {
  const reqs = getTaskRequirementsForDay(task, dayOffset);
  return reqs.length > 0;
}


