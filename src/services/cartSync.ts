import { toast } from '@/components/ui/Toaster'
import { useCartStore } from '@/stores/useCartStore'
import { fetchProductsByIds, productThumbnail } from './catalog'

/**
 * Refreshes the persisted bag against the live catalogue and tells the shopper what changed.
 * Returns true when anything in the bag changed, so checkout can ask them to review the new total.
 */
export async function syncCartWithCatalog(): Promise<boolean> {
  const ids = [...new Set(useCartStore.getState().items.map((i) => i.productId))]
  if (!ids.length) return false
  const products = await fetchProductsByIds(ids)
  const { removed, changed } = useCartStore.getState().sync(products.map((p) => ({ ...p, image: productThumbnail(p) })))
  if (removed.length) toast.error(`Removed from your bag (no longer available): ${removed.join(', ')}`)
  if (changed.length) toast.error(`Price or available quantity updated for: ${changed.join(', ')}`)
  return removed.length > 0 || changed.length > 0
}
