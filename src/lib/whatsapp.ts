import { SITE } from '@/config/site'

export const whatsappLink = (text: string, number: string = SITE.whatsappNumber) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`

export const productEnquiryLink = (productName: string, price: number) =>
  whatsappLink(`Hi Alankrita Jewels, I am interested in ${productName} priced at ₹${price}`)

export const generalEnquiryLink = (lang: 'en' | 'te' = 'en') =>
  whatsappLink(
    lang === 'te'
      ? 'నమస్తే అలంకృత జ్యువెలర్స్, నాకు మీ ఆభరణాల గురించి సమాచారం కావాలి.'
      : 'Hi Alankrita Jewels, I would like to know more about your jewellery.',
  )
