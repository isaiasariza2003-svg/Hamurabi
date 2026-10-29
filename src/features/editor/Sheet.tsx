import type { ReactNode } from 'react'
import type { Margins, PageSize } from '../../core/tablets/types'

/** Hoja a escala real (carta u oficio) con sus márgenes en cm, igual que en el PDF. */
export function Sheet({
  pageSize,
  margins,
  editing = false,
  children,
}: {
  pageSize: PageSize
  margins: Margins
  editing?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`sheet ${pageSize}${editing ? ' editing' : ''}`}
      style={{ padding: `${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm` }}
    >
      {children}
    </div>
  )
}
