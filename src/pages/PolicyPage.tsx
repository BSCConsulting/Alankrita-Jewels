import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { BUSINESS, PAYMENT_RULES, SITE } from '@/config/site'
import { useSeo } from '@/lib/seo'
import { whatsappLink } from '@/lib/whatsapp'
import NotFoundPage from './NotFoundPage'

interface Policy {
  title: string
  description: string
  sections: Array<{ heading: string; body: ReactNode }>
}

const UPDATED = '14 October 2026'

const waLink = (text: string) => (
  <a href={whatsappLink('Hi Alankrita Jewels!')} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
    {text}
  </a>
)

const POLICIES: Record<string, Policy> = {
  shipping: {
    title: 'Shipping Policy',
    description: 'Free insured shipping across India. Dispatch within 24 hours, 2–3 day delivery in Andhra Pradesh & Telangana.',
    sections: [
      {
        heading: 'Dispatch',
        body: <p>Orders are quality checked, packed and handed to an insured courier within 24 hours of payment confirmation (Partial COD orders: after the advance is received).</p>,
      },
      {
        heading: 'Delivery time',
        body: (
          <ul>
            <li>Andhra Pradesh & Telangana (Hyderabad, Vijayawada, Visakhapatnam, Guntur, Warangal and more): 2–3 business days.</li>
            <li>Rest of India: 4–7 business days.</li>
            <li>Remote pincodes, public holidays and weather can add a day or two.</li>
          </ul>
        ),
      },
      {
        heading: 'Shipping charges',
        body: <p>Shipping is free and insured on every order. Prices shown are inclusive of GST.</p>,
      },
      {
        heading: 'Tracking',
        body: <p>As soon as your parcel ships, we send the courier name and tracking link on WhatsApp to the mobile number used at checkout.</p>,
      },
      {
        heading: 'Partial COD',
        body: (
          <p>
            With Partial COD you pay ₹{PAYMENT_RULES.partialCodAdvance} online to reserve your piece and pay the balance in cash or UPI to the courier on delivery. Full cash on delivery is not
            available.
          </p>
        ),
      },
    ],
  },
  returns: {
    title: 'Returns, Damage & Refund Policy',
    description: 'Damaged or incorrect items are replaced or refunded when reported within 48 hours with an unedited unboxing video.',
    sections: [
      {
        heading: 'Damaged or incorrect items',
        body: (
          <p>
            If your piece arrives damaged or is not what you ordered, message us on {waLink('WhatsApp')} within 48 hours of delivery. Please share a continuous, unedited unboxing video — from the
            sealed parcel to the product. The video is mandatory for every damage or wrong-item claim.
          </p>
        ),
      },
      {
        heading: 'What we offer',
        body: <p>Once the claim is verified we send a replacement of the same piece, or a full refund if it is out of stock. Return pickup is arranged by us at no cost to you.</p>,
      },
      {
        heading: 'Items that cannot be returned',
        body: <p>For hygiene reasons, earrings and nose pins cannot be returned unless they arrive damaged. Change-of-mind returns are not accepted.</p>,
      },
      {
        heading: 'Cancellations',
        body: <p>You can cancel an order any time before it is dispatched by messaging us on WhatsApp. Any amount you have paid is refunded in full.</p>,
      },
      {
        heading: 'Refund timeline',
        body: <p>Approved refunds are sent to the original payment method or UPI ID within 1–2 business days. Your bank may take a few more days to show the credit.</p>,
      },
      {
        heading: '1-Year Re-polishing Guarantee',
        body: <p>If the colour of a 1 gram gold piece dulls within a year of purchase, send it to us and we will re-polish it. Message us on WhatsApp to arrange it.</p>,
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Alankrita Jewels collects, uses and protects your personal information.',
    sections: [
      {
        heading: 'What we collect',
        body: (
          <ul>
            <li>Your mobile number, verified by a one-time password (OTP) at checkout.</li>
            <li>Your name and delivery address.</li>
            <li>Your order details and payment status. We never see or store your card, UPI PIN or bank login.</li>
          </ul>
        ),
      },
      {
        heading: 'How we use it',
        body: <p>Only to process and deliver your orders, send order and tracking updates by SMS or WhatsApp, handle returns, and answer your questions. We do not sell or rent your information.</p>,
      },
      {
        heading: 'Who we share it with',
        body: (
          <ul>
            <li>Courier partners (such as Shiprocket and Delhivery) — name, phone and address, to deliver your parcel.</li>
            <li>Payment gateway (Razorpay, when online payment is enabled) — to process your payment securely.</li>
            <li>Service providers that run the store: Supabase (secure database hosting), Google Firebase (phone OTP verification) and Cloudflare (website hosting).</li>
          </ul>
        ),
      },
      {
        heading: 'Cookies and storage on your device',
        body: <p>We store your shopping bag, theme choice and sign-in session in your browser so the site works between visits. We do not use advertising trackers.</p>,
      },
      {
        heading: 'Retention and your rights',
        body: (
          <p>
            Order records are kept as required by Indian tax and consumer laws. You can ask us to see, correct or delete your personal information at any time by messaging us on{' '}
            {waLink('WhatsApp')} or calling {SITE.phoneDisplay}.
          </p>
        ),
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    description: 'Terms for shopping on the Alankrita Jewels website.',
    sections: [
      {
        heading: 'About our jewellery',
        body: (
          <p>
            Alankrita Jewels sells fashion jewellery: 1 gram gold (micro gold plated over a copper-brass alloy), American diamond / CZ, and anti-tarnish PVD-coated stainless steel. These are not
            solid gold or real diamonds unless a product page clearly says otherwise.
          </p>
        ),
      },
      {
        heading: 'Product images',
        body: <p>We try to show every piece accurately. Colours can look slightly different on different screens, and some listings use representative images; the piece you receive may vary slightly in design and finish.</p>,
      },
      {
        heading: 'Prices and payment',
        body: (
          <p>
            All prices are in Indian Rupees and include GST. Online UPI payment gets an extra {Math.round(PAYMENT_RULES.prepaidDiscountRate * 100)}% discount. Partial COD orders need a ₹
            {PAYMENT_RULES.partialCodAdvance} advance, adjusted in the final bill. An order is confirmed once payment (or the Partial COD advance) is received.
          </p>
        ),
      },
      {
        heading: 'Availability',
        body: (
          <p>
            Stock is reserved when you place an order. Orders not paid within {PAYMENT_RULES.unpaidHoldHours} hours are cancelled automatically and the
            pieces are released. If a piece becomes unavailable after you pay, we will contact you and offer an alternative or a full refund.
          </p>
        ),
      },
      {
        heading: 'Shipping, returns and privacy',
        body: (
          <p>
            Please read our{' '}
            <Link to="/policies/shipping" className="font-semibold text-primary underline">
              Shipping
            </Link>
            ,{' '}
            <Link to="/policies/returns" className="font-semibold text-primary underline">
              Returns & Damage
            </Link>{' '}
            and{' '}
            <Link to="/policies/privacy" className="font-semibold text-primary underline">
              Privacy
            </Link>{' '}
            policies, which form part of these terms.
          </p>
        ),
      },
      {
        heading: 'Governing law',
        body: <p>These terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts at Hyderabad, Telangana.</p>,
      },
    ],
  },
}

export default function PolicyPage({ slug: fixedSlug }: { slug?: 'contact' }) {
  const params = useParams()
  const slug = fixedSlug ?? params.slug ?? ''
  const policy = POLICIES[slug]
  const isContact = slug === 'contact'

  useSeo({
    title: isContact ? 'Contact Us' : (policy?.title ?? 'Page not found'),
    description: isContact ? `Call or WhatsApp ${SITE.name} on ${SITE.phoneDisplay}, ${SITE.supportHours}.` : policy?.description,
    path: isContact ? '/contact' : `/policies/${slug}`,
  })

  if (!isContact && !policy) return <NotFoundPage />

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-bold text-primary">{isContact ? 'Contact Us' : policy.title}</h1>
      {!isContact && <p className="mt-2 text-sm text-ink-muted">Last updated {UPDATED}</p>}

      {isContact ? <ContactDetails /> : (
        <div className="mt-8 space-y-8">
          {policy.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-2xl font-semibold">{s.heading}</h2>
              <div className="mt-2 space-y-2 leading-relaxed text-ink-muted [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{s.body}</div>
            </section>
          ))}
        </div>
      )}

      {!isContact && (
        <p className="mt-12 rounded-xl bg-surface-muted p-5 text-sm">
          Questions? Message us on {waLink('WhatsApp')} or call{' '}
          <a href={`tel:${SITE.phoneE164}`} className="font-semibold text-primary underline">
            {SITE.phoneDisplay}
          </a>{' '}
          ({SITE.supportHours}).
        </p>
      )}
    </div>
  )
}

function ContactDetails() {
  return (
    <div className="mt-8 space-y-6">
      <p className="text-ink-muted">The quickest way to reach us is WhatsApp — our team typically replies within minutes during support hours.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={whatsappLink('Hi Alankrita Jewels!')} target="_blank" rel="noopener noreferrer" className="ak-btn-whatsapp py-3.5">
          <WhatsAppIcon className="size-5" /> Chat on WhatsApp
        </a>
        <a href={`tel:${SITE.phoneE164}`} className="ak-btn-outline py-3.5">
          <Phone className="size-5" /> Call {SITE.phoneDisplay}
        </a>
      </div>
      <dl className="ak-card divide-y divide-line text-sm">
        <Row icon={<Clock className="size-4" />} label="Support hours" value={SITE.supportHours} />
        {BUSINESS.email && <Row icon={<Mail className="size-4" />} label="Email" value={<a href={`mailto:${BUSINESS.email}`} className="underline">{BUSINESS.email}</a>} />}
        <Row icon={<MapPin className="size-4" />} label="Seller" value={[BUSINESS.legalName, BUSINESS.address].filter(Boolean).join(', ')} />
        {BUSINESS.gstin && <Row label="GSTIN" value={BUSINESS.gstin} />}
        {BUSINESS.grievanceOfficer && <Row label="Grievance officer" value={BUSINESS.grievanceOfficer} />}
      </dl>
      <p className="text-sm text-ink-muted">
        For order issues, please keep your order number handy. Damage claims need an unedited unboxing video shared within 48 hours of delivery — see our{' '}
        <Link to="/policies/returns" className="font-semibold text-primary underline">
          returns policy
        </Link>
        .
      </p>
    </div>
  )
}

function Row({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 p-4">
      <span className="mt-0.5 text-primary">{icon}</span>
      <dt className="w-32 shrink-0 font-semibold">{label}</dt>
      <dd className="text-ink-muted">{value}</dd>
    </div>
  )
}
