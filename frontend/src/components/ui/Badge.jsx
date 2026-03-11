import clsx from 'clsx'

const VARIANTS = {
  default:   'bg-gray-800 text-gray-300 border-gray-700',
  brand:     'bg-brand-600/20 text-brand-400 border-brand-600/30',
  success:   'bg-emerald-900/40 text-emerald-400 border-emerald-800/40',
  warning:   'bg-amber-900/40 text-amber-400 border-amber-800/40',
  danger:    'bg-red-900/40 text-red-400 border-red-800/40',
  purple:    'bg-purple-900/40 text-purple-400 border-purple-800/40',
  cyan:      'bg-cyan-900/40 text-cyan-400 border-cyan-800/40',
}

export default function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        VARIANTS[variant] ?? VARIANTS.default,
        className
      )}
    >
      {children}
    </span>
  )
}
