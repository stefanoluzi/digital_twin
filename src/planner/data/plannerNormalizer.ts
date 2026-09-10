import { DEFAULT_PROJECT, INITIAL_PARADAS, INITIAL_TASKS } from '../constants'
import type { ParadaEvent, PlannerModuleData, ProjectInfo, SpecialtyRequirement, Task } from '../types'

export function createDefaultPlannerData(): PlannerModuleData {
  return structuredClone({ projectInfo: DEFAULT_PROJECT, tasks: INITIAL_TASKS, paradas: INITIAL_PARADAS })
}

export function normalizePlannerData(value: unknown, fallbackToTemplate = true): PlannerModuleData {
  const source = value && typeof value === 'object' ? value as Partial<PlannerModuleData> : {}
  const defaults = createDefaultPlannerData()
  const paradas = Array.isArray(source.paradas)
    ? source.paradas.flatMap(normalizeParada)
    : fallbackToTemplate ? defaults.paradas : []
  const defaultParadaId = paradas[0]?.id ?? 'parada-rex-1'
  const tasks = Array.isArray(source.tasks)
    ? source.tasks.flatMap((task) => normalizeTask(task, defaultParadaId))
    : fallbackToTemplate ? defaults.tasks : []
  return {
    projectInfo: normalizeProject(source.projectInfo, defaults.projectInfo),
    paradas: uniqueById(paradas),
    tasks: uniqueById(tasks),
  }
}

function normalizeProject(value: unknown, fallback: ProjectInfo): ProjectInfo {
  if (!value || typeof value !== 'object') return structuredClone(fallback)
  const raw = value as Partial<ProjectInfo>
  return {
    id: text(raw.id) || fallback.id,
    name: text(raw.name) || fallback.name,
    line: text(raw.line) || fallback.line,
    startDate: dateText(raw.startDate) || fallback.startDate,
    createdAt: text(raw.createdAt) || fallback.createdAt,
  }
}

function normalizeParada(value: unknown): ParadaEvent[] {
  if (!value || typeof value !== 'object') return []
  const raw = value as Partial<ParadaEvent>
  const id = text(raw.id)
  if (!id) return []
  return [{
    id,
    title: text(raw.title) || 'Intervención sin nombre',
    ...(dateText(raw.startDate) ? { startDate: dateText(raw.startDate) } : {}),
    ...(dateText(raw.endDate) ? { endDate: dateText(raw.endDate) } : {}),
    startDayOffset: nonNegative(raw.startDayOffset, 0),
    durationDays: positive(raw.durationDays, 1),
    specialtyAvailability: Array.isArray(raw.specialtyAvailability) ? structuredClone(raw.specialtyAvailability) : [],
    resourceAvailability: Array.isArray(raw.resourceAvailability) ? structuredClone(raw.resourceAvailability) : [],
  }]
}

function normalizeTask(value: unknown, defaultParadaId: string): Task[] {
  if (!value || typeof value !== 'object') return []
  const raw = value as Partial<Task>
  const id = text(raw.id)
  if (!id) return []
  const dailyRequirements: Record<number, SpecialtyRequirement[]> = {}
  if (raw.dailyRequirements && typeof raw.dailyRequirements === 'object') {
    Object.entries(raw.dailyRequirements).forEach(([day, requirements]) => {
      if (Array.isArray(requirements) && Number.isInteger(Number(day))) dailyRequirements[Number(day)] = structuredClone(requirements)
    })
  }
  return [{
    id,
    title: text(raw.title) || 'Tarea sin nombre',
    paradaId: text(raw.paradaId) || defaultParadaId,
    ...(dateText(raw.startDate) ? { startDate: dateText(raw.startDate) } : {}),
    justification: text(raw.justification),
    zone: raw.zone ?? 'GENERAL',
    executedBy: raw.executedBy ?? 'GMB',
    responsable: text(raw.responsable),
    impacts: Array.isArray(raw.impacts) ? structuredClone(raw.impacts) : [],
    criticality: raw.criticality === 'Alta' || raw.criticality === 'Media' || raw.criticality === 'Baja' ? raw.criticality : 'Media',
    startDayOffset: nonNegative(raw.startDayOffset, 0),
    durationDays: positive(raw.durationDays, 1),
    requirements: Array.isArray(raw.requirements) ? structuredClone(raw.requirements) : [],
    dailyRequirements,
    ...(typeof raw.workHours === 'number' ? { workHours: raw.workHours } : {}),
    ...(raw.dailyWorkHours && typeof raw.dailyWorkHours === 'object' ? { dailyWorkHours: structuredClone(raw.dailyWorkHours) } : {}),
  }]
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function dateText(value: unknown) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value : '' }
function nonNegative(value: unknown, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback }
function positive(value: unknown, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback }
