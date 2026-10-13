import { Crown, RotateCcw, Sparkles } from 'lucide-react'
import { useActiveTheme, useThemeStore } from '@/stores/useThemeStore'
import { THEMES } from '@/theme/themes'
import { cn } from '@/lib/format'

/** Floating pill that hangs off the header edge: flips Heritage Vault ⇄ Modern Studio. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useActiveTheme()
  const { toggle, override, setOverride } = useThemeStore()
  const target = theme === 'heritage' ? 'modern' : 'heritage'
  const Icon = target === 'heritage' ? Crown : Sparkles

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'group flex items-center gap-2 border px-4 py-2 text-xs font-semibold tracking-wide shadow-lg transition hover:-translate-y-0.5',
          target === 'heritage'
            ? 'border-heritage-gold/60 bg-heritage-maroon text-heritage-gold'
            : 'border-white/60 bg-white/80 text-modern-charcoal backdrop-blur-md',
        )}
        style={{ borderRadius: 9999 }}
        aria-label={THEMES[target].switchLabel}
      >
        <Icon className="size-4 transition group-hover:rotate-12" />
        {THEMES[target].switchLabel}
      </button>
      {override && (
        <button
          type="button"
          onClick={() => setOverride(null)}
          title="Reset to the collection's default look"
          aria-label="Reset theme to automatic"
          className="grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  )
}
