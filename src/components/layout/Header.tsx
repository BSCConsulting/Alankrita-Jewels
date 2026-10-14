import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { Menu, Package, Phone, Search, ShoppingBag, X } from 'lucide-react'
import { COLLECTION_SLUGS, SITE } from '@/config/site'
import { cn } from '@/lib/format'
import { useCartCount, useCartStore } from '@/stores/useCartStore'
import { Overlay } from '@/components/ui/Overlay'
import { SearchOverlay } from './SearchOverlay'
import { ThemeToggle } from './ThemeToggle'

export const NAV_LINKS = [
  { label: '1 Gram Gold', te: 'ఒక గ్రాము బంగారం', to: `/collections/${COLLECTION_SLUGS.oneGramGold}` },
  { label: 'Vaddanam', te: 'వడ్డాణం', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.vaddanam}` },
  { label: 'Nallapusalu', te: 'నల్లపూసలు', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.nallapusalu}` },
  { label: 'Chokers', te: 'చోకర్లు', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.chokers}` },
  { label: 'Anti-Tarnish', te: 'యాంటీ-టార్నిష్', to: `/collections/${COLLECTION_SLUGS.antiTarnish}` },
  { label: 'AD & CZ Sets', te: 'అమెరికన్ డైమండ్', to: `/collections/${COLLECTION_SLUGS.americanDiamond}` },
  { label: 'Korean', te: 'కొరియన్', to: `/collections/${COLLECTION_SLUGS.korean}` },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const count = useCartCount()
  const openCart = useCartStore((s) => s.open)

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-primary px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-primary-ink sm:text-xs">
        Free insured delivery in 2–3 days across AP & Telangana · Extra 5% off on UPI
      </div>

      <div className="relative border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:h-20 sm:gap-3 sm:px-6">
          <button className="-ml-2 p-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="size-6" />
          </button>

          <Link to="/" className="flex min-w-0 flex-col leading-none" aria-label={`${SITE.name} home`}>
            <span className="truncate font-display text-lg font-bold tracking-wide text-primary sm:text-2xl heritage:uppercase heritage:tracking-[0.1em] sm:heritage:tracking-[0.12em]">
              Alankrita<span className="text-accent heritage:text-accent modern:text-ink-muted"> Jewels</span>
            </span>
            <span lang="te" className="mt-1 text-[10px] text-ink-muted sm:text-xs">
              {SITE.teluguName}
            </span>
          </Link>

          <nav className="ml-6 hidden flex-1 items-center gap-5 lg:flex" aria-label="Collections">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium whitespace-nowrap transition hover:text-primary',
                    isActive ? 'text-primary underline decoration-accent decoration-2 underline-offset-8' : 'text-ink-muted',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle variant="icon" className="md:hidden" />
            <a href={`tel:${SITE.phoneE164}`} className="hidden items-center gap-1.5 p-2 text-sm text-ink-muted hover:text-primary xl:flex">
              <Phone className="size-4" /> {SITE.phoneDisplay}
            </a>
            <Link to="/orders" className="hidden p-2 hover:text-primary sm:block" aria-label="My orders" title="My orders">
              <Package className="size-6" />
            </Link>
            <button onClick={() => setSearchOpen(true)} className="p-2 hover:text-primary" aria-label="Search jewellery">
              <Search className="size-6" />
            </button>
            <button onClick={openCart} className="relative p-2" aria-label={`Open bag, ${count} items`}>
              <ShoppingBag className="size-6" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        <ThemeToggle className="absolute bottom-0 left-1/2 z-10 hidden -translate-x-1/2 translate-y-1/2 md:flex" />
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Overlay open={menuOpen} onClose={() => setMenuOpen(false)} label="Menu" placement="right">
        <div className="flex h-full flex-col bg-bg">
          <div className="flex items-center justify-between border-b border-line p-4">
            <span className="font-display text-xl font-bold text-primary">Collections</span>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-2">
              <X className="size-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-3.5 hover:bg-surface-muted"
              >
                <span className="font-medium">{l.label}</span>
                <span lang="te" className="text-sm text-ink-muted">
                  {l.te}
                </span>
              </Link>
            ))}
          </nav>
          <Link
            to="/orders"
            onClick={() => setMenuOpen(false)}
            className="mx-2 mb-2 flex items-center justify-between rounded-lg border-t border-line px-3 py-3.5 hover:bg-surface-muted"
          >
            <span className="flex items-center gap-2 font-medium">
              <Package className="size-4" /> My orders
            </span>
            <span lang="te" className="text-sm text-ink-muted">
              నా ఆర్డర్లు
            </span>
          </Link>
          <ThemeToggle className="mx-4 justify-center" />
          <a href={`tel:${SITE.phoneE164}`} className="ak-btn-outline m-4">
            <Phone className="size-4" /> Call {SITE.phoneDisplay}
          </a>
        </div>
      </Overlay>
    </header>
  )
}
