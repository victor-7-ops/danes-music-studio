import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'Danes Music Studio',
  description: 'Rehearsal studio booking — Pardo, Cebu City',
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
