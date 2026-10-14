import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { MessageCircleMore, Phone, X } from 'lucide-react'
import { SITE } from '@/config/site'
import { cn } from '@/lib/format'
import { generalEnquiryLink, whatsappLink } from '@/lib/whatsapp'
import { Overlay } from '@/components/ui/Overlay'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { CHAT_UI, FAQS, type Lang } from './faqs'

const TEASER_KEY = 'ak-chat-teaser-seen'
const TEASER_DELAY_MS = 6000
const TYPING_MS = 700

function isSupportOnline() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()))
  return hour >= SITE.supportOpenHour && hour < SITE.supportCloseHour
}

export function WhatsAppChatbot() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [asked, setAsked] = useState<string[]>([])
  const [typing, setTyping] = useState<string | null>(null)
  const [teaser, setTeaser] = useState(false)
  const [online, setOnline] = useState(isSupportOnline)
  const lastQuestion = useRef<HTMLDivElement>(null)
  const t = CHAT_UI[lang]

  // Product pages have a sticky "Add to bag" bar on mobile; keep the launcher above it.
  const liftForBar = pathname.startsWith('/product/')

  useEffect(() => {
    if (sessionStorage.getItem(TEASER_KEY)) return
    const timer = setTimeout(() => setTeaser(true), TEASER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!typing) return
    const timer = setTimeout(() => setTyping(null), TYPING_MS)
    return () => clearTimeout(timer)
  }, [typing])

  // Re-run when the answer replaces the typing dots: only then is there enough content to scroll the question to the top.
  useEffect(() => {
    lastQuestion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [asked, typing])

  const dismissTeaser = () => {
    setTeaser(false)
    sessionStorage.setItem(TEASER_KEY, '1')
  }

  const openChat = () => {
    dismissTeaser()
    setOnline(isSupportOnline())
    setOpen(true)
  }

  const ask = (id: string) => {
    if (typing) return
    setAsked((list) => [...list, id])
    setTyping(id)
  }

  const remaining = FAQS.filter((f) => !asked.includes(f.id))

  return (
    <>
      <div
        className={cn(
          'fixed right-4 z-40 flex items-end gap-2',
          liftForBar ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-5' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-5',
        )}
      >
        {teaser && !open && (
          <div className="ak-card animate-slide-up relative mb-1 max-w-[15rem] py-3 pr-8 pl-3.5 text-sm text-ink" lang={lang}>
            <button type="button" onClick={openChat} className="text-left">
              <span className="block font-semibold">Namaste 🙏</span>
              <span className="text-ink-muted">{t.teaser}</span>
            </button>
            <button type="button" onClick={dismissTeaser} className="absolute top-1.5 right-1.5 rounded-full p-1.5 text-ink-muted hover:bg-surface-muted" aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={openChat}
          className="relative grid size-14 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-lg shadow-black/30 ring-4 ring-white/80 transition hover:scale-105 active:scale-95"
          aria-label="Open chat help"
        >
          <MessageCircleMore className="size-7" strokeWidth={1.8} />
          <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-whatsapp text-white ring-2 ring-white">
            <WhatsAppIcon className="size-3" />
          </span>
        </button>
      </div>

      <Overlay open={open} onClose={() => setOpen(false)} label={t.title} placement="bottom-sheet" className="w-full sm:max-w-md">
        <div className="flex max-h-[min(42rem,88vh)] flex-col overflow-hidden rounded-t-3xl bg-bg text-ink shadow-2xl sm:rounded-3xl">
          <header className="bg-gradient-to-br from-hero-from to-hero-to text-hero-ink">
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <Avatar online={online} className="size-11 text-xl" />
              <div className="min-w-0 flex-1" lang={lang}>
                <p className="font-display text-lg leading-tight font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs leading-snug opacity-80">{online ? t.online : t.offline}</p>
              </div>
              <div className="flex shrink-0 rounded-full bg-black/15 p-0.5 text-xs font-semibold" role="group" aria-label="Language">
                {(['en', 'te'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    aria-label={l === 'en' ? 'English' : 'తెలుగు'}
                    className={cn('min-w-8 rounded-full px-2 py-1 transition', lang === l ? 'bg-accent text-accent-ink shadow-sm' : 'opacity-80 hover:opacity-100')}
                  >
                    {l === 'en' ? 'EN' : <span lang="te">తె</span>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 rounded-full p-2 transition hover:bg-black/15">
                <X className="size-5" />
              </button>
            </div>
            <div className="ak-motif opacity-80" />
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-surface-muted/50 px-4 py-5" lang={lang} aria-live="polite">
            <BotBubble>{t.greeting}</BotBubble>

            {asked.map((id, i) => {
              const faq = FAQS.find((f) => f.id === id)!
              const isLast = i === asked.length - 1
              return (
                <div key={id} ref={isLast ? lastQuestion : undefined} className="scroll-mt-4 space-y-3">
                  <div className="animate-fade-in ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm text-primary-ink shadow-sm">
                    {faq.q[lang]}
                  </div>
                  {isLast && typing === id ? (
                    <BotBubble>
                      <span className="flex items-center gap-1 py-1" aria-label={t.typing}>
                        {[0, 150, 300].map((delay) => (
                          <span key={delay} className="size-1.5 animate-bounce rounded-full bg-ink-muted/60" style={{ animationDelay: `${delay}ms` }} />
                        ))}
                      </span>
                    </BotBubble>
                  ) : (
                    <BotBubble>
                      <p className="leading-relaxed">{faq.a[lang]}</p>
                      <a
                        href={whatsappLink(faq.q[lang])}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C7E] hover:underline"
                      >
                        <WhatsAppIcon className="size-3.5" /> {t.askThis}
                      </a>
                    </BotBubble>
                  )}
                </div>
              )
            })}

            {!typing && (
              <div className="animate-fade-in pt-1">
                {remaining.length ? (
                  <>
                    <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                      {asked.length ? t.moreHeading : t.suggestHeading}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {remaining.map((faq) => (
                        <button
                          key={faq.id}
                          type="button"
                          onClick={() => ask(faq.id)}
                          className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-accent hover:bg-accent/10 active:scale-95"
                        >
                          {faq.chip[lang]}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <BotBubble>{t.allDone}</BotBubble>
                )}
              </div>
            )}
          </div>

          <footer className="border-t border-line bg-bg px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <a href={generalEnquiryLink(lang)} target="_blank" rel="noopener noreferrer" className="ak-btn-whatsapp py-3" lang={lang}>
                <WhatsAppIcon className="size-5" /> {t.cta}
              </a>
              <a href={`tel:${SITE.phoneE164}`} className="ak-btn-outline px-4 py-3" aria-label={`Call ${SITE.phoneDisplay}`} lang={lang}>
                <Phone className="size-4" /> {t.call}
              </a>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink-muted" lang={lang}>
              {t.hours}
            </p>
          </footer>
        </div>
      </Overlay>
    </>
  )
}

function Avatar({ online, className }: { online: boolean; className?: string }) {
  return (
    <div className={cn('relative grid shrink-0 place-items-center rounded-full bg-accent font-telugu font-bold text-accent-ink ring-2 ring-white/40', className)}>
      అ
      <span className={cn('absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-white', online ? 'bg-emerald-400' : 'bg-slate-400')} />
    </div>
  )
}

function BotBubble({ children }: { children: ReactNode }) {
  return (
    <div className="animate-fade-in flex items-end gap-2">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent font-telugu text-xs font-bold text-accent-ink">అ</div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-sm">{children}</div>
    </div>
  )
}
