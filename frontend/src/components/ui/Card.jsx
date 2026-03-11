import clsx from 'clsx'

export default function Card({ children, className, ...props }) {
  return (
    <div
      className={clsx('bg-gray-900 border border-gray-800 rounded-xl', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return (
    <div className={clsx('px-5 py-4 border-b border-gray-800 flex items-center justify-between', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }) {
  return <div className={clsx('p-5', className)}>{children}</div>
}
