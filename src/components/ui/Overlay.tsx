import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/format'

/**
 * `right`: bottom sheet on phones, side drawer from 768px.
 * `bottom-sheet`: bottom sheet on phones, centred dialog from 768px.
 */
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
const PHONE = '(max-width: 767.98px)'
const DRAG_START_PX = 6
const DISMISS_PX = 120
const DISMISS_VELOCITY = 0.6 // px per ms

/** Accessible modal/drawer shell: portal, backdrop click, Esc to close, body scroll lock, focus kept inside while open. */
export function Overlay({ open, onClose, label, placement = 'center', className, children }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null)
  // Callers often pass an inline onClose; reading it through a ref keeps the effect (and focus) stable across re-renders.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const drag = useRef<{ y: number; t: number; dy: number; active: boolean } | null>(null)
  const sheet = placement !== 'center'

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus({ preventScroll: true })

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

  // Swipe down on the grabber (or any [data-sheet-drag] header) to dismiss a phone sheet.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!sheet || !e.isPrimary || !window.matchMedia(PHONE).matches) return
    if (!(e.target as Element).closest('[data-sheet-drag]')) return
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0, active: false }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = panel.current
    if (!d || !el) return
    const dy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(dy) < DRAG_START_PX) return
      if (dy < 0) return void (drag.current = null)
      d.active = true
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // The pointer already ended; the remaining events still reach the panel.
      }
      el.style.transition = 'none'
    }
    d.dy = Math.max(0, dy)
    el.style.transform = `translateY(${d.dy}px)`
  }
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = panel.current
    drag.current = null
    if (!d?.active || !el) return
    const velocity = d.dy / Math.max(1, e.timeStamp - d.t)
    const snapBack = () => {
      el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)'
      el.style.transform = ''
    }
    if (e.type === 'pointercancel' || (d.dy < DISMISS_PX && velocity < DISMISS_VELOCITY)) return snapBack()
    el.style.transition = 'transform 0.2s ease-in'
    el.style.transform = 'translateY(100%)'
    setTimeout(() => {
      closeRef.current()
      // A sheet that refuses to close (e.g. while saving) comes back into view.
      requestAnimationFrame(() => el.isConnected && snapBack())
    }, 180)
  }

  if (!open) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        placement === 'center' && 'items-center justify-center p-4',
        placement === 'right' && 'items-end justify-center md:items-stretch md:justify-end',
        placement === 'bottom-sheet' && 'items-end justify-center md:items-center md:p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={cn(
          'relative outline-none',
          placement === 'center' && 'animate-slide-up',
          sheet &&
            'max-md:animate-sheet-up max-md:flex max-md:max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] max-md:w-full max-md:flex-col max-md:overflow-hidden max-md:rounded-t-2xl max-md:*:min-h-0',
          placement === 'right' && 'md:animate-slide-in-right md:h-full md:w-full md:max-w-md',
          placement === 'bottom-sheet' && 'md:animate-slide-up',
          className,
        )}
      >
        {sheet && (
          <div data-sheet-drag aria-hidden className="absolute top-0 left-1/2 z-10 flex h-5 w-40 -translate-x-1/2 justify-center pt-2 md:hidden">
            <span className="h-1.5 w-10 rounded-full bg-ink-muted/40 ring-1 ring-white/50" />
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
