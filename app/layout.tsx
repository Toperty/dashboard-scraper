import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AlertProvider } from "@/hooks/use-alert"
import { ConfirmProvider } from "@/hooks/use-confirm"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Dashboard Scraper - Toperty",
  description: "Sistema de monitoreo y análisis de propiedades inmobiliarias",
  generator: "Toperty",
  icons: {
    icon: '/logo-toperty-square.png',
    apple: '/logo-toperty-square.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`font-sans antialiased ${inter.className}`}>
        <AlertProvider>
          <ConfirmProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </ConfirmProvider>
        </AlertProvider>
        <Analytics />
      </body>
    </html>
  )
}
