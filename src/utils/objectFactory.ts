import type { AssetType, Criticality, IndustrialAsset, IndustrialParamKey, IndustrialParamValue, PlantSystem, SnapSettings, Vector3Data } from '../types/plant'
import { DEFAULT_AREA_CODE } from '../config/areas'

export const definitions: Record<AssetType, {
  prefix: string
  name: string
  size: IndustrialAsset['size']
  color: string
  params?: Partial<Record<IndustrialParamKey, IndustrialParamValue>>
  system?: PlantSystem
  criticality?: Criticality
  tags?: string[]
  description?: string
}> = {
  box: { prefix: 'BOX', name: 'Box', size: { width: 2, height: 1.5, depth: 2 }, color: '#707b86' },
  long_box: { prefix: 'LBX', name: 'Long Box', size: { width: 6, height: 1, depth: 1.2 }, color: '#687782' },
  cylinder: { prefix: 'CYL', name: 'Cylinder', size: { width: 1.6, height: 2.4, depth: 1.6 }, color: '#7b8794' },
  hollow_cylinder: {
    prefix: 'HCY',
    name: 'Cilindro Hueco',
    size: { width: 1, height: 1.5, depth: 1 },
    color: '#7b8794',
    params: { outerDiameter: 1, innerDiameter: 0.5, length: 1.5, radialSegments: 32 },
    description: 'Cilindro con agujero central pasante configurable.',
  },
  pipe: { prefix: 'PIP', name: 'Pipe', size: { width: 4, height: 0.5, depth: 0.5 }, color: '#8a949e' },
  beam: { prefix: 'BEM', name: 'Beam', size: { width: 5, height: 0.45, depth: 0.75 }, color: '#596a78' },
  plate: { prefix: 'PLT', name: 'Plate', size: { width: 4, height: 0.16, depth: 2.4 }, color: '#7c8790' },
  roller_table_flat: {
    prefix: 'RTF',
    name: 'Roller Table Flat',
    size: { width: 8, height: 1.1, depth: 2.8 },
    color: '#b27a32',
    params: { length: 8, rollerSpacing: 0.8, rollerDiameter: 0.32, rollerWidth: 1.2, rollerCount: 11, showBearingHousings: 1, housingWidth: 0.35, housingLength: 0.45, housingHeight: 0.55, housingBaseThickness: 0.08, shaftDiameter: 0.12, shaftExtension: 0.12, housingCapHeight: 0.1, housingColor: '#4b5563' },
  },
  roller_table_biconical: {
    prefix: 'RTB',
    name: 'Roller Table Biconical',
    size: { width: 8, height: 1.1, depth: 2.8 },
    color: '#b27a32',
    params: { length: 8, rollerSpacing: 0.8, rollerDiameter: 0.38, rollerWidth: 1.2, rollerCount: 11, showBearingHousings: 1, housingWidth: 0.38, housingLength: 0.48, housingHeight: 0.58, housingBaseThickness: 0.08, shaftDiameter: 0.12, shaftExtension: 0.12, housingCapHeight: 0.1, housingColor: '#4b5563' },
  },
  bancal: {
    prefix: 'BNC',
    name: 'Bancal',
    size: { width: 6.5, height: 0.85, depth: 1.8 },
    color: '#687782',
    params: { length: 6.5, width: 1.8, height: 0.85 },
  },
  rail_bed_multi: {
    prefix: 'BRL',
    name: 'Bancal de Rieles',
    size: { width: 8, height: 0.5, depth: 3 },
    color: '#687782',
    params: { length: 8, width: 3, railCount: 6, railHeight: 0.18, railWidth: 0.12, supportSpacing: 1, showCrossSupports: 1 },
  },
  lance_carrier_cart: {
    prefix: 'CPL',
    name: 'Carro Porta Lanza',
    size: { width: 8.95, height: 1.96, depth: 1.65 },
    color: '#596a78',
    params: {
      bodyLength: 3.2,
      bodyDiameter: 1.4,
      bodyEndCapLength: 0.15,
      frontNeckLength: 0.35,
      frontNeckDiameter: 0.55,
      chassisLength: 3.5,
      chassisWidth: 1.6,
      wheelRadius: 0.35,
      wheelWidth: 0.2,
      wheelbase: 2.3,
      trackWidth: 1.45,
      showLance: 1,
      lanceLength: 5,
      lanceDiameter: 0.2,
      lanceOffsetY: 0,
      showTowBar: 0,
    },
    system: 'mecanico',
    criticality: 'C',
    tags: ['carro', 'lanza', 'transporte', 'mecanico'],
    description: 'Carro industrial de cuatro ruedas para transporte y soporte de lanza.',
  },
  centering_stars: {
    prefix: 'ECT',
    name: 'Estrellas Centradoras',
    size: { width: 5.5, height: 1.4, depth: 1.4 },
    color: '#a66f4a',
    params: { length: 5.5, starCount: 6, width: 1.4 },
  },
  chain_bed: {
    prefix: 'CHB',
    name: 'Chain Bed',
    size: { width: 7, height: 0.9, depth: 2.2 },
    color: '#5f6f7d',
    params: { length: 7, width: 2.2, chainCount: 2, chainWidth: 0.24, chainHeight: 0.12, supportSpacing: 1.3, showSupports: 1 },
  },
  rolling_stand: {
    prefix: 'RST',
    name: 'Rolling Stand',
    size: { width: 3.2, height: 4, depth: 2.2 },
    color: '#6b7b8c',
    params: { width: 3.2, height: 4 },
  },
  steader_3_roll: {
    prefix: 'STD',
    name: 'Steader 3 Rodillos',
    size: { width: 3, height: 1.8, depth: 2.2 },
    color: '#374151',
    params: {
      length: 3,
      width: 2.2,
      height: 1.8,
      rollerDiameter: 0.35,
      rollerLength: 1.4,
      rollerColor: '#d97706',
      frameColor: '#374151',
      showTubePlaceholder: 1,
      showHydraulics: 1,
    },
  },
  piercer_drive: {
    prefix: 'PDR',
    name: 'Piercer Drive',
    size: { width: 7.2, height: 3.2, depth: 2.6 },
    color: '#287c8e',
    params: { length: 7.2, width: 2.6, height: 3.2 },
  },
  piercer_machine: {
    prefix: 'PRF',
    name: 'Piercer Machine',
    size: { width: 6, height: 3, depth: 2 },
    color: '#6b7280',
    params: { length: 6, width: 2, height: 3, baseHeight: 0.3, openingWidth: 2.2, openingHeight: 1.3, frameThickness: 0.55, rollDiameter: 0.45, rollAngle: 25, mandrelDiameter: 0.18 },
  },
  electric_motor_horizontal: { prefix: 'EMH', name: 'Motor Electrico Horizontal', size: { width: 2.8, height: 1.35, depth: 1.35 }, color: '#287c8e' },
  electric_motor_vertical: { prefix: 'EMV', name: 'Motor Electrico Vertical', size: { width: 1.55, height: 2.5, depth: 1.55 }, color: '#287c8e' },
  gearbox_horizontal: { prefix: 'GBH', name: 'Caja Reductora Horizontal', size: { width: 2.5, height: 1.45, depth: 1.55 }, color: '#6b7b8c' },
  gearbox_vertical: { prefix: 'GBV', name: 'Caja Reductora Vertical', size: { width: 1.65, height: 2.45, depth: 1.65 }, color: '#6b7b8c' },
  motor_gearbox_parallel: { prefix: 'MGP', name: 'Motor + Reductor Ejes Paralelos', size: { width: 4.8, height: 1.55, depth: 2.1 }, color: '#287c8e' },
  hydraulic_power_unit: {
    prefix: 'HPU',
    name: 'Central Hidraulica',
    size: { width: 4, height: 2, depth: 2 },
    color: '#2563eb',
    params: { length: 4, width: 2, height: 2, pumpCount: 1, accumulatorCount: 2, filterCount: 2, valveSections: 5 },
  },
  transfer_star: {
    prefix: 'TES',
    name: 'Transferidor Estrella',
    size: { width: 1.2, height: 1.8, depth: 1.8 },
    color: '#a66f4a',
    params: { count: 1, spacing: 1.8, shaftDiameter: 0.18, shaftLength: 1.2, supportHeight: 0.28, pivotAngle: 0, armCount: 4, transferDiameter: 1.6, height: 0.34 },
  },
  transfer_v: {
    prefix: 'TRV',
    name: 'Transferidor V',
    size: { width: 1.2, height: 1.8, depth: 1.6 },
    color: '#5f6f7d',
    params: { count: 1, spacing: 1.8, shaftDiameter: 0.18, shaftLength: 1.1, supportHeight: 0.28, pivotAngle: 0, columnHeight: 1.35, vWidth: 1.1, vOpening: 0.55 },
  },
  transfer_claw: {
    prefix: 'TRU',
    name: 'Transferidor Uña',
    size: { width: 1.8, height: 2.35, depth: 2.8 },
    color: '#596a78',
    params: { count: 1, spacing: 2.4, shaftDiameter: 0.22, shaftLength: 1.4, supportHeight: 0.34, pivotAngle: 0, height: 2.05, clawLength: 2.05, clawOpening: 0.8 },
  },
  coupling: { prefix: 'ACO', name: 'Acople', size: { width: 1.1, height: 0.75, depth: 0.75 }, color: '#9ca3aa' },
  cardan_shaft: { prefix: 'CRD', name: 'Cardan', size: { width: 3.8, height: 0.75, depth: 0.75 }, color: '#8a949e' },
  transmission_shaft: { prefix: 'SHF', name: 'Eje de Transmision', size: { width: 4.5, height: 0.9, depth: 0.9 }, color: '#8a949e' },
  centrifugal_pump_horizontal: { prefix: 'CPH', name: 'Bomba Centrifuga Horizontal', size: { width: 3.3, height: 1.35, depth: 1.45 }, color: '#347d70' },
  vertical_pump: { prefix: 'VPM', name: 'Bomba Vertical', size: { width: 1.7, height: 3.2, depth: 1.7 }, color: '#347d70' },
  industrial_fan: { prefix: 'FAN', name: 'Ventilador Industrial', size: { width: 2.4, height: 2.1, depth: 1.2 }, color: '#596a78' },
  platform: { prefix: 'PLF', name: 'Plataforma', size: { width: 4, height: 0.45, depth: 2.6 }, color: '#687782' },
  stairs: { prefix: 'STR', name: 'Escalera', size: { width: 2.6, height: 1.7, depth: 1.2 }, color: '#687782' },
  handrail: { prefix: 'HRL', name: 'Baranda', size: { width: 3.5, height: 1.05, depth: 0.18 }, color: '#d1a34a' },
  column: { prefix: 'COL', name: 'Columna', size: { width: 0.55, height: 3.4, depth: 0.55 }, color: '#596a78' },
  electrical_panel: { prefix: 'ELP', name: 'Tablero Electrico', size: { width: 1.25, height: 2.1, depth: 0.45 }, color: '#364654' },
  cabinet: { prefix: 'CAB', name: 'Gabinete', size: { width: 1.35, height: 1.95, depth: 0.75 }, color: '#596a78' },
  tank_vertical: { prefix: 'TVT', name: 'Tanque Vertical', size: { width: 1.8, height: 3.1, depth: 1.8 }, color: '#7b8794' },
  tank_horizontal: { prefix: 'THT', name: 'Tanque Horizontal', size: { width: 3.4, height: 1.55, depth: 1.55 }, color: '#7b8794' },
  rectangular_pool: {
    prefix: 'PLT',
    name: 'Pileta rectangular',
    size: { width: 6, height: 1.58, depth: 3 },
    color: '#687782',
    system: 'hidraulico',
    criticality: 'C',
    tags: ['pileta', 'tanque', 'fluido', 'enfriamiento'],
    description: 'Pileta industrial rectangular abierta para enfriamiento, lavado o almacenamiento de fluidos.',
    params: {
      length: 6,
      width: 3,
      height: 1.5,
      wallThickness: 0.15,
      bottomThickness: 0.2,
      showLiquid: 1,
      liquidLevel: 0.75,
      liquidColor: '#4aa3df',
      liquidOpacity: 0.45,
      showTopRim: 1,
      rimWidth: 0.1,
      rimHeight: 0.08,
      showExternalRibs: 0,
      ribCountLongSides: 5,
      ribThickness: 0.08,
      supportType: 'floor',
      supportHeight: 0.35,
      showDrain: 0,
      drainDiameter: 0.18,
      drainSide: 'right',
      bodyColor: '#687782',
      interiorColor: '#77838c',
    },
  },
  pipe_rack_simple: { prefix: 'PRK', name: 'Pipe Rack Simple', size: { width: 5, height: 2.2, depth: 1.7 }, color: '#596a78' },
  gearbox: { prefix: 'GRB', name: 'Caja reductora', size: { width: 2.4, height: 1.5, depth: 1.4 }, color: '#6b7b8c' },
  motor: { prefix: 'MTR', name: 'Motor', size: { width: 2.4, height: 1.4, depth: 1.4 }, color: '#287c8e' },
  roller: { prefix: 'ROL', name: 'Rodillo', size: { width: 2.5, height: 0.55, depth: 0.55 }, color: '#9ca3aa' },
  roller_table: { prefix: 'RTB', name: 'Mesa de rodillos', size: { width: 6, height: 1.1, depth: 2.5 }, color: '#b27a32' },
  pump: { prefix: 'PMP', name: 'Bomba', size: { width: 1.8, height: 1.2, depth: 1 }, color: '#347d70' },
  tank: { prefix: 'TNK', name: 'Tanque', size: { width: 2, height: 3, depth: 2 }, color: '#7b8794' },
  conveyor: { prefix: 'CNV', name: 'Transportador', size: { width: 6, height: 0.7, depth: 1.5 }, color: '#805c45' },
  generic_box: { prefix: 'BOX', name: 'Caja generica', size: { width: 2, height: 1.5, depth: 2 }, color: '#707b86' },
}

