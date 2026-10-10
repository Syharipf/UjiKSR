import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import { themeScript } from '@/lib/theme'
import './globals.css'

// Archivo (OFL, app/fonts/Archivo-OFL.txt), self-hosted so builds don't depend on Google Fonts.
// Variable weight and width: headings use the expanded cut (.display in globals.css), body text the normal one.
const archivo = localFont({
  src: './fonts/archivo-variable.woff2',
  weight: '100 900',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  variable: '--font-archivo',
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#c8102e' },
    { media: '(prefers-color-scheme: dark)', color: '#a30e26' },
  ],
}

export const metadata: Metadata = {
  title: 'UjiKSR',
  description: 'Pre-test dan post-test KSR PMI Unit Universitas Telkom',
  verification: { google: 'VzgwJR0IT679WZlL3qKO3qYhnjBjQr-xAH608PUysN4' }, // Google Search Console
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: themeScript may set data-theme before React hydrates.
    <html lang="id" suppressHydrationWarning className={archivo.variable}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-page text-fg antialiased">
        {/* Shown only where globals.css says the browser is below Next.js' baseline (Chrome 111 / Safari 16.4). */}
        <p className="old-browser-note" style={{ margin: 0, padding: 12, background: '#fef3c7', color: '#111', textAlign: 'center', fontSize: 14 }}>
          Browser ini terlalu lama, ujian mungkin tidak berjalan. Perbarui Chrome/Safari, atau pakai HP lain.
        </p>
        {children}
      </body>
    </html>
  )
}
