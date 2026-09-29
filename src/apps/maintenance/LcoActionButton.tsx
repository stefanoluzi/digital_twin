import { useMaintenanceStore } from '../../maintenance/store/maintenanceStore'
import { BusyButton } from '../../shared/ux/LoadingFeedback'

export function LcoActionButton(props: Parameters<typeof BusyButton>[0]) {
  const status = useMaintenanceStore((state) => state.lcoStorageStatus)
  return <BusyButton {...props} busy={status === 'SAVING' || status === 'LOADING'} />
}
