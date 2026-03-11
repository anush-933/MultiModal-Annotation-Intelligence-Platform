import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wand2,
  ClipboardList,
  BarChart3,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/generate',  icon: Wand2,           label: 'Synthetic Generator' },
  { to: '/annotate',  icon: ClipboardList,   label: 'Annotation Workspace' },
  { to: '/evaluate',  icon: BarChart3,       label: 'Evaluation Layer' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">MAIP</p>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5">Data Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="px-3 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
          Pipeline Modules
        </p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-500">API Connected</span>
        </div>
        <p className="text-[10px] text-gray-700 mt-2 px-2">MAIP v1.0.0</p>
      </div>
    </aside>
  )
}
