import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { WhatsAppChatbot } from '@/components/whatsapp/WhatsAppChatbot'
import { Footer } from './Footer'
import { Header } from './Header'

export function StoreLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

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
