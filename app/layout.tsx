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
 * Свежий HTML при каждом запросе — после деплоя не залипают старые хэши `/_next/static/*` (сломанные стили/500).
 * Статический экспорт (GitHub Pages) собирается отдельным workflow без этого файла или с тем же значением — см. проверку CI.
 */
export const revalidate = 0

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="dark h-full w-full max-w-none" suppressHydrationWarning>
      <body
        className={`${_inter.className} font-sans antialiased bg-background text-foreground w-full min-w-0 max-w-none`}
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
