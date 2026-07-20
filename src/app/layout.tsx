import type { Metadata, Viewport } from 'next'
import { Big_Shoulders_Display, DM_Sans } from 'next/font/google'
import './globals.css'

const bigShoulders = Big_Shoulders_Display({
  weight: '800',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

const dmSans = DM_Sans({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

const SITE_URL = process.env.NEXT_PUBLIC_URL ?? 'https://danesmusicstudio.vercel.app'
const OG_IMAGE = `${SITE_URL}/hero/studio-session.jpg`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Danes Music Studio — Recording & Rehearsal Studio in Pardo, Cebu City',
    template: '%s — Danes Music Studio',
  },
  description:
    'Book a recording or rehearsal session at Danes Music Studio, Pardo, Cebu City. Rehearsal ₱350/hr, Recording ₱1,000/hr. Instant online booking, open daily 9 AM–10 PM.',
  keywords: [
    'recording studio Cebu',
    'rehearsal studio Cebu',
    'music studio Pardo Cebu City',
    'band practice studio Cebu',
    'audio recording Cebu',
    'Danes Music Studio',
  ],
  authors: [{ name: 'Danes Music Studio' }],
  openGraph: {
    type: 'website',
    locale: 'en_PH',
    url: SITE_URL,
    siteName: 'Danes Music Studio',
    title: 'Danes Music Studio — Recording & Rehearsal Studio in Pardo, Cebu City',
    description:
      'Book a recording or rehearsal session. Rehearsal ₱350/hr, Recording ₱1,000/hr. Instant online booking, open daily 9 AM–10 PM.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Danes Music Studio — recording session' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Danes Music Studio — Recording & Rehearsal Studio in Pardo, Cebu City',
    description: 'Book a recording or rehearsal session. Instant online booking, open daily 9 AM–10 PM.',
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B0C',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${dmSans.variable}`}>
      <body className="bg-bg text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
