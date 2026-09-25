export const REPAIR_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DELIVERED', 'CANCELLED'] as const
export type RepairStatus = typeof REPAIR_STATUSES[number]
export const BLOCK_OWNERS = ['PLANT', 'WORKSHOP', 'PURCHASING', 'ENGINEERING', 'EXTERNAL', 'OTHER'] as const
export type BlockOwner = typeof BLOCK_OWNERS[number]
export const STATUS_LABELS: Record<RepairStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', BLOCKED: 'Bloqueada', DELIVERED: 'Entregada', CANCELLED: 'Cancelada' }
export const OWNER_LABELS: Record<BlockOwner, string> = { PLANT: 'Planta', WORKSHOP: 'Taller', PURCHASING: 'Compras / Exiros', ENGINEERING: 'Ingeniería', EXTERNAL: 'Externo', OTHER: 'Otro' }
export const DEFAULT_BLOCK_CATEGORIES = [
  { owner: 'PLANT', name: 'Equipo no enviado al taller' }, { owner: 'PLANT', name: 'Repuesto no enviado' }, { owner: 'PLANT', name: 'Falta definición interna' },
  { owner: 'WORKSHOP', name: 'Falta recursos' }, { owner: 'WORKSHOP', name: 'Falta capacidad' }, { owner: 'WORKSHOP', name: 'Problema técnico' }, { owner: 'WORKSHOP', name: 'Espera interna de material' },
  { owner: 'PURCHASING', name: 'Repuesto comprado pendiente' }, { owner: 'PURCHASING', name: 'Exiros/proveedor pendiente' },
  { owner: 'ENGINEERING', name: 'Falta definición técnica' }, { owner: 'ENGINEERING', name: 'Falta plano/especificación' }, { owner: 'EXTERNAL', name: 'Dependencia externa' }, { owner: 'OTHER', name: 'Otro' },
] as { owner: BlockOwner; name: string }[]
export interface RepairEquipment { id: string; area: string; name: string; repairProfile: { equipmentId: string; idrep: string; sector: string; trade: string; active: boolean } | null }
export interface RepairBlock { id: string; startedAt: string; resolvedAt: string | null; durationDays: number | null; owner: BlockOwner; category: string; description: string; comment: string; actor: string }
export interface RepairItem { id: string; ordinal: number; status: RepairStatus; startedAt: string | null; sentAt: string | null; commitments: { id: string; date: string; reason: string; sequence: number; recordedAt: string; actor: string }[]; blocks: RepairBlock[]; delivery: { deliveredAt: string; comment: string; actor: string } | null }
export interface RepairRequest { id: string; equipmentId: string; quantity: number; targetMonth: string; requiredDate: string | null; criticality: 'NORMAL' | 'HIGH' | 'CRITICAL'; criticalReason: string; fixedDeadline: boolean; criticalDueDate: string | null; responsibleId: string | null; workshop: string; notes: string; createdAt: string; updatedAt: string; createdBy: string; equipment: RepairEquipment; responsible: { id: string; name: string } | null; items: RepairItem[] }
export interface RepairEvent { id: number; requestId: string; action: string; actor: string; recordedAt: string; revision: number; detail: Record<string, unknown>; snapshot: RepairRequest }
export interface RepairState { revision: number; config: { warningDays: number; blockCategories: { owner: BlockOwner; name: string }[]; workshops: string[] }; equipment: RepairEquipment[]; areas: { id: string; code: string; name: string }[]; responsibles: { id: string; name: string; active: boolean }[]; users: { id: string; name: string; role: string }[]; requests: RepairRequest[] }
