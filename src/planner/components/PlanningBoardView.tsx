import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  Settings, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  X,
  Zap, 
  CalendarDays, 
  Layers, 
  Pencil, 
  Users, 
  Clock, 
  HardHat,
  Filter,
  Check,
  AlertTriangle,
  GripVertical,
  Building2,
  HelpCircle,
  Search,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Info,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Task, 
  Zone, 
  Specialty, 
  ParadaEvent, 
  ProjectInfo, 
  ExternalSpecialty, 
  Company, 
  SpecialtyRequirement 
} from '../types';
import { 
  ZONES, 
  SPECIALTIES_LIST, 
  EXTERNAL_SPECIALTIES, 
  SPECIALTY_COMPANIES,
  SPECIALTY_LABELS,
  getEffectiveSpecialtyAvailability,
  getParadaDays,
  getRequirementAllocationSummary,
  getRequirementAssignedCount,
  getRequirementPendingCount,
  getTaskRequirementsForDay,
  isTaskActiveOnDay
} from '../constants';
import { QuickResourcePopover } from './QuickResourcePopover';
import { DayResourceAssignmentModal } from './DayResourceAssignmentModal';
import { TaskDrawer } from './TaskDrawer';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ExportPdfModal } from './ExportPdfModal';
import { DailyMehDistributionPopover } from './DailyMehDistributionPopover';
import { 
  getDailyAllSpecialtiesBalance, 
  DailySpecialtyBalance 
} from '../utils/balanceAnalytics';

interface PlanningBoardViewProps {
  paradas: ParadaEvent[];
  selectedParada: ParadaEvent | null;
  onSelectParada: (paradaId: string) => void;
  onOpenNewParada: () => void;
  onEditParada: (parada: ParadaEvent) => void;
  filteredTasks: Task[];
  allTasks: Task[];
  planningStartDate: Date;
  projectInfo?: ProjectInfo;
  onOpenNewTaskModal: () => void;
  onOpenEditTaskModal: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onAutoOptimize: () => void;
  filterCriticality?: string;
  setFilterCriticality?: (val: string) => void;
  onNavigateToTerceros?: () => void;
}

