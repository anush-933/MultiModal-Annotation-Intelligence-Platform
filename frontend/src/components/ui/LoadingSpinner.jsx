import clsx from 'clsx'

export default function LoadingSpinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div
      className={clsx(
        'border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin',
        sizes[size],
        className
      )}
    />
  )
}

export function FullPageLoader({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
      <LoadingSpinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
