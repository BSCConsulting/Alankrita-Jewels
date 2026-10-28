import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Crown, Heart, Menu, Package, Phone, Search, ShoppingBag, X } from 'lucide-react'
import { COLLECTION_SLUGS, SITE } from '@/config/site'
import { cn } from '@/lib/format'
import { BRIDAL_MAX_PERCENT } from '@/lib/pricing'
import { whatsappLink } from '@/lib/whatsapp'
import { useCartCount, useCartStore } from '@/stores/useCartStore'
import { useShopMenuStore } from '@/stores/useShopMenuStore'
import { useWishlistCount } from '@/stores/useWishlistStore'
import { Overlay } from '@/components/ui/Overlay'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { SearchOverlay } from './SearchOverlay'
import { showsTabBar } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

const ICON = 'relative grid size-11 place-items-center rounded-full transition hover:text-primary active:scale-95'
const LABELLED = 'min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition hover:text-primary active:scale-95 lg:min-w-14'

export const NAV_LINKS = [
  { label: '1 Gram Gold', te: 'ఒక గ్రాము బంగారం', to: `/collections/${COLLECTION_SLUGS.oneGramGold}` },
  { label: 'Vaddanam', te: 'వడ్డాణం', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.vaddanam}` },
  { label: 'Nallapusalu', te: 'నల్లపూసలు', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.nallapusalu}` },
  { label: 'Chokers', te: 'చోకర్లు', to: `/collections/1-gram-gold/${COLLECTION_SLUGS.chokers}` },
  { label: 'Anti-Tarnish', te: 'యాంటీ-టార్నిష్', to: `/collections/${COLLECTION_SLUGS.antiTarnish}` },
  { label: 'AD & CZ Sets', te: 'అమెరికన్ డైమండ్', to: `/collections/${COLLECTION_SLUGS.americanDiamond}` },
  { label: 'Korean', te: 'కొరియన్', to: `/collections/${COLLECTION_SLUGS.korean}` },
]

/** Scroll distance (px) that collapses the delivery strip, and the one that brings it back; the gap stops flicker. */
const COMPACT_AT = 160
const EXPAND_AT = 40

function useCompactHeader() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setCompact((was) => (was ? window.scrollY > EXPAND_AT : window.scrollY > COMPACT_AT)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return compact
}

