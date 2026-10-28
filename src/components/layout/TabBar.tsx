import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Gem, Heart, House, Package, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/format'
import { useCartCount, useCartStore } from '@/stores/useCartStore'
import { useShopMenuStore } from '@/stores/useShopMenuStore'
import { useWishlistCount } from '@/stores/useWishlistStore'

/** Pages with their own sticky action bar (or a form needing the room) hide the tab bar on phones. */
export function showsTabBar(pathname: string) {
  return !(pathname.startsWith('/product/') || pathname === '/checkout' || pathname === '/bridal-set')
}

const TAB = 'relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-95'

function Badge({ count, tone }: { count: number; tone: 'accent' | 'rose' }) {
  if (count === 0) return null
  return (
    <span
      className={cn(
        'absolute -top-1.5 left-1/2 ml-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-bg',
        tone === 'accent' ? 'bg-accent text-accent-ink' : 'bg-rose-600 text-white',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

function TabIcon({ children, badge }: { children: ReactNode; badge?: ReactNode }) {
  return (
    <span className="relative">
      {children}
      {badge}
    </span>
  )
}

/** iOS-style bottom navigation for phones: primary actions stay within thumb reach. */
export function TabBar() {
  const { pathname } = useLocation()
  const count = useCartCount()
  const wishlistCount = useWishlistCount()
  const bagOpen = useCartStore((s) => s.isOpen)
  const openBag = useCartStore((s) => s.open)
  const shopOpen = useShopMenuStore((s) => s.isOpen)
  const openShop = useShopMenuStore((s) => s.open)

  if (!showsTabBar(pathname)) return null

  const tone = (active: boolean) => (active ? 'text-primary' : 'text-ink-muted')
  const browsing = pathname.startsWith('/collections') || pathname.startsWith('/search')

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="grid h-14 grid-cols-5">
        <NavLink to="/" end className={({ isActive }) => cn(TAB, tone(isActive && !shopOpen && !bagOpen))}>
          <House className="size-6" strokeWidth={1.8} />
          Home
        </NavLink>
        <button type="button" onClick={openShop} className={cn(TAB, tone(shopOpen || (browsing && !bagOpen)))} aria-haspopup="dialog">
          <Gem className="size-6" strokeWidth={1.8} />
          Shop
        </button>
        <NavLink
          to="/wishlist"
          className={({ isActive }) => cn(TAB, tone(isActive && !shopOpen && !bagOpen))}
          aria-label={`Wishlist, ${wishlistCount} saved`}
        >
          <TabIcon badge={<Badge count={wishlistCount} tone="rose" />}>
            <Heart className="size-6" strokeWidth={1.8} />
          </TabIcon>
          Wishlist
        </NavLink>
        <button type="button" onClick={openBag} className={cn(TAB, tone(bagOpen))} aria-label={`Bag, ${count} items`} aria-haspopup="dialog">
          <TabIcon badge={<Badge count={count} tone="accent" />}>
            <ShoppingBag className="size-6" strokeWidth={1.8} />
          </TabIcon>
          Bag
        </button>
        <NavLink to="/orders" className={({ isActive }) => cn(TAB, tone(isActive && !shopOpen && !bagOpen))}>
          <Package className="size-6" strokeWidth={1.8} />
          Orders
        </NavLink>
      </div>
    </nav>
  )
}
