import { SITE } from '@/config/site'

export type Lang = 'en' | 'te'

export interface Faq {
  id: string
  /** Short label for the suggestion chip. */
  chip: Record<Lang, string>
  q: Record<Lang, string>
  a: Record<Lang, string>
}

type ChatText =
  | 'title'
  | 'online'
  | 'offline'
  | 'greeting'
  | 'suggestHeading'
  | 'moreHeading'
  | 'allDone'
  | 'cta'
  | 'call'
  | 'askThis'
  | 'teaser'
  | 'hours'
  | 'typing'

export const CHAT_UI: Record<Lang, Record<ChatText, string>> = {
  en: {
    title: 'Alankrita Concierge',
    online: 'Online now · replies in ~5 min',
    offline: 'Back at 10 AM · leave us a message',
    greeting: 'Namaste! 🙏 I can answer the most common questions instantly. Tap one below, or chat with our stylists on WhatsApp.',
    suggestHeading: 'Ask me about',
    moreHeading: 'Anything else?',
    allDone: 'That covers our quick answers. For anything else, our stylists are a WhatsApp message away.',
    cta: 'Chat on WhatsApp',
    call: 'Call',
    askThis: 'Ask this on WhatsApp',
    teaser: 'Questions about a piece? Ask us here.',
    hours: `${SITE.phoneDisplay} · ${SITE.supportHours}`,
    typing: 'Typing',
  },
  te: {
    title: 'అలంకృత సహాయకులు',
    online: 'ఇప్పుడు ఆన్‌లైన్ · ~5 నిమిషాల్లో సమాధానం',
    offline: 'ఉదయం 10 గంటలకు తిరిగి వస్తాము · మెసేజ్ పెట్టండి',
    greeting: 'నమస్తే! 🙏 తరచుగా అడిగే ప్రశ్నలకు వెంటనే సమాధానం ఇస్తాను. కింద ఒకటి ఎంచుకోండి, లేదా WhatsApp లో మా స్టైలిస్ట్‌లతో మాట్లాడండి.',
    suggestHeading: 'వీటి గురించి అడగండి',
    moreHeading: 'ఇంకా ఏమైనా?',
    allDone: 'త్వరిత సమాధానాలు ఇవే. ఇంకేమైనా కావాలంటే WhatsApp లో మా స్టైలిస్ట్‌లను అడగండి.',
    cta: 'WhatsApp లో చాట్ చేయండి',
    call: 'కాల్',
    askThis: 'ఈ ప్రశ్నను WhatsApp లో అడగండి',
    teaser: 'ఆభరణాల గురించి సందేహాలా? ఇక్కడ అడగండి.',
    hours: `${SITE.phoneDisplay} · ఉదయం 10 – రాత్రి 8, అన్ని రోజులు`,
    typing: 'టైప్ చేస్తున్నారు',
  },
}

