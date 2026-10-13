import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/format'

type Placement = 'center' | 'right' | 'bottom-sheet'

interface OverlayProps {
  open: boolean
  onClose: () => void
  label: string
  placement?: Placement
  className?: string
  children: ReactNode
}

let openOverlays = 0

/** Accessible modal/drawer shell: portal, backdrop click, Esc to close, body scroll lock. */
export function Overlay({ open, onClose, label, placement = 'center', className, children }: OverlayProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    openOverlays += 1
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      openOverlays -= 1
      if (openOverlays === 0) document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        placement === 'center' && 'items-center justify-center p-4',
        placement === 'right' && 'justify-end',
        placement === 'bottom-sheet' && 'items-end justify-center sm:items-center sm:p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          'relative',
          placement === 'right' && 'animate-slide-in-right h-full w-full max-w-md',
          placement !== 'right' && 'animate-slide-up',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
