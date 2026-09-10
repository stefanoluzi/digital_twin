import { navigate } from '../../shared/navigation'

export function HomeApp() {
  return <main className="app-home"><div className="app-home-card"><span className="app-home-kicker">DIGITAL TWIN</span><h1>Digital Twin LACO 1</h1><p>Selecciona el modulo de trabajo.</p><div className="app-home-options"><button onClick={() => navigate('/editor')}><strong>Plant Editor</strong><span>Editar geometria, layout, areas y niveles.</span></button><button onClick={() => navigate('/maintenance')}><strong>Maintenance Operations</strong><span>Estado, planes, recambios e historial de equipos.</span></button><button onClick={() => navigate('/maintenance/planner')}><strong>Planner de Mantenimiento</strong><span>Planificar paradas, tareas, recursos propios y terceros.</span></button></div></div></main>
}
