import { useEffect, useRef, type ReactNode } from 'react'
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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Accessible modal/drawer shell: portal, backdrop click, Esc to close, body scroll lock, focus kept inside while open. */
export function Overlay({ open, onClose, label, placement = 'center', className, children }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null)
  // Callers often pass an inline onClose; reading it through a ref keeps the effect (and focus) stable across re-renders.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return e.preventDefault()
      const [first, last] = [items[0], items[items.length - 1]]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    openOverlays += 1
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      openOverlays -= 1
      if (openOverlays === 0) document.body.style.overflow = ''
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

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
        ref={panel}
        tabIndex={-1}
        className={cn(
          'relative outline-none',
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
