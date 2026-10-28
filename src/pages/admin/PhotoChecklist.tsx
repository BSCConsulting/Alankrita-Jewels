import { CheckCircle2, Circle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/format'
import { PHOTO_TIPS, photoChecks, type PhotoSize } from '@/lib/photoChecklist'

export function PhotoChecklist({ sizes, main, hasReel }: { sizes: Array<PhotoSize | null>; main: PhotoSize | null; hasReel: boolean }) {
  const checks = photoChecks(sizes, main, hasReel)
  const done = checks.filter((c) => c.ok).length

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold">
        Photo checklist <span className="font-normal text-slate-500">· {done} of {checks.length} done</span>
      </p>
      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />}
            <div>
              <p className={cn(c.ok ? 'text-slate-700' : 'font-medium text-slate-900')}>{c.label}</p>
              {c.hint && <p className="text-xs text-slate-500">{c.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
      <details className="mt-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
          <Lightbulb className="size-4 text-amber-500" /> Tips for photos that sell
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-slate-600">
          {PHOTO_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