interface CreateIndustrialObjectOptions {
  position?: Vector3Data
  snap?: Pick<SnapSettings, 'enabled' | 'gridSize'>
}

export function createIndustrialObject(type: AssetType, existing: IndustrialAsset[], options: CreateIndustrialObjectOptions = {}): IndustrialAsset {
  const def = definitions[type]
  const insertionPoint = options.position ?? { x: 0, y: 0, z: 0 }
  const gridSize = options.snap?.gridSize ?? 0
  const snapCoordinate = (value: number) => options.snap?.enabled && gridSize > 0
    ? Math.round(value / gridSize) * gridSize
    : value
  const used = new Set(existing.map((item) => item.id))
  let index = 1
  let id = ''
  do id = `${def.prefix}_${String(index++).padStart(3, '0')}`; while (used.has(id))
  return {
    id,
    name: `${def.name} ${index - 1}`,
    type,
    area: '',
    areaCode: DEFAULT_AREA_CODE,
    system: def.system ?? '',
    position: {
      x: snapCoordinate(insertionPoint.x),
      y: insertionPoint.y + def.size.height / 2,
      z: snapCoordinate(insertionPoint.z),
    },
    rotation: { x: 0, y: 0, z: 0 },
    size: { ...def.size },
    uniformScale: 1,
    params: { ...(def.params ?? {}) },
    color: def.color,
    criticality: def.criticality ?? 'B',
    locked: false,
    tags: [...(def.tags ?? [])],
    description: def.description ?? '',
    dataSources: { plcTag: '', sapEquipmentId: '', grafanaUrl: '', powerBiUrl: '', documentsUrl: '', photosUrl: '', failureHistory: '' },
  }
}
