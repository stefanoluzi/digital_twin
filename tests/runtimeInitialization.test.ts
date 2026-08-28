import { describe, expect, it } from 'vitest'
import { useProjectStore } from '../src/store/projectStore'
import { useSceneStore } from '../src/store/sceneStore'

const demoAssetIds = ['MTR_001', 'GRB_001', 'RTB_001', 'TNK_001']

describe('clean application initialization', () => {
  it('starts without a project or runtime demo geometry', () => {
    const project = useProjectStore.getInitialState()
    const scene = useSceneStore.getInitialState()

    expect(project.hasActiveProject).toBe(false)
    expect(scene.objects).toHaveLength(0)
    expect(scene.objects.map((asset) => asset.id)).not.toEqual(expect.arrayContaining(demoAssetIds))
  })

  it('keeps new projects empty until the user adds or imports geometry', () => {
    useSceneStore.getState().resetProject()
    useProjectStore.getState().createNewProject()

    expect(useProjectStore.getState().hasActiveProject).toBe(true)
    expect(useSceneStore.getState().objects).toHaveLength(0)
  })
})