export const FAQS: Faq[] = [
  {
    id: 'tarnish',
    chip: { en: 'Will it tarnish?', te: 'రంగు పోతుందా?' },
    q: {
      en: 'Does 1-gram gold jewellery tarnish or fade?',
      te: '1 గ్రాము బంగారు ఆభరణాల రంగు పోతుందా లేదా నల్లబడతాయా?',
    },
    a: {
      en: 'Our 1-gram gold pieces are micro gold plated over a copper-brass alloy and sealed with an anti-tarnish lacquer, so they keep a 22K-like glow for years with normal care. Keep them away from perfume, water and sweat, and store them in the pouch provided. If the colour ever dulls, our 1-Year Re-polishing Guarantee restores the shine.',
      te: 'మా 1 గ్రాము బంగారు ఆభరణాలు రాగి-ఇత్తడి మిశ్రమంపై మైక్రో గోల్డ్ ప్లేటింగ్ మరియు యాంటీ-టార్నిష్ లక్కర్ పూతతో తయారవుతాయి. సరైన జాగ్రత్తతో ఏళ్ల తరబడి 22K బంగారు మెరుపు నిలిచి ఉంటుంది. పెర్ఫ్యూమ్, నీరు, చెమట నుండి దూరంగా ఉంచి, మేము ఇచ్చే పౌచ్‌లో భద్రపరచండి. రంగు తగ్గితే, మా 1 సంవత్సరం రీ-పాలిషింగ్ గ్యారంటీ ద్వారా మెరుపును తిరిగి తెస్తాము.',
    },
  },
  {
    id: 'shower',
    chip: { en: 'Waterproof for daily wear?', te: 'రోజూ ధరించవచ్చా?' },
    q: {
      en: 'Can I wear anti-tarnish jewellery daily, even in the shower?',
      te: 'యాంటీ-టార్నిష్ ఆభరణాలను రోజూ, స్నానం చేసేటప్పుడు కూడా ధరించవచ్చా?',
    },
    a: {
      en: 'Yes! Our anti-tarnish range is 316L surgical stainless steel with PVD (Physical Vapour Deposition) gold coating. The colour is bonded at a molecular level, so it is waterproof, sweat-proof and hypoallergenic — shower, gym and swim friendly. Just avoid harsh chemicals like bleach.',
      te: 'అవును! మా యాంటీ-టార్నిష్ ఆభరణాలు 316L సర్జికల్ స్టెయిన్‌లెస్ స్టీల్‌పై PVD (ఫిజికల్ వేపర్ డిపాజిషన్) గోల్డ్ కోటింగ్‌తో తయారవుతాయి. రంగు లోహంలో కలిసిపోయి ఉంటుంది కాబట్టి ఇవి వాటర్‌ప్రూఫ్, చెమటకు చెడిపోవు, చర్మానికి హాని చేయవు — స్నానం, జిమ్, ఈత అన్నింటికీ సరే. బ్లీచ్ వంటి కఠిన రసాయనాలకు మాత్రం దూరంగా ఉంచండి.',
    },
  },
  {
    id: 'delivery',
    chip: { en: 'Delivery time', te: 'డెలివరీ సమయం' },
    q: {
      en: 'How long does delivery take in AP & Telangana?',
      te: 'ఆంధ్రప్రదేశ్ & తెలంగాణలో డెలివరీకి ఎంత సమయం పడుతుంది?',
    },
    a: {
      en: 'Orders are dispatched within 24 hours by insured courier. Delivery takes 2–3 business days across Andhra Pradesh & Telangana (Hyderabad, Vijayawada, Vizag, Guntur, Warangal and more) and 4–7 business days for the rest of India. You get a WhatsApp tracking link as soon as it ships.',
      te: 'ఆర్డర్‌లు 24 గంటల్లో ఇన్సూర్డ్ కొరియర్ ద్వారా పంపబడతాయి. ఆంధ్రప్రదేశ్ & తెలంగాణ (హైదరాబాద్, విజయవాడ, వైజాగ్, గుంటూరు, వరంగల్ మొదలైనవి) అంతటా 2–3 పని దినాల్లో, మిగతా భారతదేశానికి 4–7 పని దినాల్లో డెలివరీ అవుతుంది. షిప్ అయిన వెంటనే WhatsApp లో ట్రాకింగ్ లింక్ పంపిస్తాము.',
    },
  },
  {
    id: 'partial-cod',
    chip: { en: 'Cash on delivery', te: 'క్యాష్ ఆన్ డెలివరీ' },
    q: {
      en: 'Do you have cash on delivery?',
      te: 'క్యాష్ ఆన్ డెలివరీ ఉందా?',
    },
    a: {
      en: 'Yes. Full cash on delivery is available on orders up to ₹5,999 with a ₹49 handling fee — pay the courier in cash or UPI. Or choose Partial COD: pay just ₹150 online now to reserve your piece (no handling fee) and the balance on delivery. Paying fully by UPI gets you an extra 5% off.',
      te: 'అవును. ₹5,999 వరకు ఆర్డర్‌లకు ₹49 హ్యాండ్లింగ్ ఫీజుతో పూర్తి క్యాష్ ఆన్ డెలివరీ అందుబాటులో ఉంది — కొరియర్‌కు క్యాష్ లేదా UPI ద్వారా చెల్లించండి. లేదా పార్షియల్ COD ఎంచుకోండి: ఇప్పుడు కేవలం ₹150 ఆన్‌లైన్‌లో చెల్లించి మీ ఆభరణాన్ని రిజర్వ్ చేసుకోండి (హ్యాండ్లింగ్ ఫీజు లేదు), మిగిలినది డెలివరీలో. పూర్తిగా UPI ద్వారా చెల్లిస్తే అదనంగా 5% తగ్గింపు.',
    },
  },
  {
    id: 'returns',
    chip: { en: 'Returns & damage', te: 'రిటర్న్ & డ్యామేజ్' },
    q: {
      en: 'What is your return & damage policy?',
      te: 'రిటర్న్ & డ్యామేజ్ పాలసీ ఏమిటి?',
    },
    a: {
      en: 'If your piece arrives damaged or incorrect, WhatsApp us within 48 hours of delivery with a continuous, unedited unboxing video — from the sealed parcel to the product. The unboxing video is mandatory; we replace or refund only with it. For hygiene reasons, earrings and nose pins are not returnable unless damaged.',
      te: 'మీ ఆభరణం దెబ్బతిని లేదా తప్పుగా వస్తే, డెలివరీ అయిన 48 గంటల్లోపు సీల్ చేసిన పార్సెల్ తెరిచినప్పటి నుండి ఆభరణం వరకు ఎడిట్ చేయని నిరంతర అన్‌బాక్సింగ్ వీడియోతో WhatsApp లో మాకు తెలియజేయండి. అన్‌బాక్సింగ్ వీడియో తప్పనిసరి — అది ఉంటేనే రీప్లేస్‌మెంట్ లేదా రీఫండ్ ఇస్తాము. పరిశుభ్రత కారణంగా, దెబ్బతిన్నవి తప్ప చెవి పోగులు మరియు ముక్కు పుడకలు రిటర్న్ చేయబడవు.',
    },
  },
  {
    id: 'talk',
    chip: { en: 'Talk to a stylist', te: 'స్టైలిస్ట్‌తో మాట్లాడాలి' },
    q: {
      en: 'Can I talk to someone directly?',
      te: 'నేరుగా ఎవరితోనైనా మాట్లాడవచ్చా?',
    },
    a: {
      en: `Of course! Chat with our styling team on WhatsApp or call ${SITE.phoneDisplay} (${SITE.supportHours}). Send a photo of your saree or outfit and we'll suggest the perfect match.`,
      te: `తప్పకుండా! మా స్టైలింగ్ టీమ్‌తో WhatsApp లో చాట్ చేయండి లేదా ${SITE.phoneDisplay} కు కాల్ చేయండి (ఉదయం 10 – రాత్రి 8, అన్ని రోజులు). మీ చీర లేదా డ్రెస్ ఫోటో పంపితే, సరిపోయే ఆభరణాన్ని సూచిస్తాము.`,
    },
  },
]
