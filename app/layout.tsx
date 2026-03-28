import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const _inter = Inter({ subsets: ["latin", "cyrillic"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spindate.lemnity.ru"

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Целуй и знакомься — Игра в бутылочку',
  description: 'Онлайн-игра в бутылочку для знакомств в VK Mini App',
  openGraph: {
    url: appUrl,
    siteName: 'Spindate',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#e8457c',
  viewportFit: 'cover',
}

/**
 * Не использовать `revalidate = 0` в корневом layout: при `output: "export"` (GitHub Pages) страница
 * становится динамической и **в out/ не попадает index.html** → на Pages отдаётся 404.
 * Свежий HTML на VPS после деплоя обеспечивает `Cache-Control: no-store` для `/` в next.config.mjs.
 */
export const revalidate = false

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="dark h-full w-full max-w-none" suppressHydrationWarning>
      <body
        className={`${_inter.className} font-sans antialiased bg-background text-foreground h-full min-h-0 w-full min-w-0 max-w-none`}
        data-build={process.env.NEXT_PUBLIC_BUILD_ID || undefined}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
