import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Crown, Heart, Menu, Package, Phone, Search, ShoppingBag, X } from 'lucide-react'
import { COLLECTION_SLUGS, SITE } from '@/config/site'
import { cn } from '@/lib/format'
import { BRIDAL_MAX_PERCENT } from '@/lib/pricing'
import { useCartCount, useCartStore } from '@/stores/useCartStore'
import { useShopMenuStore } from '@/stores/useShopMenuStore'
import { useWishlistCount } from '@/stores/useWishlistStore'
import { Overlay } from '@/components/ui/Overlay'
import { SearchOverlay } from './SearchOverlay'
import { showsTabBar } from './TabBar'
import { ThemeToggle } from './ThemeToggle'

const ICON = 'relative grid size-11 place-items-center rounded-full transition hover:text-primary active:scale-95'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname } = useLocation()
  const count = useCartCount()
  const wishlistCount = useWishlistCount()
  const openCart = useCartStore((s) => s.open)
  const menuOpen = useShopMenuStore((s) => s.isOpen)
  const openMenu = useShopMenuStore((s) => s.open)
  const closeMenu = useShopMenuStore((s) => s.close)
  // On phones the tab bar carries the bag; pages that hide the tab bar keep it up here.
  const bagInTabBar = showsTabBar(pathname)

  return (
    <header className="sticky top-0 z-40 bg-primary pt-[env(safe-area-inset-top)]">
      <div className="px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-primary-ink sm:text-xs">
        <span className="sm:hidden">Free 2–3 day delivery in AP & TS · Extra 5% off on UPI</span>
        <span className="hidden sm:inline">Free insured delivery in 2–3 days across AP & Telangana · Extra 5% off on UPI</span>
      </div>

      <div className="relative border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-20 sm:gap-3 sm:px-6">
          <button className={cn(ICON, '-ml-2 hidden md:grid lg:hidden')} onClick={openMenu} aria-label="Open menu">
            <Menu className="size-6" />
          </button>

          <Link to="/" className="flex min-h-11 min-w-0 flex-col justify-center leading-none" aria-label={`${SITE.name} home`}>
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

          <div className="-mr-2 ml-auto flex shrink-0 items-center sm:gap-1">
            <ThemeToggle variant="icon" className="md:hidden" />
            <a href={`tel:${SITE.phoneE164}`} className="hidden items-center gap-1.5 p-2 text-sm text-ink-muted hover:text-primary xl:flex">
              <Phone className="size-4" /> {SITE.phoneDisplay}
            </a>
            <Link to="/orders" className={cn(ICON, 'hidden md:grid')} aria-label="My orders" title="My orders">
              <Package className="size-6" />
            </Link>
            <Link to="/wishlist" className={cn(ICON, 'hidden md:grid')} aria-label={`Wishlist, ${wishlistCount} saved`} title="Wishlist">
              <Heart className="size-6" />
              {wishlistCount > 0 && (
                <span className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button onClick={() => setSearchOpen(true)} className={ICON} aria-label="Search jewellery">
              <Search className="size-6" />
            </button>
            <button onClick={openCart} className={cn(ICON, bagInTabBar && 'hidden md:grid')} aria-label={`Open bag, ${count} items`}>
              <ShoppingBag className="size-6" />
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        <ThemeToggle className="absolute bottom-0 left-1/2 z-10 hidden -translate-x-1/2 translate-y-1/2 md:flex" />
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
