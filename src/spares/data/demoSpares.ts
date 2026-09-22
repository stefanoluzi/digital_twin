import { OPERATIONAL_PLANT_AREAS } from '../../config/areas'
import type { CriticalSparesData, PhysicalSpareUnit, SpareHistoryEvent, SpareType, SpareUnitStatus } from '../types'

const now = new Date()
const dateAgo = (days: number) => { const date = new Date(now); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10) }
const isoAgo = (days: number) => `${dateAgo(days)}T09:30:00.000Z`

const spare = (value: Omit<SpareType, 'createdAt' | 'updatedAt' | 'description' | 'drawingNumber' | 'comments'> & Partial<Pick<SpareType, 'description' | 'drawingNumber' | 'comments'>>): SpareType => ({ description: '', drawingNumber: '', comments: 'Dato ficticio para demostración.', createdAt: isoAgo(120), updatedAt: isoAgo(2), ...value })
const unit = (id: string, spareTypeId: string, status: SpareUnitStatus, days: number, extra: Partial<PhysicalSpareUnit> = {}): PhysicalSpareUnit => ({ id, spareTypeId, status, statusSince: dateAgo(days), comment: 'Registro demo', location: '', ...extra })

export function createDemoSparesData(): CriticalSparesData {
  const spareTypes: SpareType[] = [
    spare({ id: 'sp-red-transfer', sapNumber: 'SAP-DEMO-1001', name: 'Reductor accionamiento Transferidores', description: 'Reductor principal compatible con transferidores 4, 5 y 6.', categoryId: 'reductor', area: 'LCO', compatibleEquipmentIds: ['eq-transfer-4', 'eq-transfer-5', 'eq-transfer-6'], drawingNumber: 'PL-DEMO-RED-01' }),
    spare({ id: 'sp-cil-piercer', sapNumber: 'SAP-DEMO-1002', name: 'Cilindro hidráulico centrador Piercer', categoryId: 'cilindro-hidraulico', area: 'LP', compatibleEquipmentIds: ['eq-piercer'], drawingNumber: 'PL-DEMO-CIL-08' }),
    spare({ id: 'sp-bomba-hg', sapNumber: 'SAP-DEMO-1003', name: 'Bomba central hidráulica HG', categoryId: 'bomba', area: 'HG', compatibleEquipmentIds: ['eq-central-hg'] }),
    spare({ id: 'sp-acople-lco', sapNumber: 'SAP-DEMO-1004', name: 'Acoplamiento dentado jaula LCO', categoryId: 'acoplamiento', area: 'LCO', compatibleEquipmentIds: ['eq-jaulas-lco'] }),
    spare({ id: 'sp-rod-penf', sapNumber: 'SAP-DEMO-1005', name: 'Rodamiento especial mesa PENF', categoryId: 'rodamiento', area: 'PENF', compatibleEquipmentIds: ['eq-mesa-penf'] }),
    spare({ id: 'sp-gato-sha', sapNumber: 'SAP-DEMO-1006', name: 'Gato mecánico Sierra de Haces', categoryId: 'gato-mecanico', area: 'SHA', compatibleEquipmentIds: ['eq-sierra-haces'] }),
  ]
  const units = [
    unit('LC1C-RED-0001', 'sp-red-transfer', 'INSTALLED', 330, { installedEquipmentId: 'eq-transfer-6', installationDate: dateAgo(330) }),
    unit('LC1C-RED-0002', 'sp-red-transfer', 'IN_REPAIR', 73, { sapNotice: '400123-DEMO', repairStartDate: dateAgo(73) }),
    unit('LC1C-RED-0003', 'sp-red-transfer', 'WAREHOUSE', 142, { location: 'Almacén central · posición DEMO A-14' }),
    unit('LC1C-CIL-0001', 'sp-cil-piercer', 'INSTALLED', 180, { installedEquipmentId: 'eq-piercer', installationDate: dateAgo(180) }),
    unit('LC1C-CIL-0002', 'sp-cil-piercer', 'ON_ORDER', 45, { solp: '12345-DEMO', eta: dateAgo(5) }),
    unit('LC1C-BOM-0001', 'sp-bomba-hg', 'IN_REPAIR', 84, { sapNotice: '400987-DEMO', repairStartDate: dateAgo(84) }),
    unit('LC1C-ACO-0001', 'sp-acople-lco', 'MACHINE_SIDE', 28, { location: 'Estantería norte junto a jaula J4' }),
    unit('LC1C-ROD-0001', 'sp-rod-penf', 'WAREHOUSE', 12, { location: 'Almacén de rodamientos · DEMO R-02' }),
    unit('LC1C-GAT-0001', 'sp-gato-sha', 'ON_ORDER', 21, { solp: '88991-DEMO', purchaseOrder: '450-DEMO', eta: dateAgo(-18) }),
  ]
  const history: SpareHistoryEvent[] = units.map((item, index) => ({ id: `hist-demo-${index + 1}`, unitId: item.id, spareTypeId: item.spareTypeId, timestamp: `${item.statusSince}T09:30:00.000Z`, user: 'Administrador Demo', nextStatus: item.status, equipmentId: item.installedEquipmentId, comment: item.comment, snapshot: { ...item } }))
  return {
    schemaVersion: 2, spareTypes, units, history,
    config: {
      areas: OPERATIONAL_PLANT_AREAS.map((area) => ({ id: area.code, code: area.code, name: area.name, responsibleGmbId: ['LCO', 'PENF', 'SHA'].includes(area.code) ? 'gmb-mecanica' : ['LP', 'HG'].includes(area.code) ? 'gmb-hidraulica' : undefined })),
      categories: [
        ['cilindro-hidraulico', 'Cilindro hidráulico'], ['reductor', 'Reductor'], ['bomba', 'Bomba'], ['acoplamiento', 'Acoplamiento'], ['rodamiento', 'Rodamiento'], ['conjunto', 'Conjunto'], ['gato-mecanico', 'Gato mecánico'], ['conjunto-mecanico', 'Conjunto mecánico'], ['valvula-hidraulica', 'Válvula hidráulica'],
      ].map(([id, name]) => ({ id, name })),
      equipment: [
        { id: 'eq-transfer-4', area: 'LCO', name: 'Transferidor 4' }, { id: 'eq-transfer-5', area: 'LCO', name: 'Transferidor 5' }, { id: 'eq-transfer-6', area: 'LCO', name: 'Transferidor 6' }, { id: 'eq-jaulas-lco', area: 'LCO', name: 'Jaulas LCO' }, { id: 'eq-piercer', area: 'LP', name: 'Piercer' }, { id: 'eq-central-hg', area: 'HG', name: 'Central hidráulica HG' }, { id: 'eq-mesa-penf', area: 'PENF', name: 'Mesa de enfriamiento' }, { id: 'eq-sierra-haces', area: 'SHA', name: 'Sierra de Haces' },
      ],
      responsibles: [{ id: 'gmb-mecanica', name: 'Juan Pérez DEMO', active: true }, { id: 'gmb-hidraulica', name: 'Martín Gómez DEMO', active: true }],
      users: [{ id: 'admin-demo', name: 'Administrador Demo', role: 'ADMIN' }, { id: 'supervisor-demo', name: 'Supervisor Demo', role: 'SUPERVISOR' }],
      currentUserId: 'admin-demo',
    },
  }
}
