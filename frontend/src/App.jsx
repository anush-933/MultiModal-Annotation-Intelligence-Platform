import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'
import Dashboard from './pages/Dashboard'
import SyntheticGenerator from './pages/SyntheticGenerator'
import AnnotationWorkspace from './pages/AnnotationWorkspace'
import EvaluationLayer from './pages/EvaluationLayer'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/"           element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/generate"   element={<SyntheticGenerator />} />
            <Route path="/annotate"   element={<AnnotationWorkspace />} />
            <Route path="/evaluate"   element={<EvaluationLayer />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
