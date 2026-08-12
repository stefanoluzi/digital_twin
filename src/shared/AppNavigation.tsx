import { navigate } from './navigation'

export function AppNavigation({ active }: { active: 'HOME' | 'EDITOR' | 'MAINTENANCE' }) {
  return <nav className="app-navigation" aria-label="Modulos Digital Twin"><button className="app-navigation-brand" onClick={() => navigate('/')}>Digital Twin</button><button className={active === 'EDITOR' ? 'active' : ''} onClick={() => navigate('/editor')}>Editor</button><button className={active === 'MAINTENANCE' ? 'active' : ''} onClick={() => navigate('/maintenance')}>Maintenance</button></nav>
}