function CountBadge({ count, tone }: { count: number; tone: 'accent' | 'rose' }) {
  if (count === 0) return null
  return (
    <span
      className={cn(
        'absolute -top-1 -right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-bg',
        tone === 'accent' ? 'bg-accent text-accent-ink' : 'bg-rose-600 text-white',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname } = useLocation()
  const count = useCartCount()
  const wishlistCount = useWishlistCount()
  const openCart = useCartStore((s) => s.open)
  const menuOpen = useShopMenuStore((s) => s.isOpen)
  const openMenu = useShopMenuStore((s) => s.open)
  const closeMenu = useShopMenuStore((s) => s.close)
  const compact = useCompactHeader()
  // On phones the tab bar carries the bag; pages that hide the tab bar keep it up here.
  const bagInTabBar = showsTabBar(pathname)

  // "/" opens search from anywhere on desktop, as on most shopping sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      e.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className={cn('sticky top-0 z-40 bg-primary pt-[env(safe-area-inset-top)] transition-shadow', compact && 'shadow-md shadow-black/10')}>
      <div className={cn('grid transition-[grid-template-rows] duration-300', compact ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')} aria-hidden={compact}>
        <div className="overflow-hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-1.5 text-[11px] font-medium tracking-wide text-primary-ink sm:px-6 sm:text-xs lg:justify-between">
            <span className="hidden opacity-80 lg:block">Support {SITE.supportHours}</span>
            <span className="sm:hidden">Free 2–3 day delivery in AP & TS · Extra 5% off on UPI</span>
            <span className="hidden sm:inline">Free insured delivery in 2–3 days across AP & Telangana · Extra 5% off on UPI</span>
            <span className="hidden items-center gap-4 lg:flex">
              <a href={`tel:${SITE.phoneE164}`} tabIndex={compact ? -1 : undefined} className="flex items-center gap-1.5 hover:underline">
                <Phone className="size-3.5" /> {SITE.phoneDisplay}
              </a>
              <a
                href={whatsappLink('Hi Alankrita Jewels!')}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={compact ? -1 : undefined}
                className="flex items-center gap-1.5 hover:underline"
              >
                <WhatsAppIcon className="size-3.5" /> WhatsApp
              </a>
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-line bg-bg/95 backdrop-blur-md">
        <div className={cn('mx-auto flex max-w-7xl items-center gap-2 px-4 transition-[height] duration-300 sm:gap-3 sm:px-6', compact ? 'h-14 sm:h-16' : 'h-14 sm:h-20')}>
          <button className={cn(ICON, '-ml-2 hidden md:grid lg:hidden')} onClick={openMenu} aria-label="Open menu">
            <Menu className="size-6" />
          </button>

          <Link to="/" className="flex min-h-11 shrink-0 flex-col justify-center leading-none" aria-label={`${SITE.name} home`}>
            <span className="font-display text-lg font-bold tracking-wide whitespace-nowrap text-primary sm:text-2xl heritage:uppercase heritage:tracking-[0.1em] sm:heritage:tracking-[0.12em]">
              Alankrita<span className="text-accent heritage:text-accent modern:text-ink-muted"> Jewels</span>
            </span>
            <span lang="te" className="mt-1 text-[10px] text-ink-muted sm:text-xs">
              {SITE.teluguName}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-auto hidden h-11 w-full max-w-md min-w-0 items-center gap-3 rounded-full border border-line bg-surface px-4 text-left text-sm text-ink-muted shadow-sm transition hover:border-accent lg:flex"
            aria-label="Search jewellery"
            aria-keyshortcuts="/"
          >
            <Search className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Search vaddanam, jhumkas, chokers…</span>
            <kbd className="rounded border border-line px-1.5 font-body text-[11px]">/</kbd>
          </button>

          <div className="-mr-2 ml-auto flex shrink-0 items-center sm:gap-1 lg:ml-0">
            <ThemeToggle variant="icon" className="xl:hidden" />
            <button onClick={() => setSearchOpen(true)} className={cn(ICON, 'lg:hidden')} aria-label="Search jewellery">
              <Search className="size-6" />
            </button>
            <Link to="/orders" className={cn(LABELLED, 'hidden md:flex')} aria-label="My orders" title="My orders">
              <Package className="size-6" />
              <span className="hidden lg:block">Orders</span>
            </Link>
            <Link to="/wishlist" className={cn(LABELLED, 'hidden md:flex')} aria-label={`Wishlist, ${wishlistCount} saved`} title="Wishlist">
              <span className="relative">
                <Heart className="size-6" />
                <CountBadge count={wishlistCount} tone="rose" />
              </span>
              <span className="hidden lg:block">Wishlist</span>
            </Link>
            <button onClick={openCart} className={cn(LABELLED, bagInTabBar ? 'hidden md:flex' : 'flex')} aria-label={`Open bag, ${count} items`}>
              <span className="relative">
                <ShoppingBag className="size-6" />
                <CountBadge count={count} tone="accent" />
              </span>
              <span className="hidden lg:block">Bag</span>
            </button>
          </div>
        </div>

        <div className="hidden border-t border-line/60 lg:block">
          <div className="mx-auto flex h-11 max-w-7xl items-center gap-6 px-6">
            <nav className="flex min-w-0 flex-1 items-center justify-center gap-5 xl:gap-8" aria-label="Collections">
              {NAV_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-11 items-center text-sm font-medium whitespace-nowrap transition hover:text-primary',
                      'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-center after:bg-accent after:transition-transform hover:after:scale-x-100',
                      isActive ? 'text-primary after:scale-x-100' : 'text-ink-muted after:scale-x-0',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <NavLink
                to="/bridal-set"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap transition hover:bg-primary hover:text-primary-ink',
                    isActive ? 'border-primary bg-primary text-primary-ink' : 'border-accent/60 text-primary',
                  )
                }
              >
                <Crown className="size-4" /> Bridal Set
                <span className="hidden text-[11px] font-medium opacity-80 xl:inline">· save {BRIDAL_MAX_PERCENT}%</span>
              </NavLink>
            </nav>
            <ThemeToggle className="hidden shrink-0 xl:flex" />
          </div>
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Overlay open={menuOpen} onClose={closeMenu} label="Shop by collection" placement="right">
        <div className="flex h-full flex-col bg-bg pb-[env(safe-area-inset-bottom)] md:pt-[env(safe-area-inset-top)]">
          <div data-sheet-drag className="flex items-center justify-between border-b border-line py-3 pr-2 pl-4">
            <span className="font-display text-xl font-bold text-primary">Shop by collection</span>
            <button onClick={closeMenu} aria-label="Close menu" className={ICON}>
              <X className="size-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={closeMenu}
                className="flex min-h-12 items-center justify-between rounded-lg px-3 py-3 transition hover:bg-surface-muted active:scale-[0.98] active:bg-surface-muted"
              >
                <span className="font-medium">{l.label}</span>
                <span lang="te" className="text-sm text-ink-muted">
                  {l.te}
                </span>
              </Link>
            ))}
            <Link
              to="/bridal-set"
              onClick={closeMenu}
              className="mt-1 flex min-h-12 items-center justify-between rounded-lg border-t border-line px-3 py-3 transition hover:bg-surface-muted active:scale-[0.98] active:bg-surface-muted"
            >
              <span className="flex items-center gap-2 font-medium">
                <Crown className="size-4" /> Build a bridal set
              </span>
              <span className="text-xs font-semibold text-emerald-700">Save up to {BRIDAL_MAX_PERCENT}%</span>
            </Link>
          </nav>
          <a href={`tel:${SITE.phoneE164}`} className="ak-btn-outline m-4 mt-2">
            <Phone className="size-4" /> Call {SITE.phoneDisplay}
          </a>
        </div>
      </Overlay>
    </header>
  )
}
