import * as THREE from 'three'

export type HelixDetailLevel = 'low' | 'medium'
export type HelixDirection = 'right' | 'left'

interface HelicalScrewGeometryOptions {
  length: number
  outerDiameter: number
  shaftDiameter: number
  pitch: number
  thickness: number
  detailLevel: HelixDetailLevel
  direction: HelixDirection
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly length: number,
    private readonly radius: number,
    private readonly turns: number,
    private readonly handedness: number,
  ) {
    super()
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const angle = this.handedness * this.turns * Math.PI * 2 * t
    return target.set(
      Math.cos(angle) * this.radius,
      Math.sin(angle) * this.radius,
      (t - 0.5) * this.length,
    )
  }
}

export function createHelicalScrewGeometry({
  length,
  outerDiameter,
  shaftDiameter,
  pitch,
  thickness,
  detailLevel,
  direction,
}: HelicalScrewGeometryOptions) {
  const turns = Math.max(1, length / pitch)
  const radius = Math.max(shaftDiameter * 0.56, outerDiameter / 2 - thickness / 2)
  const segmentsPerTurn = detailLevel === 'medium' ? 14 : 7
  const tubularSegments = Math.max(24, Math.min(detailLevel === 'medium' ? 2400 : 1200, Math.ceil(turns * segmentsPerTurn)))
  const radialSegments = detailLevel === 'medium' ? 7 : 4
  const curve = new HelixCurve(length, radius, turns, direction === 'right' ? 1 : -1)
  return new THREE.TubeGeometry(curve, tubularSegments, thickness / 2, radialSegments, false)
}
