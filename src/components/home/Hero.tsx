import { Link } from 'react-router'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { SITE } from '@/config/site'
import { useActiveTheme } from '@/stores/useThemeStore'
import { THEMES } from '@/theme/themes'

export function Hero() {
  const theme = useActiveTheme()
  const { hero } = THEMES[theme]
  const isHeritage = theme === 'heritage'

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-hero-from to-hero-to text-hero-ink">
      {isHeritage ? (
        <>
          <div className="ak-motif absolute inset-x-0 top-6 opacity-60" />
          <div className="ak-motif absolute inset-x-0 bottom-6 opacity-60" />
          <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-heritage-gold/15 blur-3xl" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-modern-rose/50 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-32 size-[420px] rounded-full bg-white/80 blur-3xl" />
        </>
      )}

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-14 pb-14 sm:px-6 md:grid-cols-2 md:pt-20 md:pb-20">
        <div className={isHeritage ? '' : 'ak-card p-6 sm:p-8'}>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-80">{hero.eyebrow}</p>
          <h1 className="mt-3 font-display text-5xl leading-[1.05] font-bold sm:text-6xl lg:text-7xl heritage:text-heritage-gold">
            {hero.title}
          </h1>
          <p lang="te" className="mt-3 text-lg opacity-90 sm:text-xl">
            {hero.teluguLine}
          </p>
          <p className="mt-5 max-w-lg text-base leading-relaxed opacity-90 sm:text-lg">{hero.valueProp}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={hero.primaryCta.to} className="ak-btn-accent px-6 py-3.5 text-base">
              {hero.primaryCta.label} <ArrowRight className="size-4" />
            </Link>
            <Link
              to={hero.secondaryCta.to}
              className="ak-btn border border-current/30 px-6 py-3.5 text-base hover:bg-white/10 modern:hover:bg-white"
            >
              {hero.secondaryCta.label}
            </Link>
          </div>

          <ul className="mt-6 flex flex-wrap gap-2">
            {hero.chips.map((chip) => (
              <li key={chip} className="rounded-full border border-current/20 px-3 py-1 text-xs font-medium opacity-90">
                {chip}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs opacity-70">
            {SITE.tagline} · Delivering to Hyderabad, Vijayawada, Vizag, Guntur & Warangal
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div
            className={
              isHeritage
                ? 'overflow-hidden rounded-t-[999px] border-4 border-heritage-gold/70 p-2 shadow-2xl shadow-black/40'
                : 'overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/40 p-2 shadow-2xl shadow-rose-200/60 backdrop-blur'
            }
          >
            <img
              src={hero.image}
              alt={`${hero.title} — featured jewellery`}
              className={isHeritage ? 'aspect-[4/5] w-full rounded-t-[999px] object-cover' : 'aspect-[4/5] w-full rounded-[2rem] object-cover'}
              fetchPriority="high"
            />
          </div>
          <div className="ak-card absolute -bottom-5 -left-3 flex items-center gap-3 px-4 py-3 text-ink sm:-left-8">
            {isHeritage ? <ShieldCheck className="size-8 text-primary" /> : <Sparkles className="size-8 text-accent" />}
            <div>
              <p className="text-sm font-semibold">{hero.floatingNote.title}</p>
              <p className="text-xs text-ink-muted">{hero.floatingNote.body}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
