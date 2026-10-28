import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { WhatsAppChatbot } from '@/components/whatsapp/WhatsAppChatbot'
import { track } from '@/lib/analytics'
import { loadClarity } from '@/lib/clarity'
import { syncCartWithCatalog } from '@/services/cartSync'
import { Footer } from './Footer'
import { Header } from './Header'

export function StoreLayout() {
  useEffect(() => {
    track('page_view')
    loadClarity()
  }, [])
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  // The bag is persisted in localStorage, so prices, photos and stock can be stale on a return visit.
  useEffect(() => {
    syncCartWithCatalog().catch(() => {})
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
