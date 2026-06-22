import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Danes Music Studio',
  description: 'Rehearsal studio booking — Pardo, Cebu City',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
