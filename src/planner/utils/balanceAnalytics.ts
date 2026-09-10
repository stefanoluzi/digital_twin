import { 
  Task, 
  ParadaEvent, 
  Specialty, 
  Company, 
  ExternalSpecialty,
  SpecialtyRequirement 
} from '../types';
import { 
  getEffectiveSpecialtyAvailability, 
  getEffectiveCompanyAvailability,
  getTaskRequirementsForDay, 
  getRequirementAssignedCount, 
  getRequirementPendingCount,
  SPECIALTY_COMPANIES
} from '../constants';

export interface CompanyBalanceItem {
  company: Company | 'PENDING';
  assigned: number;
  available: number | null;
  gap: number | null; // assigned - available (if available !== null)
  status: 'normal' | 'complete' | 'overloaded' | 'availability-pending';
  count: number; // for backward compatibility
}

export interface TaskSpecialtyAllocationDetail {
  taskId: string;
  taskTitle: string;
  criticality: 'Alta' | 'Media' | 'Baja';
  zone: string;
  specialty: Specialty;
  count: number;
  companyAllocations: { company: Company; count: number }[];
  assignedToCompanies: number;
  pendingCompany: number;
  isPending: boolean;
}

export interface DailySpecialtyBalance {
  specialty: Specialty;
  dateStr: string;
  dayIndex: number;
  dayLabel: string;
  
  // A. Balance de Capacidad Global
  assigned: number;
  available: number | null;
  capacityGap: number | null; // assigned - available (if available !== null)
  capacityStatus: 'ok' | 'overloaded' | 'availability-pending';
  
  // B. Balance de Distribución Empresarial
  distributed: number;
  pendingCompany: number;
  distributionStatus: 'complete' | 'incomplete' | 'overallocated';
  
  // Desglose y disponibilidad por empresa
  companies: CompanyBalanceItem[];
  companyCounts: Record<string, number>;
  companyAvailability: Record<string, number | null>;
  companyDetails: Record<string, CompanyBalanceItem>;
  
  // Detalle de tareas del día para esta especialidad
  tasks: TaskSpecialtyAllocationDetail[];
}

/**
 * Calcula el balance completo de capacidad y distribución empresarial para una especialidad en un día específico.
 * 
 * Reglas mandatorias:
 * 1. NO DOBLE CONTEO: Si una tarea requiere MEH=8 (BFB=5, LOB=3), assigned=8, distributed=8 (no 16).
 * 2. Disponibilidad no definida (null) no se trata como 0 ni como sobrecarga.
 * 3. Sobrecarga se marca si assigned > available (cuando available !== null).
 * 4. Empresa pendiente se marca si distributed < assigned (no es sobrecarga, es falta de asignación contratista).
 * 5. Sobreasignación se marca si distributed > assigned.
 */
