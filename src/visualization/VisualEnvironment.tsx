import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { configureRenderer } from './rendererConfig'
import type { VisualTheme } from './visualTheme'

export function VisualEnvironment({ theme }: { theme: VisualTheme }) {
  const { gl } = useThree()

  useEffect(() => {
    configureRenderer(gl, theme)
  }, [gl, theme])

  const shadow = theme.shadows
  return (
    <>
      <color attach="background" args={[theme.background]} />
      {theme.lighting.ambientIntensity > 0 && <ambientLight intensity={theme.lighting.ambientIntensity} />}
      <hemisphereLight args={[theme.lighting.hemisphere.sky, theme.lighting.hemisphere.ground, theme.lighting.hemisphere.intensity]} />
      <directionalLight
        color={theme.lighting.key.color}
        position={theme.lighting.key.position}
        intensity={theme.lighting.key.intensity}
        castShadow={shadow.enabled}
        shadow-mapSize-width={shadow.mapSize}
        shadow-mapSize-height={shadow.mapSize}
        shadow-camera-left={-shadow.cameraExtent}
        shadow-camera-right={shadow.cameraExtent}
        shadow-camera-top={shadow.cameraExtent}
        shadow-camera-bottom={-shadow.cameraExtent}
        shadow-camera-near={shadow.near}
        shadow-camera-far={shadow.far}
        shadow-bias={shadow.bias}
        shadow-normalBias={shadow.normalBias}
      />
      {theme.lighting.fill.intensity > 0 && (
        <directionalLight color={theme.lighting.fill.color} position={theme.lighting.fill.position} intensity={theme.lighting.fill.intensity} />
      )}
    </>
  )
}
