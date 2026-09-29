import { useAppTheme } from '../../shared/AppShell'
import { LcoCouplingsScreen } from './LcoCouplingsScreen'

export function StandaloneLcoCouplingsApp() {
  const theme = useAppTheme()
  return <div className={`lco-standalone-app theme-${theme}`}><LcoCouplingsScreen standalone /></div>
}