export function getDailySpecialtyBalance(
  parada: ParadaEvent | null,
  tasks: Task[],
  dateStr: string,
  specialty: Specialty,
  dayIndex: number,
  dayLabel: string = `Día ${dayIndex + 1}`
): DailySpecialtyBalance {
  let assigned = 0;
  let distributed = 0;
  const companyCounts: Record<string, number> = {
    BFB: 0,
    LOBERAZ: 0,
    EMET: 0,
    COMIBOR: 0,
    TECHINT: 0,
    ANDEMET: 0,
    PENDING: 0
  };
  const taskDetails: TaskSpecialtyAllocationDetail[] = [];

  const paradaTasks = tasks.filter(t => t.paradaId ? t.paradaId === parada?.id : true);

  paradaTasks.forEach(task => {
    const reqs = getTaskRequirementsForDay(task, dayIndex);
    const specReqs = reqs.filter(r => r.specialty === specialty);

    specReqs.forEach(req => {
      assigned += req.count;

      const assignedToCompanies = getRequirementAssignedCount(req);
      const pendingCompany = Math.max(0, req.count - assignedToCompanies);
      distributed += assignedToCompanies;

      const activeAllocs = (req.companyAllocations || []).filter(a => a.count > 0);
      activeAllocs.forEach(a => {
        companyCounts[a.company] = (companyCounts[a.company] || 0) + a.count;
      });

      if (pendingCompany > 0) {
        companyCounts['PENDING'] = (companyCounts['PENDING'] || 0) + pendingCompany;
      }

      taskDetails.push({
        taskId: task.id,
        taskTitle: task.title,
        criticality: task.criticality,
        zone: task.zone,
        specialty,
        count: req.count,
        companyAllocations: activeAllocs,
        assignedToCompanies,
        pendingCompany,
        isPending: pendingCompany > 0
      });
    });
  });

  const pendingCompany = Math.max(0, assigned - distributed);

  // Disponibilidad de capacidad oficial
  let available: number | null = null;
  if (parada && dateStr) {
    available = getEffectiveSpecialtyAvailability(parada, dateStr, specialty as ExternalSpecialty);
  }

  // Estado de capacidad
  let capacityStatus: 'ok' | 'overloaded' | 'availability-pending' = 'ok';
  let capacityGap: number | null = null;

  if (available === null) {
    capacityStatus = 'availability-pending';
    capacityGap = null;
  } else {
    capacityGap = assigned - available;
    if (assigned > available) {
      capacityStatus = 'overloaded';
    } else {
      capacityStatus = 'ok';
    }
  }

  // Estado de distribución empresarial
  let distributionStatus: 'complete' | 'incomplete' | 'overallocated' = 'complete';
  if (distributed === assigned) {
    distributionStatus = 'complete';
  } else if (distributed < assigned) {
    distributionStatus = 'incomplete';
  } else {
    distributionStatus = 'overallocated';
  }

  // Desglose detallado por empresa comparando asignación vs disponibilidad del Hito
  const companyAvailability: Record<string, number | null> = {};
  const companyDetails: Record<string, CompanyBalanceItem> = {};
  const allKnownCompanies: Company[] = ['BFB', 'LOBERAZ', 'EMET', 'COMIBOR', 'TECHINT', 'ANDEMET'];

  allKnownCompanies.forEach(comp => {
    const compAssigned = companyCounts[comp] || 0;
    let compAvailable: number | null = null;
    if (parada && dateStr) {
      compAvailable = getEffectiveCompanyAvailability(parada, dateStr, specialty as ExternalSpecialty, comp);
    }
    companyAvailability[comp] = compAvailable;

    let compStatus: 'normal' | 'complete' | 'overloaded' | 'availability-pending' = 'normal';
    let compGap: number | null = null;

    if (compAvailable === null) {
      compStatus = 'availability-pending';
    } else {
      compGap = compAssigned - compAvailable;
      if (compAssigned > compAvailable) {
        compStatus = 'overloaded';
      } else if (compAssigned === compAvailable && compAvailable > 0) {
        compStatus = 'complete';
      } else {
        compStatus = 'normal';
      }
    }

    companyDetails[comp] = {
      company: comp,
      assigned: compAssigned,
      available: compAvailable,
      gap: compGap,
      status: compStatus,
      count: compAssigned
    };
  });

  // Lista ordenada de empresas con asignación activa a tareas o disponibilidad definida
  const companies: CompanyBalanceItem[] = allKnownCompanies
    .filter(c => (companyCounts[c] || 0) > 0 || (companyAvailability[c] !== null && companyAvailability[c]! > 0))
    .map(c => companyDetails[c]);

  if (pendingCompany > 0) {
    const pendingItem: CompanyBalanceItem = {
      company: 'PENDING',
      assigned: pendingCompany,
      available: null,
      gap: null,
      status: 'availability-pending',
      count: pendingCompany
    };
    companies.push(pendingItem);
    companyDetails['PENDING'] = pendingItem;
  }

  return {
    specialty,
    dateStr,
    dayIndex,
    dayLabel,
    assigned,
    available,
    capacityGap,
    capacityStatus,
    distributed,
    pendingCompany,
    distributionStatus,
    companies,
    companyCounts,
    companyAvailability,
    companyDetails,
    tasks: taskDetails
  };
}

/**
 * Calcula los balances diarios para todas las especialidades activas en un día.
 */
export function getDailyAllSpecialtiesBalance(
  parada: ParadaEvent | null,
  tasks: Task[],
  dateStr: string,
  dayIndex: number,
  dayLabel: string = `Día ${dayIndex + 1}`
): {
  meh: DailySpecialtyBalance;
  otherSpecialties: DailySpecialtyBalance[];
  allSpecialties: Record<Specialty, DailySpecialtyBalance>;
} {
  const specs: Specialty[] = ['MEH', 'TUB', 'COB', 'LUB', 'AND', 'TOP', 'CIV'];
  const allSpecialties: Record<Specialty, DailySpecialtyBalance> = {} as any;

  specs.forEach(s => {
    allSpecialties[s] = getDailySpecialtyBalance(parada, tasks, dateStr, s, dayIndex, dayLabel);
  });

  const meh = allSpecialties['MEH'];
  const otherSpecialties = specs
    .filter(s => s !== 'MEH')
    .map(s => allSpecialties[s])
    .filter(b => b.assigned > 0 || (b.available !== null && b.available > 0));

  return {
    meh,
    otherSpecialties,
    allSpecialties
  };
}
