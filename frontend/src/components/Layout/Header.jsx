import { useLocation } from 'react-router-dom'
import { Bell, HelpCircle } from 'lucide-react'

const TITLES = {
  '/dashboard': { title: 'Data Quality Control Center', sub: 'Real-time pipeline health and quality metrics' },
  '/generate':  { title: 'Synthetic Data Generator', sub: 'Claude-powered diverse training data generation' },
  '/annotate':  { title: 'Annotation Workspace', sub: 'Human-in-the-loop labeling with IAA scoring' },
  '/evaluate':  { title: 'LLM-as-Judge Evaluation', sub: 'Automated quality scoring across 4 dimensions' },
}

export default function Header() {
  const { pathname } = useLocation()
  const info = TITLES[pathname] || TITLES['/dashboard']

  return (
    <header className="h-16 shrink-0 border-b border-gray-800 bg-gray-900/70 backdrop-blur flex items-center justify-between px-6">
      <div>
        <h1 className="text-base font-semibold text-white">{info.title}</h1>
        <p className="text-xs text-gray-500">{info.sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
          A
        </div>
      </div>
    </header>
  )
}
