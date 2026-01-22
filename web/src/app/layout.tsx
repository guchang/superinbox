import type { Metadata, Viewport } from 'next'
import { Inter, Outfit, DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Login page fonts with display swap for better performance
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  preload: true,
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: 'SuperInbox - 智能收件箱管理后台',
  description: '统一管理你的数字信息收件箱',
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} ${outfit.variable} ${dmSans.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
