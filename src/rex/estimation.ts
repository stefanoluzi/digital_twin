import Decimal from 'decimal.js-light'

// An isolated constructor avoids changing precision for other application modules.
const D = Decimal.clone({ precision: 48, rounding: Decimal.ROUND_HALF_UP })
export interface EstimateInputs { durationDays: string; mechanical: string; electrical: string; mro: string; services: string; ownLabor: string }
export interface EstimateConfig { hoursPerDay: string; hourlyRate: string | null; currency: string }
export interface Estimate extends EstimateInputs { hoursPerDay: string; hourlyRate: string; currency: string; people: string; hoursPerPerson: string; manHours: string; contractorLabor: string; total: string; id?: number; createdAt?: string }
export const estimateInputKeys = ['durationDays', 'mechanical', 'electrical', 'mro', 'services', 'ownLabor'] as const
export function estimateInputs(value: EstimateInputs): EstimateInputs { return Object.fromEntries(estimateInputKeys.map((key) => [key, String(value[key])])) as unknown as EstimateInputs }
export function decimalInput(value: string, places: number, max: string, positive = false): string {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Ingresá un número sin separadores de miles')
  const n = new D(normalized)
  if (n.decimalPlaces() > places || n.greaterThan(max) || (positive && n.lessThanOrEqualTo(0))) throw new Error(`Valor fuera de rango o con más de ${places} decimales`)
  return n.toString()
}
export function calculateEstimate(input: EstimateInputs, config: EstimateConfig): Estimate {
  if (config.hourlyRate === null) throw new Error('Configurá el valor hora hombre en Configuración REX antes de estimar')
  const durationDays = decimalInput(input.durationDays, 3, '9999999', true)
  const mechanical = decimalInput(input.mechanical, 0, '9999999')
  const electrical = decimalInput(input.electrical, 0, '9999999')
  const mro = decimalInput(input.mro, 2, '999999999999')
  const services = decimalInput(input.services, 2, '999999999999')
  const ownLabor = decimalInput(input.ownLabor, 2, '999999999999')
  const hoursPerDay = decimalInput(config.hoursPerDay, 3, '24', true)
  const hourlyRate = decimalInput(config.hourlyRate, 4, '999999999', false)
  if (!/^[A-Z]{3}$/.test(config.currency)) throw new Error('Usá un código de moneda de tres letras, por ejemplo USD')
  const people = new D(mechanical).plus(electrical)
  const hoursPerPerson = new D(durationDays).times(hoursPerDay)
  const manHours = hoursPerPerson.times(people)
  const contractorLabor = manHours.times(hourlyRate).toFixed(2, D.ROUND_HALF_UP)
  const total = new D(mro).plus(contractorLabor).plus(services).plus(ownLabor).toFixed(2)
  return { durationDays, mechanical, electrical, mro, services, ownLabor, hoursPerDay, hourlyRate, currency: config.currency, people: people.toString(), hoursPerPerson: hoursPerPerson.toString(), manHours: manHours.toString(), contractorLabor, total }
}
/** Format Decimal strings without converting monetary values to a JS float. */
export function formatDecimal(value: string, places?: number) {
  const [whole, fraction] = (places === undefined ? new D(value).toFixed() : new D(value).toFixed(places)).split('.')
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction ? `,${fraction}` : '')
}