export const PlanningBoardView: React.FC<PlanningBoardViewProps> = ({
  paradas,
  selectedParada,
  onSelectParada,
  onOpenNewParada,
  onEditParada,
  filteredTasks: rawFilteredTasks,
  allTasks,
  planningStartDate,
  projectInfo,
  onOpenNewTaskModal,
  onOpenEditTaskModal,
  onDeleteTask,
  onUpdateTask,
  onAutoOptimize,
  filterCriticality: propFilterCriticality,
  setFilterCriticality: propSetFilterCriticality,
  onNavigateToTerceros,
}) => {
  const paradaDaysInfo = useMemo(
    () => getParadaDays(selectedParada, planningStartDate),
    [selectedParada, planningStartDate]
  );
  const { days, durationDays } = paradaDaysInfo;

  // Active drawer / popover / day assignment modal state
  const [activeDrawerTask, setActiveDrawerTask] = useState<Task | null>(null);
  const [quickPopoverReq, setQuickPopoverReq] = useState<{ req: SpecialtyRequirement; task: Task } | null>(null);
  const [dayAssignmentState, setDayAssignmentState] = useState<{ task: Task; dayIndex: number } | null>(null);
  const [hoveredTercerosDay, setHoveredTercerosDay] = useState<number | null>(null);
  const [selectedMehBalancePopover, setSelectedMehBalancePopover] = useState<DailySpecialtyBalance | null>(null);

  // Deletion confirmation and toast state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleteToastMessage, setDeleteToastMessage] = useState<string | null>(null);

  const handleConfirmDeleteTask = (taskId: string) => {
    onDeleteTask(taskId);
    if (activeDrawerTask?.id === taskId) {
      setActiveDrawerTask(null);
    }
    setTaskToDelete(null);
    setDeleteToastMessage('Tarea eliminada');
    setTimeout(() => {
      setDeleteToastMessage(null);
    }, 3000);
  };

  const handleOpenDayAssignment = (task: Task, dayIndex: number) => {
    setDayAssignmentState({ task, dayIndex });
  };

  const handleSaveDayAssignment = (taskId: string, dayIndex: number, newReqs: SpecialtyRequirement[], workHours?: number) => {
    const targetTask = allTasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const safeNewReqs: SpecialtyRequirement[] = Array.isArray(newReqs) ? newReqs : [];

    // Clone or initialize dailyRequirements
    const dailyReqs: Record<number, SpecialtyRequirement[]> = {};
    if (targetTask.dailyRequirements) {
      Object.entries(targetTask.dailyRequirements).forEach(([d, reqs]) => {
        const reqList = reqs as SpecialtyRequirement[] | undefined;
        if (Array.isArray(reqList) && reqList.length > 0) {
          dailyReqs[Number(d)] = JSON.parse(JSON.stringify(reqList));
        }
      });
    } else {
      for (let d = 0; d < targetTask.durationDays; d++) {
        const idx = targetTask.startDayOffset + d;
        dailyReqs[idx] = JSON.parse(JSON.stringify(targetTask.requirements || []));
      }
    }

    // Apply change for the specified day
    if (safeNewReqs.length > 0) {
      dailyReqs[dayIndex] = JSON.parse(JSON.stringify(safeNewReqs));
    } else {
      delete dailyReqs[dayIndex];
    }

    // Manage dailyWorkHours override
    const dailyWorkHours: Record<number, number> = targetTask.dailyWorkHours 
      ? { ...targetTask.dailyWorkHours } 
      : {};

    if (typeof workHours === 'number' && workHours > 0) {
      dailyWorkHours[dayIndex] = workHours;
    } else {
      delete dailyWorkHours[dayIndex];
    }

    // Determine new startDayOffset and durationDays based on active days
    const activeOffsets = Object.keys(dailyReqs)
      .map(Number)
      .filter(d => Array.isArray(dailyReqs[d]) && dailyReqs[d].length > 0);

    let newStartOffset = targetTask.startDayOffset;
    let newDuration = targetTask.durationDays;

    if (activeOffsets.length > 0) {
      const minDay = Math.min(...activeOffsets);
      const maxDay = Math.max(...activeOffsets);
      newStartOffset = minDay;
      newDuration = maxDay - minDay + 1;
    }

    // Consolidate requirements across all days for backward compatibility with general views
    const specMap: Record<string, SpecialtyRequirement> = {};
    Object.values(dailyReqs).forEach(dayList => {
      if (Array.isArray(dayList)) {
        dayList.forEach(r => {
          if (!specMap[r.specialty] || specMap[r.specialty].count < r.count) {
            specMap[r.specialty] = JSON.parse(JSON.stringify(r));
          }
        });
      }
    });
    const consolidatedReqs = Object.values(specMap);

    const updatedTask: Task = {
      ...targetTask,
      startDayOffset: newStartOffset,
      startDate: days[newStartOffset]?.dateStr || targetTask.startDate,
      durationDays: Math.max(1, newDuration),
      requirements: consolidatedReqs.length > 0 ? consolidatedReqs : targetTask.requirements,
      dailyRequirements: dailyReqs,
      dailyWorkHours: Object.keys(dailyWorkHours).length > 0 ? dailyWorkHours : undefined
    };

    onUpdateTask(updatedTask);
    if (activeDrawerTask?.id === taskId) {
      setActiveDrawerTask(updatedTask);
    }
  };

  // Drag and Drop state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverDayIndex, setDragOverDayIndex] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  // Local View Filters & UI state
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [boardDisplayMode, setBoardDisplayMode] = useState<'combined' | 'contractors' | 'specialties'>('combined');
  const [showContractorMatrix, setShowContractorMatrix] = useState<boolean>(false);
  const [dailySummaryMode, setDailySummaryMode] = useState<'both' | 'contractors' | 'specialties'>('both');
  const [localFilterCriticality, setLocalFilterCriticality] = useState<string>('ALL');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('ALL');
  const [filterCompany, setFilterCompany] = useState<string>('ALL');
  const [filterAllocationStatus, setFilterAllocationStatus] = useState<string>('ALL');

  const filterCriticality = propFilterCriticality !== undefined ? propFilterCriticality : localFilterCriticality;
  const setFilterCriticality = (val: string) => {
    if (propSetFilterCriticality) propSetFilterCriticality(val);
    setLocalFilterCriticality(val);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterCriticality !== 'ALL') count++;
    if (filterSpecialty !== 'ALL') count++;
    if (filterCompany !== 'ALL') count++;
    if (filterAllocationStatus !== 'ALL') count++;
    return count;
  }, [filterCriticality, filterSpecialty, filterCompany, filterAllocationStatus]);

  // Calculate daily requirements for the selected parada days
  const dailyNeeds = useMemo(() => {
    const map: Record<number, Record<Specialty, number>> = {};
    days.forEach((_, idx) => {
      map[idx] = { MEH: 0, AND: 0, TOP: 0, CIV: 0, TUB: 0, COB: 0, LUB: 0 };
    });

    const paradaTasks = allTasks.filter(t => t.paradaId ? t.paradaId === selectedParada?.id : true);

    paradaTasks.forEach(task => {
      days.forEach((_, dayIdx) => {
        const reqs = getTaskRequirementsForDay(task, dayIdx);
        if (reqs.length > 0 && map[dayIdx]) {
          reqs.forEach(req => {
            map[dayIdx][req.specialty] = (map[dayIdx][req.specialty] || 0) + req.count;
          });
        }
      });
    });

    return map;
  }, [days, allTasks, selectedParada]);

  // Centralized Daily Specialty & Contractor Distribution Balances (Capacity & Company Allocation)
  const dailyBalances = useMemo(() => {
    return days.map((day, idx) => {
      return getDailyAllSpecialtiesBalance(
        selectedParada,
        allTasks,
        day.dateStr,
        idx,
        day.label
      );
    });
  }, [days, selectedParada, allTasks]);

  // Daily Contractor Headcount and Distribution Summary per Day
  const dailyContractorSummary = useMemo(() => {
    return days.map((day, dayIdx) => {
      const allCompanies: Record<string, number> = {
        BFB: 0,
        LOBERAZ: 0,
        EMET: 0,
        COMIBOR: 0,
        TECHINT: 0,
        ANDEMET: 0,
        SIN_EMPRESA: 0,
      };

      const mehCompanies: Record<string, number> = {
        BFB: 0,
        LOBERAZ: 0,
        EMET: 0,
        COMIBOR: 0,
        SIN_EMPRESA: 0,
      };

      let totalHeadcount = 0;
      let totalMeh = 0;
      let totalPending = 0;
      let totalMehPending = 0;

      const paradaTasks = allTasks.filter(t => t.paradaId ? t.paradaId === selectedParada?.id : true);

      paradaTasks.forEach(task => {
        const reqs = getTaskRequirementsForDay(task, dayIdx);
        reqs.forEach(req => {
          const isMeh = req.specialty === 'MEH';
          const assigned = getRequirementAssignedCount(req);
          const pending = Math.max(0, req.count - assigned);

          totalHeadcount += req.count;
          if (isMeh) totalMeh += req.count;
          totalPending += pending;
          if (isMeh) totalMehPending += pending;

          if (req.companyAllocations) {
            req.companyAllocations.forEach(a => {
              if (a.count > 0) {
                allCompanies[a.company] = (allCompanies[a.company] || 0) + a.count;
                if (isMeh) {
                  mehCompanies[a.company] = (mehCompanies[a.company] || 0) + a.count;
                }
              }
            });
          }

          if (pending > 0) {
            allCompanies['SIN_EMPRESA'] = (allCompanies['SIN_EMPRESA'] || 0) + pending;
            if (isMeh) {
              mehCompanies['SIN_EMPRESA'] = (mehCompanies['SIN_EMPRESA'] || 0) + pending;
            }
          }
        });
      });

      // Planned availability by company from parada configuration
      const availableByCompany: Record<string, number> = {};
      if (selectedParada?.resourceAvailability) {
        selectedParada.resourceAvailability
          .filter(r => r.date === day.dateStr)
          .forEach(r => {
            if (r.company && typeof r.count === 'number') {
              availableByCompany[r.company] = (availableByCompany[r.company] || 0) + r.count;
            }
          });
      }

      return {
        dayIdx,
        day,
        dateStr: day.dateStr,
        allCompanies,
        mehCompanies,
        totalHeadcount,
        totalMeh,
        totalPending,
        totalMehPending,
        availableByCompany
      };
    });
  }, [days, allTasks, selectedParada]);

  // Calculate daily Terceros requirements and company breakdowns
  const dailyTercerosData = useMemo(() => {
    const map: Record<number, {
      totalBySpec: Record<Specialty, number>;
      companiesBySpec: Record<Specialty, Record<Company | 'SIN_EMPRESA', number>>;
    }> = {};

    days.forEach((_, idx) => {
      map[idx] = {
        totalBySpec: { MEH: 0, AND: 0, TOP: 0, CIV: 0, TUB: 0, COB: 0, LUB: 0 },
        companiesBySpec: {
          MEH: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
          AND: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
          TOP: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
          CIV: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
          TUB: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
          COB: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
          LUB: { BFB: 0, LOBERAZ: 0, EMET: 0, COMIBOR: 0, TECHINT: 0, ANDEMET: 0, SIN_EMPRESA: 0 },
        }
      };
    });

    const paradaTasks = allTasks.filter(t => t.paradaId ? t.paradaId === selectedParada?.id : true);

    paradaTasks.forEach(task => {
      days.forEach((_, dayIdx) => {
        const reqs = getTaskRequirementsForDay(task, dayIdx);
        if (reqs.length > 0 && map[dayIdx]) {
          reqs.forEach(req => {
            map[dayIdx].totalBySpec[req.specialty] = (map[dayIdx].totalBySpec[req.specialty] || 0) + req.count;

            const assigned = getRequirementAssignedCount(req);
            const pending = Math.max(0, req.count - assigned);

            if (req.companyAllocations) {
              req.companyAllocations.forEach(a => {
                map[dayIdx].companiesBySpec[req.specialty][a.company] = 
                  (map[dayIdx].companiesBySpec[req.specialty][a.company] || 0) + a.count;
              });
            }
            if (pending > 0) {
              map[dayIdx].companiesBySpec[req.specialty]['SIN_EMPRESA'] = 
                (map[dayIdx].companiesBySpec[req.specialty]['SIN_EMPRESA'] || 0) + pending;
            }
          });
        }
      });
    });

    return map;
  }, [days, allTasks, selectedParada]);

  // Check overload helper for any day index & specialty
  const getDaySpecialtyStatus = (dayIdx: number, spec: Specialty) => {
    const dateStr = days[dayIdx]?.dateStr;
    const needed = dailyNeeds[dayIdx]?.[spec] || 0;
    
    let available: number | null = null;
    if (selectedParada && dateStr) {
      available = getEffectiveSpecialtyAvailability(selectedParada, dateStr, spec as ExternalSpecialty);
    }
    
    const isDefined = available !== null;
    const isOverloaded = isDefined && needed > (available || 0);
    const deficit = isOverloaded ? needed - (available || 0) : 0;

    return { needed, available, isDefined, isOverloaded, deficit };
  };

  // Critical tasks per day counter
  const criticalTasksPerDay = useMemo(() => {
    const counts: Record<number, number> = {};
    days.forEach((_, idx) => { counts[idx] = 0; });

    const paradaTasks = allTasks.filter(t => t.paradaId ? t.paradaId === selectedParada?.id : true);
    paradaTasks.forEach(task => {
      if (task.criticality === 'Alta') {
        days.forEach((_, dayIdx) => {
          if (isTaskActiveOnDay(task, dayIdx) && counts[dayIdx] !== undefined) {
            counts[dayIdx]++;
          }
        });
      }
    });
    return counts;
  }, [days, allTasks, selectedParada]);

  // Top Operational Balance Diagnostic (Repensado)
  const operationalDiagnostic = useMemo(() => {
    const activeTasks = allTasks.filter(t => t.paradaId ? t.paradaId === selectedParada?.id : true);
    const criticalCount = activeTasks.filter(t => t.criticality === 'Alta').length;
    
    // Count tasks with pending contractor allocation
    const pendingCompanyTasksCount = activeTasks.filter(t => 
      t.requirements.some(r => getRequirementPendingCount(r) > 0)
    ).length;

    // Overload analysis per specialty across the intervention
    const specialtyReports = (['MEH', 'TUB', 'COB', 'LUB', 'CIV'] as Specialty[]).map(spec => {
      const overloadedDays: number[] = [];
      let maxDeficit = 0;

      days.forEach((_, idx) => {
        const st = getDaySpecialtyStatus(idx, spec);
        if (st.isOverloaded) {
          overloadedDays.push(idx + 1);
          if (st.deficit > maxDeficit) maxDeficit = st.deficit;
        }
      });

      return {
        spec,
        hasOverload: overloadedDays.length > 0,
        overloadedDays,
        maxDeficit
      };
    });

    const totalOverloadedDaysCount = days.filter((_, idx) => 
      (['MEH', 'TUB', 'COB', 'LUB', 'CIV'] as Specialty[]).some(s => getDaySpecialtyStatus(idx, s).isOverloaded)
    ).length;

    return {
      criticalCount,
      pendingCompanyTasksCount,
      specialtyReports,
      totalOverloadedDaysCount
    };
  }, [allTasks, selectedParada, days, dailyNeeds]);

  // Extended Filtered Tasks (incorporates local view filters)
  const displayTasks = useMemo(() => {
    return rawFilteredTasks.filter(task => {
      // Criticality filter
      if (filterCriticality === 'CRITICAL' && task.criticality !== 'Alta') return false;
      if (filterCriticality === 'MEDIA' && task.criticality !== 'Media') return false;
      if (filterCriticality === 'BAJA' && task.criticality !== 'Baja') return false;

      // Specialty filter
      if (filterSpecialty !== 'ALL') {
        if (!task.requirements.some(r => r.specialty === filterSpecialty)) return false;
      }

      // Company filter
      if (filterCompany !== 'ALL') {
        if (filterCompany === 'PENDING') {
          if (!task.requirements.some(r => getRequirementPendingCount(r) > 0)) return false;
        } else {
          if (!task.requirements.some(r => r.companyAllocations?.some(a => a.company === filterCompany && a.count > 0))) {
            return false;
          }
        }
      }

      // Allocation Status filter
      if (filterAllocationStatus === 'PENDING') {
        if (!task.requirements.some(r => getRequirementPendingCount(r) > 0)) return false;
      } else if (filterAllocationStatus === 'COMPLETE') {
        if (task.requirements.some(r => getRequirementPendingCount(r) > 0)) return false;
      } else if (filterAllocationStatus === 'OVERLOADED') {
        let hasOver = false;
        for (let d = 0; d < task.durationDays; d++) {
          const dayIdx = task.startDayOffset + d;
          if (task.requirements.some(r => getDaySpecialtyStatus(dayIdx, r.specialty).isOverloaded)) {
            hasOver = true;
            break;
          }
        }
        if (!hasOver) return false;
      }

      return true;
    });
  }, [rawFilteredTasks, filterCriticality, filterSpecialty, filterCompany, filterAllocationStatus, days, dailyNeeds]);

  // Group filtered tasks by zone and supervisor
  const groupedTasks: Partial<Record<Zone, Record<string, Task[]>>> = useMemo(() => {
    const map: Partial<Record<Zone, Record<string, Task[]>>> = {};
    ZONES.forEach(z => { map[z] = {}; });
    displayTasks.forEach(t => {
      const resp = t.responsable || 'Sin Supervisor Asignado';
      if (!map[t.zone]) map[t.zone] = {};
      if (!map[t.zone]![resp]) map[t.zone]![resp] = [];
      map[t.zone]![resp].push(t);
    });
    return map;
  }, [displayTasks]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    isDraggingRef.current = true;
    setDraggedTask(task);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      isDraggingRef.current = false;
      setDraggedTask(null);
      setDragOverDayIndex(null);
    }, 50);
  };

  const handleDragOverCell = (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDayIndex !== dayIdx) {
      setDragOverDayIndex(dayIdx);
    }
  };

  const handleDropOnCell = (e: React.DragEvent, targetDayIdx: number) => {
    e.preventDefault();
    if (!draggedTask) return;

    const maxOffset = durationDays - draggedTask.durationDays;
    const safeOffset = Math.max(0, Math.min(targetDayIdx, maxOffset));
    const nextDay = days[safeOffset];

    onUpdateTask({
      ...draggedTask,
      startDayOffset: safeOffset,
      startDate: nextDay ? nextDay.dateStr : draggedTask.startDate
    });

    handleDragEnd();
  };

  // Drag capacity impact evaluation helper
  const getDragCapacityPreview = (targetDayIdx: number) => {
    if (!draggedTask) return null;
    const targetOffset = Math.max(0, Math.min(targetDayIdx, durationDays - draggedTask.durationDays));
    
    // Check MEH capacity on target day
    const currentMehNeeded = dailyNeeds[targetOffset]?.['MEH'] || 0;
    const currentMehAvail = selectedParada ? getEffectiveSpecialtyAvailability(selectedParada, days[targetOffset]?.dateStr || '', 'MEH') : null;
    
    const taskMeh = draggedTask.requirements.find(r => r.specialty === 'MEH')?.count || 0;
    const isAlreadyOnDay = draggedTask.startDayOffset <= targetOffset && targetOffset < draggedTask.startDayOffset + draggedTask.durationDays;
    const projectedMeh = isAlreadyOnDay ? currentMehNeeded : currentMehNeeded + taskMeh;

    let statusText = '';
    let isOver = false;

    if (currentMehAvail !== null) {
      if (projectedMeh > currentMehAvail) {
        isOver = true;
        statusText = `⚠ Sobrecarga MEH: +${projectedMeh - currentMehAvail} (${projectedMeh}/${currentMehAvail})`;
      } else {
        statusText = `✓ Capacidad MEH disponible (${projectedMeh}/${currentMehAvail})`;
      }
    } else {
      statusText = `Capacidad sin definir (${projectedMeh}/—)`;
    }

    return { isOver, statusText, targetOffset };
  };

  // Task click handler (opens drawer without interfering with drag)
  const handleTaskRowClick = (task: Task, e: React.MouseEvent) => {
    if (isDraggingRef.current) return;
    setActiveDrawerTask(task);
  };

  // Direct Resource click handler (opens QuickResourcePopover)
  const handleResourceBadgeClick = (req: SpecialtyRequirement, task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickPopoverReq({ req, task });
  };

  const handleSaveQuickPopover = (updatedReq: SpecialtyRequirement) => {
    if (!quickPopoverReq) return;
    const updatedTask: Task = {
      ...quickPopoverReq.task,
      requirements: quickPopoverReq.task.requirements.map(r => 
        r.specialty === updatedReq.specialty ? updatedReq : r
      )
    };
    onUpdateTask(updatedTask);
    if (activeDrawerTask?.id === updatedTask.id) {
      setActiveDrawerTask(updatedTask);
    }
    setQuickPopoverReq(null);
  };

  return (
    <div className="planner-board flex-1 flex flex-col gap-2 overflow-hidden text-gray-900 min-h-0">
      {/* 1. COMPACT UNIFIED INTERVENTION & OPERATIONAL TOOLBAR */}
      <div className="planner-board-commandbar bg-white rounded-xl border border-border-gray px-3 py-1.5 flex flex-wrap items-center justify-between shadow-xs shrink-0 gap-2">
        {/* Left: Intervention selector + dates + quick diagnostic pills */}
        <div className="planner-board-overview flex items-center flex-wrap gap-2">
          <div className="planner-intervention-control flex items-center gap-1.5">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:inline">
              Intervención:
            </span>
            <select
              value={selectedParada?.id || ''}
              onChange={e => onSelectParada(e.target.value)}
              className="bg-orange-50 border border-brand-orange/40 text-brand-blue font-black text-xs rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-orange/20 cursor-pointer"
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
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-lg">
              <CalendarDays className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span>
                {format(paradaDaysInfo.startDate, 'dd/MM')} → {format(paradaDaysInfo.endDate, 'dd/MM')} · {durationDays}d · <strong className="text-brand-blue">{rawFilteredTasks.length} tareas</strong>
              </span>
            </div>
          )}

          {/* Specialty Capacity Indicators (Compact Chips) */}
          <div className="planner-specialty-health hidden lg:flex items-center gap-1">
            {operationalDiagnostic.specialtyReports.map(rep => (
              <div 
                key={rep.spec}
                className={`text-[10px] font-black px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                  rep.hasOverload
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
                title={rep.hasOverload ? `${SPECIALTY_LABELS[rep.spec] || rep.spec}: Déficit en días ${rep.overloadedDays.map(d => `Día ${d}`).join(', ')}` : `${SPECIALTY_LABELS[rep.spec] || rep.spec}: Sin sobrecargas`}
              >
                <span>{rep.spec}</span>
                <span>{rep.hasOverload ? `⚠ ${rep.overloadedDays.length}d` : '✓'}</span>
              </div>
            ))}
          </div>

          {/* Interactive Critical and Pending Company Counter Chips */}
          <div className="planner-diagnostic-pills flex items-center gap-1.5">
            {operationalDiagnostic.criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterCriticality(filterCriticality === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all ${
                  filterCriticality === 'CRITICAL' 
                    ? 'bg-red-600 text-white shadow-2xs ring-2 ring-red-400' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
                title="Click para filtrar tareas críticas"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{operationalDiagnostic.criticalCount} {operationalDiagnostic.criticalCount === 1 ? 'crítica' : 'críticas'}</span>
              </button>
            )}

            {operationalDiagnostic.pendingCompanyTasksCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterAllocationStatus(filterAllocationStatus === 'PENDING' ? 'ALL' : 'PENDING')}
                className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all ${
                  filterAllocationStatus === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-2xs ring-2 ring-amber-400'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
                title="Click para filtrar tareas con empresa pendiente"
              >
                <HelpCircle className="w-3 h-3" />
                <span>{operationalDiagnostic.pendingCompanyTasksCount} emp. pend.</span>
              </button>
            )}

            {operationalDiagnostic.totalOverloadedDaysCount > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-red-600 text-red-600" />
                <span>{operationalDiagnostic.totalOverloadedDaysCount}d sobrecarga</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions, View Mode Switcher and Filter Collapse Toggle */}
        <div className="planner-board-actions flex items-center gap-1.5 flex-wrap">
          {/* Visual Grid Display Mode Selector */}
          <div className="planner-view-toggle flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-300">
            <button
              type="button"
              onClick={() => setBoardDisplayMode('combined')}
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-black transition-all cursor-pointer ${
                boardDisplayMode === 'combined'
                  ? 'bg-white text-brand-blue shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Ver Especialidad y Contratistas asignados"
            >
              Combinado
            </button>
            <button
              type="button"
              onClick={() => setBoardDisplayMode('contractors')}
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                boardDisplayMode === 'contractors'
                  ? 'bg-brand-orange text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Resaltar empresas contratistas (BFB, EMET, LOBERAZ, etc.)"
            >
              <Building2 className="w-3 h-3" />
              <span>Contratistas</span>
            </button>
            <button
              type="button"
              onClick={() => setBoardDisplayMode('specialties')}
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-black transition-all cursor-pointer ${
                boardDisplayMode === 'specialties'
                  ? 'bg-white text-brand-blue shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Ver solo dotación de Especialidades (MEH, TUB, etc.)"
            >
              Especialidades
            </button>
          </div>

          {/* Toggle Contractor Distribution Matrix */}
          <button
            type="button"
            onClick={() => setShowContractorMatrix(!showContractorMatrix)}
            className={`px-2.5 py-1 text-xs font-black rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              showContractorMatrix 
                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-blue-50/60 hover:text-brand-blue'
            }`}
            title="Abrir / cerrar matriz de distribución diaria de contratistas vs disponibilidad de mecánicos"
          >
            <Building2 className={`w-3.5 h-3.5 ${showContractorMatrix ? 'text-white' : 'text-brand-blue'}`} />
            <span>Matriz Contratistas</span>
            {operationalDiagnostic.pendingCompanyTasksCount > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                showContractorMatrix ? 'bg-amber-400 text-gray-900' : 'bg-amber-100 text-amber-900'
              }`}>
                {operationalDiagnostic.pendingCompanyTasksCount} pend.
              </span>
            )}
          </button>

          {/* Collapsible Filter Toggle with Active Indicator */}
          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              isFiltersOpen 
                ? 'bg-gray-100 border-gray-400 text-gray-800' 
                : activeFiltersCount > 0
                ? 'bg-orange-50 border-brand-orange text-brand-orange font-black'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            title="Mostrar / ocultar filtros de la grilla"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="bg-brand-orange text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`} />
          </button>

          {selectedParada && onNavigateToTerceros && (
            <button
              type="button"
              onClick={onNavigateToTerceros}
              className="px-2.5 py-1 text-xs font-black text-slate-800 bg-orange-100 hover:bg-orange-200 border border-brand-orange/40 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Abrir Resumen de Terceros y cálculo de Horas-Hombre"
            >
              <Building2 className="w-3.5 h-3.5 text-brand-orange" />
              <span>Resumen Terceros</span>
            </button>
          )}

          {selectedParada && (
            <button
              type="button"
              onClick={() => onEditParada(selectedParada)}
              className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              title="Editar disponibilidad y fechas de esta intervención"
            >
              <Pencil className="w-3 h-3 text-brand-blue" />
              <span className="hidden sm:inline">Editar</span>
            </button>
          )}

          {selectedParada && (
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-2.5 py-1 text-xs font-bold text-gray-700 bg-white hover:bg-orange-50/50 hover:text-brand-orange border border-gray-300 hover:border-brand-orange/50 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Descargar o imprimir planificación de esta intervención en plano PDF A3 horizontal"
            >
              <Download className="w-3.5 h-3.5 text-brand-orange" />
              <span>Exportar PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNewParada}
            className="px-2.5 py-1 text-xs font-bold text-brand-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            title="Crear nueva intervención"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Nueva Intervención</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="px-3 py-1 text-xs font-black text-white bg-brand-blue hover:brightness-110 rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            title="Crear nueva tarea en esta intervención"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Tarea</span>
          </button>
        </div>
      </div>

      {/* 1B. DEDICATED CONTRACTOR DISTRIBUTION MATRIX PANEL (COLLAPSIBLE) */}
      {showContractorMatrix && (
        <div className="bg-white rounded-xl border-2 border-brand-blue/30 p-3 shadow-md shrink-0 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-brand-blue">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-900 leading-tight">
                  Distribución Diaria por Empresa / Contratista vs Disponibilidad de Mecánicos
                </h4>
                <p className="text-[11px] text-gray-500 font-medium">
                  Compara la dotación total de mecánicos requeridos con la asignación por empresa (BFB, LOBERAZ, EMET, COMIBOR, etc.)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500">Filtrar empresa:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {(['ALL', 'BFB', 'LOBERAZ', 'EMET', 'COMIBOR', 'TECHINT', 'PENDING'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilterCompany(filterCompany === c ? 'ALL' : c)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                      filterCompany === c
                        ? 'bg-brand-blue text-white border-brand-blue shadow-2xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {c === 'ALL' ? 'Todas' : c === 'PENDING' ? '⚠ Pendiente' : c}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowContractorMatrix(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-1 px-2 font-black text-[10.5px] text-gray-700 min-w-[140px]">Empresa Contratista</th>
                  {days.map((day, idx) => (
                    <th key={idx} className="py-1 px-2 text-center font-black text-[10.5px] text-gray-700 min-w-[85px] border-l border-gray-200">
                      {day.label}
                      <span className="block text-[9px] font-normal text-gray-400">{format(day.date, 'dd/MM')}</span>
                    </th>
                  ))}
                  <th className="py-1 px-2 text-center font-black text-[10.5px] text-gray-700 min-w-[90px] border-l border-gray-200 bg-gray-100/70">
                    Total H-Día
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[11px]">
                {/* Contractor Rows */}
                {(['BFB', 'LOBERAZ', 'EMET', 'COMIBOR', 'TECHINT', 'ANDEMET'] as Company[]).map(comp => {
                  let compTotal = 0;
                  const rowCells = dailyContractorSummary.map(ds => {
                    const count = ds.allCompanies[comp] || 0;
                    compTotal += count;
                    const avail = ds.availableByCompany[comp];
                    const hasAvail = typeof avail === 'number';
                    const isOver = hasAvail && count > avail;

                    return { count, avail, hasAvail, isOver };
                  });

                  if (compTotal === 0 && !rowCells.some(r => r.hasAvail)) return null;

                  return (
                    <tr key={comp} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-1.5 px-2 font-bold text-gray-900 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          comp === 'BFB' ? 'bg-blue-600' :
                          comp === 'LOBERAZ' ? 'bg-amber-500' :
                          comp === 'EMET' ? 'bg-emerald-600' :
                          comp === 'COMIBOR' ? 'bg-purple-600' :
                          comp === 'TECHINT' ? 'bg-cyan-600' :
                          'bg-orange-500'
                        }`} />
                        <span>{comp}</span>
                      </td>
                      {rowCells.map((cell, idx) => (
                        <td key={idx} className="py-1.5 px-2 text-center border-l border-gray-100">
                          {cell.count > 0 ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-black text-[11px] ${
                              cell.isOver 
                                ? 'bg-red-100 text-red-800 border border-red-300' 
                                : comp === 'BFB' ? 'bg-blue-100 text-blue-800'
                                : comp === 'LOBERAZ' ? 'bg-amber-100 text-amber-800'
                                : comp === 'EMET' ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              <span>{cell.count}</span>
                              {cell.hasAvail && (
                                <span className="text-[9px] font-normal text-gray-500">/ {cell.avail}</span>
                              )}
                              {cell.isOver && <span className="text-[9px]">⚠</span>}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      ))}
                      <td className="py-1.5 px-2 text-center font-black border-l border-gray-200 bg-gray-50/50 text-brand-blue">
                        {compTotal}
                      </td>
                    </tr>
                  );
                })}

                {/* Row: Sin Empresa / Pendiente */}
                <tr className="hover:bg-amber-50/30 transition-colors bg-amber-50/20">
                  <td className="py-1.5 px-2 font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Empresa Pendiente</span>
                  </td>
                  {dailyContractorSummary.map((ds, idx) => {
                    const pendingCount = ds.allCompanies['SIN_EMPRESA'] || 0;
                    return (
                      <td key={idx} className="py-1.5 px-2 text-center border-l border-gray-100">
                        {pendingCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-black text-[11px] bg-red-100 text-red-800 border border-red-300">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{pendingCount}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">✓ 0</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-center font-black border-l border-gray-200 bg-gray-50/50 text-amber-800">
                    {dailyContractorSummary.reduce((sum, ds) => sum + (ds.allCompanies['SIN_EMPRESA'] || 0), 0)}
                  </td>
                </tr>

                {/* Summary Row 1: Total Mecánicos (MEH) Requeridos */}
                <tr className="bg-blue-50/60 font-black border-t-2 border-blue-200">
                  <td className="py-1.5 px-2 text-brand-blue uppercase text-[10.5px]">
                    Total Mecánicos Requeridos (MEH)
                  </td>
                  {dailyContractorSummary.map((ds, idx) => {
                    const st = getDaySpecialtyStatus(idx, 'MEH');
                    const availDisplay = st.available === null ? '—' : st.available;
                    return (
                      <td key={idx} className="py-1.5 px-2 text-center border-l border-blue-200">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                          st.isOverloaded 
                            ? 'bg-red-600 text-white shadow-2xs' 
                            : 'bg-white text-brand-blue border border-blue-300'
                        }`}>
                          <span>{ds.totalMeh} / {availDisplay}</span>
                          {st.isOverloaded && <span className="text-[9px]">⚠</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-center border-l border-blue-200 bg-blue-100/50 text-brand-blue text-[12px]">
                    {dailyContractorSummary.reduce((sum, ds) => sum + ds.totalMeh, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. COLLAPSIBLE FILTER ROW (WHEN OPEN) */}
      {isFiltersOpen && (
        <div className="bg-gray-50/90 rounded-lg border border-gray-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Filter className="w-3 h-3 text-brand-orange" />
              Filtros:
            </span>

            {/* Criticidad */}
            <select
              value={filterCriticality}
              onChange={e => setFilterCriticality(e.target.value)}
              className="text-[11px] font-bold border border-gray-300 rounded-md px-2 py-0.5 bg-white outline-none focus:border-brand-blue cursor-pointer"
            >
              <option value="ALL">Criticidad: Todas</option>
              <option value="CRITICAL">⚠ Solo Críticas</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>

            {/* Especialidad */}
            <select
              value={filterSpecialty}
              onChange={e => setFilterSpecialty(e.target.value)}
              className="text-[11px] font-bold border border-gray-300 rounded-md px-2 py-0.5 bg-white outline-none focus:border-brand-blue cursor-pointer"
            >
              <option value="ALL">Especialidad: Todas</option>
              {SPECIALTIES_LIST.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Empresa */}
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="text-[11px] font-bold border border-gray-300 rounded-md px-2 py-0.5 bg-white outline-none focus:border-brand-blue cursor-pointer"
            >
              <option value="ALL">Empresa: Todas</option>
              <option value="BFB">BFB</option>
              <option value="LOBERAZ">LOBERAZ</option>
              <option value="EMET">EMET</option>
              <option value="COMIBOR">COMIBOR</option>
              <option value="TECHINT">TECHINT</option>
              <option value="PENDING">Empresa Pendiente</option>
            </select>

            {/* Estado Asignación */}
            <select
              value={filterAllocationStatus}
              onChange={e => setFilterAllocationStatus(e.target.value)}
              className="text-[11px] font-bold border border-gray-300 rounded-md px-2 py-0.5 bg-white outline-none focus:border-brand-blue cursor-pointer"
            >
              <option value="ALL">Estado: Todos</option>
              <option value="PENDING">Empresas Pendientes</option>
              <option value="COMPLETE">Asignación Completa</option>
              <option value="OVERLOADED">Con Sobrecarga Diaria</option>
            </select>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterCriticality('ALL');
                  setFilterSpecialty('ALL');
                  setFilterCompany('ALL');
                  setFilterAllocationStatus('ALL');
                }}
                className="text-[10px] font-black text-brand-orange hover:underline cursor-pointer ml-1"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <span className="text-[11px] text-gray-500 font-bold">
            Mostrando {displayTasks.length} de {rawFilteredTasks.length} tareas
          </span>
        </div>
      )}

      {/* 2B. ACTIVE FILTER CHIPS STRIP (WHEN FILTERS ARE CLOSED BUT ACTIVE) */}
      {!isFiltersOpen && activeFiltersCount > 0 && (
        <div className="flex items-center gap-1.5 px-1 py-0.5 flex-wrap shrink-0">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Filtros activos:</span>
          {filterCriticality !== 'ALL' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-red-100 text-red-700">
              {filterCriticality === 'CRITICAL' ? '⚠ Crítica' : filterCriticality}
              <button type="button" onClick={() => setFilterCriticality('ALL')} className="hover:opacity-70 cursor-pointer">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {filterSpecialty !== 'ALL' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-blue-100 text-brand-blue">
              {filterSpecialty}
              <button type="button" onClick={() => setFilterSpecialty('ALL')} className="hover:opacity-70 cursor-pointer">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {filterCompany !== 'ALL' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
              {filterCompany}
              <button type="button" onClick={() => setFilterCompany('ALL')} className="hover:opacity-70 cursor-pointer">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {filterAllocationStatus !== 'ALL' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
              {filterAllocationStatus === 'PENDING' ? 'Emp. Pendiente' : filterAllocationStatus}
              <button type="button" onClick={() => setFilterAllocationStatus('ALL')} className="hover:opacity-70 cursor-pointer">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setFilterCriticality('ALL');
              setFilterSpecialty('ALL');
              setFilterCompany('ALL');
              setFilterAllocationStatus('ALL');
            }}
            className="text-[9px] font-bold text-gray-400 hover:text-brand-orange cursor-pointer ml-1 underline"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* 3. MAIN PLANNING TABLE (DOMINATING VIEWPORT HEIGHT) */}
      <div className="planner-table-shell bg-white rounded-xl border border-border-gray shadow-md flex-1 flex flex-col overflow-hidden relative min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="planner-schedule-table w-full border-collapse">
            {/* STICKY TABLE HEADER */}
            <thead className="planner-table-head sticky top-0 z-20 bg-gray-100 shadow-xs">
              <tr className="border-b-2 border-gray-300">
                <th className="px-3 py-1.5 text-left text-[10px] font-black text-gray-600 uppercase tracking-wider border-r border-gray-200 w-[360px] min-w-[320px] max-w-[420px]">
                  Detalle de Tarea y Justificación
                </th>
                <th className="px-1.5 py-1.5 text-center text-[10px] font-black text-gray-600 uppercase tracking-wider border-r border-gray-200 w-[75px] min-w-[65px] max-w-[85px]">
                  Impacto
                </th>
                <th className="px-1.5 py-1.5 text-center text-[10px] font-black text-gray-600 uppercase tracking-wider border-r border-gray-200 w-[95px] min-w-[85px] max-w-[110px]" title="Resumen total de requerimientos del puesto">
                  Recursos
                </th>
                
                {/* DAY COLUMNS */}
                {days.map((day, idx) => {
                  const criticalCount = criticalTasksPerDay[idx] || 0;
                  const isHoveredTarget = dragOverDayIndex === idx;
                  const dragPreview = isHoveredTarget ? getDragCapacityPreview(idx) : null;

                  // Active specialties with load on this day
                  const activeSpecs = (['MEH', 'TUB', 'COB', 'LUB', 'CIV'] as Specialty[]).filter(s => {
                    const st = getDaySpecialtyStatus(idx, s);
                    return st.needed > 0 || (st.available !== null && st.available > 0);
                  });

                  return (
                    <th 
                      key={idx} 
                      onDragOver={e => handleDragOverCell(e, idx)}
                      onDrop={e => handleDropOnCell(e, idx)}
                      className={`px-2 py-1.5 text-center text-[10px] font-black border-l-2 border-r border-gray-200 min-w-[110px] transition-colors ${
                        isHoveredTarget 
                          ? dragPreview?.isOver 
                            ? 'bg-red-100 border-red-400' 
                            : 'bg-emerald-100 border-emerald-400'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-gray-900 font-black text-[11px]">
                          {day.label} · {format(day.date, 'EEE', { locale: es }).toUpperCase()}
                        </span>
                        <span className="text-gray-400 font-bold text-[9px]">
                          {format(day.date, 'dd/MM')}
                        </span>

                        {/* Critical Count badge in Day Header */}
                        {criticalCount > 0 && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.2 rounded-full bg-red-600 text-white shadow-2xs">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {criticalCount} {criticalCount === 1 ? 'crítica' : 'críticas'}
                          </span>
                        )}

                        {/* Multi-specialty daily load in header */}
                        <div className="mt-0.5 flex flex-col gap-0.5 w-full">
                          {activeSpecs.slice(0, 2).map(spec => {
                            const st = getDaySpecialtyStatus(idx, spec);
                            const availDisplay = st.available === null ? '—' : st.available;
                            return (
                              <div 
                                key={spec} 
                                className={`text-[11px] font-bold px-1.5 py-0.5 rounded border flex justify-between items-center leading-tight ${
                                  st.isOverloaded 
                                    ? 'bg-red-100 text-red-800 border-red-300 font-black' 
                                    : 'bg-blue-50 text-brand-blue border-blue-200'
                                }`}
                              >
                                <span className="font-extrabold text-[11.5px]">{spec}</span>
                                <span className="font-bold flex items-center gap-1">
                                  <span>{st.needed} / {availDisplay}</span>
                                  {st.isOverloaded && (
                                    <span className="bg-red-600 text-white font-black px-1 py-0.2 rounded text-[10px] shadow-2xs">
                                      ⚠ -{st.deficit}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody>
              {displayTasks.length === 0 && (
                <tr>
                  <td colSpan={3 + durationDays} className="text-center py-12 text-gray-400">
                    <p className="text-sm font-bold">
                      {selectedParada 
                        ? `No se encontraron tareas en "${selectedParada.title}" con los filtros seleccionados.` 
                        : 'No se encontraron tareas con los filtros actuales.'}
                    </p>
                    <button
                      type="button"
                      onClick={onOpenNewTaskModal}
                      className="mt-2.5 px-3.5 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-black inline-flex items-center gap-1.5 shadow-xs hover:brightness-110 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Tarea
                    </button>
                  </td>
                </tr>
              )}

              {ZONES.map(zone => {
                const zoneTasks = displayTasks.filter(t => t.zone === zone);
                if (zoneTasks.length === 0) return null;

                const responsibles = Object.keys(groupedTasks[zone] || {});

                return (
                  <React.Fragment key={zone}>
                    {/* Zone Header Row */}
                    <tr className="planner-zone-row bg-gray-100/90 border-t-2 border-b border-gray-300">
                      <td colSpan={3 + durationDays} className="px-3 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-brand-blue tracking-wider uppercase">
                            ZONA: {zone}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            ({zoneTasks.length} {zoneTasks.length === 1 ? 'tarea' : 'tareas'})
                          </span>
                        </div>
                      </td>
                    </tr>

                    {responsibles.map(resp => {
                      const respTasks = groupedTasks[zone]![resp] || [];
                      if (respTasks.length === 0) return null;

                      return (
                        <React.Fragment key={resp}>
                          {/* Supervisor Row */}
                          <tr className="planner-supervisor-row bg-gray-50/60 border-b border-gray-200">
                            <td colSpan={3 + durationDays} className="px-5 py-0.5">
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-gray-400" />
                                Supervisor: <strong className="text-gray-700">{resp}</strong>
                              </span>
                            </td>
                          </tr>

                          {/* Task Rows */}
                          {respTasks.map(task => {
                            const isCritical = task.criticality === 'Alta';
                            const isSelected = activeDrawerTask?.id === task.id;

                            return (
                              <tr 
                                key={task.id} 
                                className={`border-b border-gray-200 transition-colors group/row ${
                                  isSelected
                                    ? 'bg-blue-50/70 border-l-4 border-l-brand-blue'
                                    : isCritical 
                                      ? 'bg-red-50/25 hover:bg-red-50/60 border-l-4 border-l-red-500' 
                                      : 'hover:bg-gray-50/90 border-l-4 border-l-transparent'
                                }`}
                              >
                                {/* Column 1: Task Details (Click card to open task drawer) */}
                                <td className="planner-task-cell px-3 py-1.5 border-r border-gray-200 align-middle w-[360px] min-w-[320px] max-w-[420px]">
                                  <div className="flex items-start gap-1.5">
                                    {/* Drag Handle ⠿ */}
                                    <div 
                                      draggable
                                      onDragStart={e => {
                                        e.stopPropagation();
                                        handleDragStart(e, task);
                                      }}
                                      onDragEnd={handleDragEnd}
                                      onClick={e => e.stopPropagation()}
                                      className="mt-0.5 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing transition-colors shrink-0"
                                      title="Arrastrar para mover entre días (⠿)"
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>

                                    {/* Task Info Card (Clickable to open task drawer) */}
                                    <div 
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (!isDraggingRef.current) {
                                          setActiveDrawerTask(task);
                                        }
                                      }}
                                      className="planner-task-summary flex-1 min-w-0 p-1 -m-1 rounded-lg hover:bg-black/5 cursor-pointer transition-colors"
                                      title="Click para ver detalle de la tarea"
                                    >
                                      {/* Primary header line: Badges + 2-line wrapped Title + Direct [✎] Edit button */}
                                      <div className="flex items-start justify-between gap-1.5 min-w-0">
                                        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                                          {isCritical ? (
                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.2 rounded-full bg-red-600 text-white shadow-2xs uppercase tracking-wider shrink-0">
                                              <AlertTriangle className="w-2.5 h-2.5" />
                                              CRÍTICA
                                            </span>
                                          ) : task.criticality === 'Media' ? (
                                            <span className="text-[8px] font-black px-1 py-0.2 rounded uppercase bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                              MEDIA
                                            </span>
                                          ) : (
                                            <span className="text-[8px] font-black px-1 py-0.2 rounded uppercase bg-gray-100 text-gray-600 shrink-0">
                                              BAJA
                                            </span>
                                          )}

                                          {(task.workHours === 12 || Object.values(task.dailyWorkHours || {}).some(h => h === 12)) && (
                                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 inline-flex items-center gap-0.5 shadow-2xs" title="Tarea con jornada extendida de 12 horas">
                                              <Clock className="w-2.5 h-2.5 text-indigo-600" />
                                              12hs
                                            </span>
                                          )}

                                          <span 
                                            className={`text-xs font-black leading-snug line-clamp-2 break-words ${isCritical ? 'text-gray-950 font-black' : 'text-gray-800'}`}
                                            title={task.title}
                                          >
                                            {task.title}
                                          </span>
                                        </div>

                                        {/* Action button: Editar tarea completa [✎] */}
                                        <button 
                                          type="button"
                                          onClick={e => {
                                            e.stopPropagation();
                                            onOpenEditTaskModal(task);
                                          }} 
                                          className={`p-1 rounded transition-all cursor-pointer shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                            isSelected 
                                              ? 'opacity-100 bg-brand-blue text-white shadow-xs' 
                                              : 'opacity-0 group-hover/row:opacity-100 bg-blue-50 text-brand-blue hover:bg-brand-blue hover:text-white border border-blue-200'
                                          }`}
                                          title="Editar tarea completa"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span className="hidden xl:inline text-[9px] font-black">Editar</span>
                                        </button>
                                      </div>

                                      {/* Justification - Truncated to 1 line with full tooltip */}
                                      {task.justification && (
                                        <p 
                                          className="text-[10px] text-gray-500 mt-0.5 leading-tight truncate italic" 
                                          title={task.justification}
                                        >
                                          "{task.justification}"
                                        </p>
                                      )}

                                      {/* Sub-info line: Executor and Delete option */}
                                      <div className="flex items-center justify-between gap-2 mt-0.5 text-[9px]">
                                        <span className="font-bold text-gray-400 uppercase truncate">
                                          Ejecutor: <strong className="text-gray-700">{task.executedBy}</strong>
                                        </span>

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                          <button 
                                            type="button"
                                            onClick={e => {
                                              e.stopPropagation();
                                              setTaskToDelete(task);
                                            }} 
                                            className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                            title="Eliminar tarea"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Column 2: Impacts */}
                                <td className="px-1.5 py-1.5 border-r border-gray-200 text-center align-middle w-[75px] min-w-[65px] max-w-[85px]">
                                  <div className="flex flex-wrap justify-center gap-0.5">
                                    {task.impacts.map(impact => (
                                      <span key={impact} className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-tight shadow-2xs ${
                                        impact === 'HSE' ? 'bg-red-100 text-red-700 border border-red-200' :
                                        impact === 'INO' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                        impact === 'CALIDAD' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                        'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      }`}>
                                        {impact === 'EFICIENCIA' ? 'EFI' : impact}
                                      </span>
                                    ))}
                                  </div>
                                </td>

                                {/* Column 3: Requirements Summary (Compact Total Need) */}
                                <td className="px-1.5 py-1.5 border-r border-gray-200 align-middle text-center w-[95px] min-w-[85px] max-w-[110px]">
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {task.requirements.map(req => (
                                      <span 
                                        key={req.specialty} 
                                        className="text-[10.5px] font-black bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded border border-gray-300 shadow-2xs inline-flex items-center gap-1"
                                      >
                                        <span>{req.specialty}</span>
                                        {!EXTERNAL_SPECIALTIES.includes(req.specialty) && (
                                          <span className="text-brand-blue">{req.count}</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </td>

                                {/* Day Columns: Interactive Cells with Resource Cards & Day Assignment */}
                                {days.map((day, dayIdx) => {
                                  const dayReqs = getTaskRequirementsForDay(task, dayIdx);
                                  const isOccupied = dayReqs.length > 0;
                                  const hasOverload = isOccupied && dayReqs.some(req => 
                                    getDaySpecialtyStatus(dayIdx, req.specialty).isOverloaded
                                  );
                                  const isHoveredTarget = dragOverDayIndex === dayIdx;

                                  return (
                                    <td 
                                      key={dayIdx} 
                                      onDragOver={e => handleDragOverCell(e, dayIdx)}
                                      onDrop={e => handleDropOnCell(e, dayIdx)}
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (!isOccupied) {
                                          handleOpenDayAssignment(task, dayIdx);
                                        }
                                      }}
                                      className={`p-1 border-l-2 border-r border-gray-200 relative group/cell min-h-[48px] align-middle transition-colors ${
                                        isHoveredTarget 
                                          ? 'bg-blue-100/60' 
                                          : isOccupied 
                                          ? isCritical 
                                            ? 'bg-red-50/40' 
                                            : 'bg-blue-50/20' 
                                          : 'hover:bg-blue-50/50 cursor-pointer'
                                      }`}
                                      title={!isOccupied ? `Asignar recursos a ${day.label} (${format(day.date, 'dd/MM')})` : undefined}
                                    >
                                      {isOccupied && (
                                        <div 
                                          onClick={e => e.stopPropagation()}
                                          className={`h-full w-full rounded-lg p-1.5 relative flex flex-col justify-center border transition-all shadow-2xs ${
                                            hasOverload 
                                              ? 'bg-red-100 border-red-300 text-red-800' 
                                              : isCritical 
                                              ? 'bg-red-50 border-red-200 text-gray-900' 
                                              : 'bg-white border-blue-200 text-gray-800'
                                          }`}
                                        >
                                          {(task.dailyWorkHours?.[dayIdx] ?? task.workHours ?? 9) === 12 && (
                                            <div className="absolute top-0.5 right-1 pointer-events-none">
                                              <span className="text-[7.5px] font-black text-indigo-800 bg-indigo-100/90 border border-indigo-200 px-1 py-0.1 rounded shadow-2xs">
                                                12h
                                              </span>
                                            </div>
                                          )}

                                          {/* Resource & Contractor Allocation Cards */}
                                          <div className="flex flex-col gap-1">
                                            {dayReqs.map((req, rIdx) => {
                                              const isExternal = EXTERNAL_SPECIALTIES.includes(req.specialty);
                                              const activeAllocs = req.companyAllocations?.filter(a => a.count > 0) || [];
                                              const assignedCount = activeAllocs.reduce((s, a) => s + a.count, 0);
                                              const pending = req.count - assignedCount;

                                              return (
                                                <button
                                                  key={req.specialty}
                                                  type="button"
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    handleOpenDayAssignment(task, dayIdx);
                                                  }}
                                                  className={`w-full text-left px-1.5 py-1 rounded bg-gray-50/90 hover:bg-white border transition-all cursor-pointer group/badge ${
                                                    rIdx > 0 ? 'border-gray-200' : 'border-gray-200'
                                                  } hover:border-brand-blue hover:shadow-xs`}
                                                  title="Click para editar recursos y contratistas de este día"
                                                >
                                                  {/* Mode 1: Contractors Focus */}
                                                  {boardDisplayMode === 'contractors' ? (
                                                    <div className="space-y-0.5">
                                                      <div className="flex items-center justify-between text-[11px] font-black text-gray-800">
                                                        <span>{req.specialty}</span>
                                                        <span className="text-brand-blue">{isExternal ? '✓' : req.count}</span>
                                                      </div>
                                                      <div className="flex flex-wrap gap-0.5">
                                                        {activeAllocs.map(a => (
                                                          <span
                                                            key={a.company}
                                                            className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                                              a.company === 'BFB' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                                                              a.company === 'LOBERAZ' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                                                              a.company === 'EMET' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                                              a.company === 'COMIBOR' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                                                              'bg-cyan-100 text-cyan-900 border-cyan-300'
                                                            }`}
                                                          >
                                                            {a.company} {a.count}
                                                          </span>
                                                        ))}
                                                        {pending > 0 && (
                                                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-800 border border-red-300">
                                                            ⚠ {pending} pend.
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : boardDisplayMode === 'specialties' ? (
                                                    /* Mode 2: Specialties Only */
                                                    <div className="flex items-center justify-between leading-tight py-0.5">
                                                      <span className="text-[13px] font-black text-gray-900 tracking-tight">
                                                        {req.specialty}
                                                      </span>
                                                      <span className="text-[14px] font-black text-brand-blue">
                                                        {isExternal ? '✓' : req.count}
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    /* Mode 3: Combined (Default) */
                                                    <>
                                                      {/* Line 1: Specialty & Quantity */}
                                                      <div className="flex items-center justify-between leading-tight">
                                                        <span className="text-[12px] font-bold text-gray-900 tracking-tight">
                                                         {req.specialty}
                                                        </span>
                                                        <span className="text-[13px] font-black text-brand-blue">
                                                         {isExternal ? '✓' : req.count}
                                                        </span>
                                                      </div>

                                                      {/* Line 2: Company Distribution badges */}
                                                      <div className="mt-0.5 flex flex-wrap gap-0.5 items-center">
                                                        {activeAllocs.length > 0 ? (
                                                          activeAllocs.map(a => (
                                                            <span
                                                              key={a.company}
                                                              className={`text-[9px] font-black px-1 py-0.2 rounded border ${
                                                                a.company === 'BFB' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                                                a.company === 'LOBERAZ' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                                                a.company === 'EMET' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                                                a.company === 'COMIBOR' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                                                'bg-cyan-50 text-cyan-800 border-cyan-200'
                                                              }`}
                                                            >
                                                              {a.company} {a.count}
                                                            </span>
                                                          ))
                                                        ) : (
                                                          <span className="text-[9px] font-bold text-red-700 bg-red-50 px-1 py-0.2 rounded border border-red-200">
                                                            Empresa pendiente
                                                          </span>
                                                        )}
                                                        {pending > 0 && activeAllocs.length > 0 && (
                                                          <span className="text-[8.5px] font-black text-amber-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                                            +{pending} pend.
                                                          </span>
                                                        )}
                                                      </div>
                                                    </>
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Empty cell action: Discrete '+' button on hover across the entire cell */}
                                      {!isOccupied && (
                                        <div className="h-full w-full min-h-[44px] flex items-center justify-center p-0.5 pointer-events-none">
                                          <div className="opacity-0 group-hover/cell:opacity-100 transition-all px-2.5 py-1 rounded-md bg-white text-brand-blue border border-dashed border-blue-400 group-hover/cell:border-brand-blue shadow-2xs flex items-center gap-1 text-[11px] font-bold">
                                            <Plus className="w-3.5 h-3.5 text-brand-orange" />
                                            <span className="text-[10.5px]">Asignar</span>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* 4. BALANCE DIARIO DE DOTACIÓN (ULTRACOMPACTO MEH) */}
            <tfoot className="bg-gray-100 border-t-2 border-gray-300 sticky bottom-0 z-10 shadow-xs">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right border-r border-gray-200 align-middle bg-gray-100">
                  <span className="font-black text-gray-900 uppercase tracking-wider text-[11px]">
                    BALANCE MEH
                  </span>
                </td>
                {days.map((day, dayIdx) => {
                  const dayBal = dailyBalances[dayIdx];
                  if (!dayBal) {
                    return (
                      <td key={dayIdx} className="px-2 py-1.5 text-center border-l-2 border-r border-gray-200 align-middle text-gray-400 font-bold text-xs">
                        -
                      </td>
                    );
                  }

                  const { meh } = dayBal;
                  const activeCompanies = meh.companies.filter(c => c.company !== 'PENDING' && (c.assigned > 0 || (c.available !== null && c.available > 0)));

                  const getAbbr = (cName: Company) => {
                    if (cName === 'LOBERAZ') return 'LOB';
                    if (cName === 'COMIBOR') return 'COM';
                    if (cName === 'TECHINT') return 'TECH';
                    if (cName === 'ANDEMET') return 'AND';
                    return cName;
                  };

                  const getCompanyTitle = (c: typeof meh.companies[0]) => {
                    const compFullName = c.company;
                    if (c.available === null) {
                      return `${compFullName} · Mecánicos\nAsignados a tareas: ${c.assigned}\nDisponibilidad: pendiente de definición`;
                    }
                    if (c.assigned > c.available) {
                      return `${compFullName} · Mecánicos\nAsignados a tareas: ${c.assigned}\nDisponibles: ${c.available}\nSobrecarga: ${c.gap}`;
                    }
                    if (c.assigned < c.available) {
                      return `${compFullName} · Mecánicos\nAsignados a tareas: ${c.assigned}\nDisponibles: ${c.available}\nCapacidad libre: ${c.available - c.assigned}`;
                    }
                    return `${compFullName} · Mecánicos\nAsignados a tareas: ${c.assigned}\nDisponibles: ${c.available}\nUtilización completa`;
                  };

                  const tooltipLines = [
                    `DISTRIBUCIÓN MEH · ${day.label} (${format(day.date, 'dd/MM')})`,
                    `----------------------------------------`,
                    `MEH Total: ${meh.assigned} asignados / ${meh.available !== null ? `${meh.available} disponibles` : '— (disponibilidad pendiente)'}${meh.capacityStatus === 'overloaded' ? ` [Sobrecarga: +${meh.capacityGap}]` : ''}`,
                    ``,
                    `DISPONIBILIDAD Y ASIGNACIÓN POR EMPRESA:`,
                    ...(activeCompanies.length > 0 
                      ? activeCompanies.map(c => {
                          const fullName = c.company;
                          if (c.available === null) {
                            return `• ${fullName}: ${c.assigned} asignados / disp. pendiente de definición`;
                          }
                          if (c.assigned > c.available) {
                            return `• ${fullName}: ${c.assigned} asignados / ${c.available} disp. (Sobrecarga: +${c.gap})`;
                          }
                          if (c.assigned < c.available) {
                            return `• ${fullName}: ${c.assigned} asignados / ${c.available} disp. (Capacidad libre: ${c.available - c.assigned})`;
                          }
                          return `• ${fullName}: ${c.assigned} asignados / ${c.available} disp. (Utilización completa)`;
                        })
                      : ['• Sin asignaciones a empresas activas en este día']),
                    meh.pendingCompany > 0 ? `\n• RECURSOS SIN EMPRESA: ${meh.pendingCompany} mecánicos requeridos sin contratista asignado` : '',
                    meh.distributed > meh.assigned ? `\n• SOBREASIGNACIÓN EMPRESARIAL: +${meh.distributed - meh.assigned} mecánicos asignados por encima de los requeridos` : ''
                  ].filter(Boolean).join('\n');

                  return (
                    <td 
                      key={dayIdx} 
                      className="px-2 py-1 text-left border-l-2 border-r border-gray-200 align-middle bg-white hover:bg-blue-50/40 transition-colors"
                      title={tooltipLines}
                    >
                      <div 
                        className="flex flex-col justify-center gap-0.5 cursor-pointer select-none py-0.5"
                        onClick={() => setSelectedMehBalancePopover(meh)}
                      >
                        {/* Línea 1: Capacidad MEH Total */}
                        <div className="flex items-center gap-1.5 leading-tight">
                          <span className="font-extrabold text-gray-900 text-[11px]">MEH</span>
                          <span className="font-bold text-gray-800 text-[11px]">
                            {meh.assigned} / {meh.available !== null ? meh.available : '—'}
                          </span>
                          {meh.capacityStatus === 'overloaded' ? (
                            <span className="text-red-700 font-black text-[9.5px] bg-red-100 px-1 py-0.2 rounded leading-none shadow-2xs">
                              ⚠ +{meh.capacityGap}
                            </span>
                          ) : (meh.available !== null && meh.assigned === meh.available && meh.available > 0) ? (
                            <span className="text-emerald-700 font-black text-[11px] leading-none" title="Capacidad cubierta exactamente">
                              ✓
                            </span>
                          ) : null}
                        </div>

                        {/* Línea 2: Asignado / Disponible por Empresa */}
                        <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5 text-[9.5px] font-bold text-gray-600 leading-tight">
                          {activeCompanies.length === 0 && meh.assigned === 0 ? (
                            <span className="text-gray-400 font-normal text-[9px]">-</span>
                          ) : (
                            <>
                              {activeCompanies.map((c, i) => {
                                const availDisplay = c.available !== null ? c.available : '—';
                                const isOver = c.status === 'overloaded';
                                const isComplete = c.status === 'complete';
                                
                                return (
                                  <span key={c.company} className="inline-flex items-center">
                                    <span 
                                      className={`inline-flex items-center gap-0.5 ${
                                        isOver
                                          ? 'text-red-700 font-extrabold bg-red-50/80 px-1 rounded border border-red-200'
                                          : isComplete
                                          ? 'text-emerald-700 font-bold'
                                          : c.available === null
                                          ? 'text-gray-700 font-medium'
                                          : c.company === 'BFB' ? 'text-blue-700' :
                                            c.company === 'LOBERAZ' ? 'text-amber-700' :
                                            c.company === 'EMET' ? 'text-emerald-700' :
                                            c.company === 'COMIBOR' ? 'text-purple-700' :
                                            'text-cyan-700'
                                      }`}
                                      title={getCompanyTitle(c)}
                                    >
                                      <span>{getAbbr(c.company as Company)} {c.assigned}/{availDisplay}</span>
                                      {isOver && <span className="text-[9px] font-black text-red-700">⚠+{c.gap}</span>}
                                      {isComplete && <span className="text-[10px] font-black text-emerald-600">✓</span>}
                                    </span>
                                    {(i < activeCompanies.length - 1 || meh.pendingCompany > 0 || meh.distributed > meh.assigned) && (
                                      <span className="text-gray-300 ml-1">·</span>
                                    )}
                                  </span>
                                );
                              })}

                              {/* Recursos de tareas sin empresa definida (? X) */}
                              {meh.pendingCompany > 0 && (
                                <span 
                                  className="inline-flex items-center text-amber-800 font-black bg-amber-50 px-1 rounded border border-amber-200"
                                  title={`${meh.pendingCompany} mecánicos requeridos por tareas aún no tienen empresa asignada`}
                                >
                                  ? {meh.pendingCompany}
                                </span>
                              )}

                              {/* Advertencia inline si hay sobreasignación empresarial */}
                              {meh.distributed > meh.assigned && (
                                <span 
                                  className="inline-flex items-center text-purple-800 font-black bg-purple-50 px-1 rounded border border-purple-200"
                                  title={`Inconsistencia: +${meh.distributed - meh.assigned} mecánicos asignados por encima de los requeridos`}
                                >
                                  ⚠ +{meh.distributed - meh.assigned}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 5. BOTTOM ACTION CONTROLS (COMPACT) */}
        <div className="px-4 py-1.5 bg-gray-50 border-t border-border-gray flex flex-wrap justify-between items-center shrink-0 gap-2">
          <div className="flex items-center gap-3 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600" /> Crítica
            </span>
            <span className="flex items-center gap-1">
              <GripVertical className="w-2.5 h-2.5 text-gray-400" /> Arrastrar (⠿)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onAutoOptimize}
              className="bg-white border border-border-gray text-gray-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Optimizar cronograma protegiendo tareas críticas y respetando disponibilidad del hito"
            >
              <Zap className="w-3 h-3 text-brand-orange fill-brand-orange" />
              <span>OPTIMIZAR AUTO.</span>
            </button>
            <button 
              type="button"
              onClick={onOpenNewTaskModal}
              className="bg-brand-blue text-white px-3.5 py-1 rounded-lg text-xs font-black shadow-xs hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>AGREGAR TAREA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Side Drawer for Quick Task Inspection & Edits */}
      <TaskDrawer
        task={activeDrawerTask}
        selectedParada={selectedParada}
        planningStartDate={planningStartDate}
        onClose={() => setActiveDrawerTask(null)}
        onUpdateTask={updated => {
          onUpdateTask(updated);
          setActiveDrawerTask(updated);
        }}
        onOpenFullEdit={task => onOpenEditTaskModal(task)}
        onDeleteTask={taskId => {
          const t = allTasks.find(x => x.id === taskId) || activeDrawerTask;
          if (t) {
            setTaskToDelete(t);
          }
        }}
      />

      {/* Direct Resource Popover if clicked in cell */}
      {quickPopoverReq && (
        <QuickResourcePopover
          requirement={quickPopoverReq.req}
          taskTitle={quickPopoverReq.task.title}
          onSave={handleSaveQuickPopover}
          onClose={() => setQuickPopoverReq(null)}
        />
      )}

      {/* Per-Day Independent Resource & Contractor Assignment Modal */}
      {dayAssignmentState && (
        <DayResourceAssignmentModal
          isOpen={!!dayAssignmentState}
          task={dayAssignmentState.task}
          dayIndex={dayAssignmentState.dayIndex}
          dayLabel={days[dayAssignmentState.dayIndex]?.label || `Día ${dayAssignmentState.dayIndex + 1}`}
          dayDateFormatted={days[dayAssignmentState.dayIndex] ? format(days[dayAssignmentState.dayIndex].date, 'dd/MM/yyyy') : ''}
          initialRequirements={getTaskRequirementsForDay(dayAssignmentState.task, dayAssignmentState.dayIndex)}
          prevDayRequirements={dayAssignmentState.dayIndex > 0 ? getTaskRequirementsForDay(dayAssignmentState.task, dayAssignmentState.dayIndex - 1) : undefined}
          onSave={(newReqs, workHours) => {
            handleSaveDayAssignment(dayAssignmentState.task.id, dayAssignmentState.dayIndex, newReqs, workHours);
            setDayAssignmentState(null);
          }}
          onClose={() => setDayAssignmentState(null)}
        />
      )}

      {/* Mandatory Delete Task Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!taskToDelete}
        task={taskToDelete}
        selectedParada={selectedParada}
        planningStartDate={planningStartDate}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleConfirmDeleteTask}
      />

      {/* A3 Landscape PDF Export Modal & Engine */}
      {isExportModalOpen && (
        <ExportPdfModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          parada={selectedParada}
          allTasks={allTasks}
          filteredTasks={displayTasks}
          planningStartDate={format(planningStartDate, 'yyyy-MM-dd')}
          projectInfo={projectInfo}
        />
      )}

      {/* Discreet Feedback Toast */}
      {deleteToastMessage && (
        <div className="fixed bottom-6 right-6 z-70 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-gray-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span>{deleteToastMessage}</span>
          <button 
            type="button" 
            onClick={() => setDeleteToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Daily MEH Distribution Detail Popover Modal */}
      {selectedMehBalancePopover && (
        <DailyMehDistributionPopover
          isOpen={!!selectedMehBalancePopover}
          onClose={() => setSelectedMehBalancePopover(null)}
          balance={selectedMehBalancePopover}
          onFilterPendingTasks={() => {
            setFilterAllocationStatus('PENDING');
            setIsFiltersOpen(true);
          }}
          onOpenTaskEdit={task => onOpenEditTaskModal(task)}
          allTasks={allTasks}
        />
      )}
    </div>
  );
};
