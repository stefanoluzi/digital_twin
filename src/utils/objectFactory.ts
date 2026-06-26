import type { AssetType, IndustrialAsset } from '../types/plant'

const definitions: Record<AssetType, { prefix: string; name: string; size: IndustrialAsset['size']; color: string }> = {
  gearbox: { prefix: 'GRB', name: 'Caja reductora', size: { width: 2.4, height: 1.5, depth: 1.4 }, color: '#6b7b8c' },
  motor: { prefix: 'MTR', name: 'Motor', size: { width: 2.4, height: 1.4, depth: 1.4 }, color: '#287c8e' },
  roller: { prefix: 'ROL', name: 'Rodillo', size: { width: 2.5, height: 0.55, depth: 0.55 }, color: '#9ca3aa' },
  roller_table: { prefix: 'RTB', name: 'Mesa de rodillos', size: { width: 6, height: 1.1, depth: 2.5 }, color: '#b27a32' },
  pump: { prefix: 'PMP', name: 'Bomba', size: { width: 1.8, height: 1.2, depth: 1 }, color: '#347d70' },
  tank: { prefix: 'TNK', name: 'Tanque', size: { width: 2, height: 3, depth: 2 }, color: '#7b8794' },
  conveyor: { prefix: 'CNV', name: 'Transportador', size: { width: 6, height: 0.7, depth: 1.5 }, color: '#805c45' },
  generic_box: { prefix: 'BOX', name: 'Caja generica', size: { width: 2, height: 1.5, depth: 2 }, color: '#707b86' },
}

export function createIndustrialObject(type: AssetType, existing: IndustrialAsset[]): IndustrialAsset {
  const def = definitions[type]
  const used = new Set(existing.map((item) => item.id))
  let index = 1
  let id = ''
  do id = `${def.prefix}_${String(index++).padStart(3, '0')}`; while (used.has(id))
  return {
    id,
    name: `${def.name} ${index - 1}`,
    type,
    area: '',
    system: '',
    position: { x: 0, y: def.size.height / 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { ...def.size },
    color: def.color,
    criticality: 'B',
    tags: [],
    description: '',
    dataSources: { plcTag: '', sapEquipmentId: '', grafanaUrl: '', powerBiUrl: '', documentsUrl: '', photosUrl: '', failureHistory: '' },
  }
}
