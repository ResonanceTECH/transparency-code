import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { statusLabels } from './format'

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {statusLabels[status] || status}
    </span>
  )
}
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return (
    <div className={`notice ${warning ? 'warning' : ''}`}>
      <CircleHelp size={17} />
      <div>{children}</div>
    </div>
  )
}
export function Panel({
  title,
  children,
  action,
  className = ''
}: {
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  )
}
