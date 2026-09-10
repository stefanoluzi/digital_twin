export type Specialty = 'MEH' | 'AND' | 'TOP' | 'CIV' | 'TUB' | 'COB' | 'LUB';

export type Company =
  | 'BFB'
  | 'LOBERAZ'
  | 'EMET'
  | 'COMIBOR'
  | 'TECHINT'
  | 'ANDEMET';

export type ExternalSpecialty =
  | 'MEH'
  | 'TUB'
  | 'COB'
  | 'LUB'
  | 'CIV'
  | 'TOP'
  | 'AND';

export interface DailySpecialtyAvailability {
  date?: string;
  specialty: ExternalSpecialty;
  count: number | null;
}

export interface DailyExternalResourceAvailability {
  date?: string;
  specialty: ExternalSpecialty;
  company: Company;
  count: number | null;
}

export type ExternalResourceAvailability = DailyExternalResourceAvailability;

export type Impact = 'INO' | 'CALIDAD' | 'HSE' | 'EFICIENCIA';

export type ExecutedBy = 'GMB' | 'GUARDIA' | 'TERCEROS';

export type Zone = 'COBA' | 'HG' | 'LP' | 'LCO' | 'ZTREF' | 'REMA' | 'LRE' | 'PENF' | 'SHAC' | 'GENERAL';

export interface CompanyAllocation {
  company: Company;
  count: number;
}

export interface SpecialtyRequirement {
  specialty: Specialty;
  count: number;
  companyAllocations?: CompanyAllocation[];
}

export interface ParadaEvent {
  id: string;
  title: string;
  startDate?: string; // YYYY-MM-DD or ISO string
  endDate?: string;   // YYYY-MM-DD or ISO string
  startDayOffset: number;
  durationDays: number;
  specialtyAvailability?: DailySpecialtyAvailability[];
  resourceAvailability?: ExternalResourceAvailability[];
}

export interface Task {
  id: string;
  title: string;
  paradaId?: string;
  startDate?: string; // YYYY-MM-DD
  justification?: string;
  zone: Zone;
  executedBy: ExecutedBy;
  responsable?: string;
  impacts: Impact[];
  criticality: 'Alta' | 'Media' | 'Baja';
  startDayOffset: number; // 0 is Day 1 of the selected parada
  durationDays: number;
  requirements: SpecialtyRequirement[];
  dailyRequirements?: Record<number, SpecialtyRequirement[]>; // dayOffset -> requirements specific to that day
  workHours?: number; // Standard daily work hours for this task (default 9 if not set)
  dailyWorkHours?: Record<number, number>; // dayOffset -> specific daily work hours override
}

export interface DayAvailability {
  dayOffset: number;
  specialties: Record<Specialty, number | null>;
}

export interface ProjectInfo {
  id: string;
  name: string;
  line: string;
  startDate: string; // ISO string
  createdAt: string;
}

export interface PlannerModuleData {
  projectInfo: ProjectInfo;
  tasks: Task[];
  paradas: ParadaEvent[];
}
