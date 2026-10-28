import { Link } from 'react-router'
import { MapPin, Phone, ShieldCheck, Truck, Video } from 'lucide-react'
import { SITE } from '@/config/site'
import { whatsappLink } from '@/lib/whatsapp'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { NAV_LINKS } from './Header'

const POLICY_LINKS = [
  { to: '/orders', label: 'My orders' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/bridal-set', label: 'Bridal set builder' },
  { to: '/search', label: 'Search' },
  { to: '/contact', label: 'Contact us' },
  { to: '/policies/shipping', label: 'Shipping' },
  { to: '/policies/returns', label: 'Returns & damage' },
  { to: '/policies/privacy', label: 'Privacy' },
  { to: '/policies/terms', label: 'Terms' },
]

export function Footer() {
  return (
    <footer className="mt-20 bg-primary text-primary-ink">
      <div className="ak-motif opacity-80" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="font-display text-2xl font-bold">{SITE.name}</p>
          <p lang="te" className="mt-1 text-sm opacity-80">
            {SITE.teluguName}
          </p>
          <p className="mt-4 text-sm italic opacity-90">“{SITE.tagline}”</p>
          <p lang="te" className="mt-1 text-sm opacity-80">
            {SITE.teluguTagline}
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase opacity-70">Collections</p>
          <ul className="grid grid-cols-2 gap-x-4 text-sm md:grid-cols-1">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="inline-block py-1.5 opacity-90 hover:opacity-100 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase opacity-70">Promise</p>
          <ul className="space-y-3 text-sm opacity-90">
            <li className="flex gap-2">
              <Truck className="size-4 shrink-0" /> 2–3 day insured delivery in AP & Telangana
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0" /> 1-year re-polishing guarantee on 1 gram gold
            </li>
            <li className="flex gap-2">
              <Video className="size-4 shrink-0" /> Damage claims require an unedited unboxing video within 48 hours
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase opacity-70">Talk to us</p>
          <ul className="space-y-3 text-sm">
            <li>
              <a href={`tel:${SITE.phoneE164}`} className="flex items-center gap-2 py-1 hover:underline">
                <Phone className="size-4" /> {SITE.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={whatsappLink('Hi Alankrita Jewels!')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 py-1 hover:underline"
              >
                <WhatsAppIcon className="size-4" /> WhatsApp us
              </a>
            </li>
            <li className="flex gap-2 opacity-90">
              <MapPin className="size-4 shrink-0" /> Delivering to {SITE.serviceCities.slice(0, 5).join(', ')} & all of India
            </li>
          </ul>
          <p className="mt-4 text-xs opacity-70">{SITE.supportHours}</p>
        </div>
      </div>
      <div className="border-t border-current/15 px-4 py-5 text-center text-xs">
        <nav aria-label="Help and policies" className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {POLICY_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="inline-block py-1.5 opacity-90 hover:opacity-100 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-3 opacity-70">
          © {new Date().getFullYear()} {SITE.name}. Prices inclusive of GST. UPI · Partial COD · Cash on delivery.
        </p>
      </div>
    </footer>
  )
}
