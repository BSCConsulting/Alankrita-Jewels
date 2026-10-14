import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { toast } from '@/components/ui/Toaster'
import { WhatsAppChatbot } from '@/components/whatsapp/WhatsAppChatbot'
import { fetchProductsByIds, productThumbnail } from '@/services/catalog'
import { useCartStore } from '@/stores/useCartStore'
import { Footer } from './Footer'
import { Header } from './Header'

export function StoreLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  // The bag is persisted in localStorage, so prices, photos and stock can be stale on a return visit.
  useEffect(() => {
    const ids = useCartStore.getState().items.map((i) => i.productId)
    if (!ids.length) return
    fetchProductsByIds([...new Set(ids)])
      .then((products) => {
        const { removed } = useCartStore.getState().sync(
          products.map((p) => ({ ...p, image: productThumbnail(p) })),
        )
        if (removed.length) toast.error(`Removed from your bag (no longer available): ${removed.join(', ')}`)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppChatbot />
    </div>
  )
}
