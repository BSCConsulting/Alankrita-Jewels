import { useState } from 'react'
import { ChevronDown, Phone, X } from 'lucide-react'
import { SITE } from '@/config/site'
import { cn } from '@/lib/format'
import { generalEnquiryLink, whatsappLink } from '@/lib/whatsapp'
import { Overlay } from '@/components/ui/Overlay'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { CHAT_UI, FAQS, type Lang } from './faqs'

export function WhatsAppChatbot() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [expanded, setExpanded] = useState<string | null>(FAQS[0].id)
  const t = CHAT_UI[lang]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-whatsapp text-white shadow-xl shadow-black/25 transition hover:scale-105"
        aria-label="Open WhatsApp help"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-whatsapp/40 [animation-duration:2.5s]" />
        <WhatsAppIcon className="relative size-7" />
      </button>

      <Overlay open={open} onClose={() => setOpen(false)} label="WhatsApp help" placement="bottom-sheet" className="w-full sm:max-w-md">
        <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-white text-slate-800 shadow-2xl sm:rounded-3xl">
          <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
            <div className="grid size-10 place-items-center rounded-full bg-white/15 font-display text-lg font-bold">AJ</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" lang={lang}>
                {t.title}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-white/80" lang={lang}>
                <span className="size-2 rounded-full bg-emerald-300" /> {t.status}
              </p>
            </div>
            <div className="flex rounded-full bg-white/15 p-0.5 text-xs font-semibold" role="group" aria-label="Language">
              {(['en', 'te'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={cn('rounded-full px-2.5 py-1 transition', lang === l ? 'bg-white text-[#075E54]' : 'text-white')}
                >
                  {l === 'en' ? 'EN' : 'తెలుగు'}
                </button>
              ))}
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#ECE5DD] p-4" lang={lang}>
            <div className="mb-4 max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm shadow-sm">{t.greeting}</div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{t.faqHeading}</p>
            <div className="space-y-2">
              {FAQS.map((faq) => {
                const isOpen = expanded === faq.id
                return (
                  <div key={faq.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                    <button
                      onClick={() => setExpanded(isOpen ? null : faq.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-2 px-3.5 py-3 text-left text-sm font-semibold"
                    >
                      <span className="flex-1">{faq.q[lang]}</span>
                      <ChevronDown className={cn('mt-0.5 size-4 shrink-0 transition', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="animate-fade-in border-t border-slate-100 px-3.5 py-3 text-sm leading-relaxed text-slate-600">
                        <p>{faq.a[lang]}</p>
                        <a
                          href={whatsappLink(faq.q[lang])}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E] hover:underline"
                        >
                          <WhatsAppIcon className="size-3.5" /> {t.askThis}
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-slate-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <a
              href={generalEnquiryLink(lang)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-whatsapp px-4 py-3 text-sm font-semibold text-white"
              lang={lang}
            >
              <WhatsAppIcon className="size-5" /> {t.cta} · {SITE.phoneDisplay}
            </a>
            <a
              href={`tel:${SITE.phoneE164}`}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold"
              aria-label={`Call ${SITE.phoneDisplay}`}
            >
              <Phone className="size-4" /> {t.call}
            </a>
          </div>
        </div>
      </Overlay>
    </>
  )
}
