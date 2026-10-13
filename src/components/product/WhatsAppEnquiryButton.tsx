import { cn } from '@/lib/format'
import { productEnquiryLink } from '@/lib/whatsapp'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'

interface Props {
  productName: string
  price: number
  label?: string
  className?: string
}

export function WhatsAppEnquiryButton({ productName, price, label = 'Direct WhatsApp Enquiry', className }: Props) {
  return (
    <a
      href={productEnquiryLink(productName, price)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('ak-btn-whatsapp', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <WhatsAppIcon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  )
}
