import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vaskeskema – AB Værnedamsvej 11',
  description: 'Booking system for vaskekælder',
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2C5F8D',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  )
}
