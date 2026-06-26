import { ObjectInspector } from './components/Inspector/ObjectInspector'
import { PlantScene } from './components/Scene/PlantScene'
import { ObjectLibrary } from './components/Sidebar/ObjectLibrary'
import { Toolbar } from './components/Toolbar/Toolbar'

export default function App() { return <div className="app-shell"><Toolbar /><main className="workspace"><ObjectLibrary /><PlantScene /><ObjectInspector /></main></div> }
