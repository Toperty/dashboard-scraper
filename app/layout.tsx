import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import localFont from "next/font/local"
// import { Analytics } from "@vercel/analytics/next"  // Temporalmente deshabilitado para pruebas
import { TooltipProvider } from "@/components/ui/tooltip"
import { AlertProvider } from "@/hooks/use-alert"
import { ConfirmProvider } from "@/hooks/use-confirm"
import { ToastProvider } from "@/hooks/use-toast"
import "./globals.css"

// Inter: solo para nav links (según DS), expuesta como var --font-inter
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

// Satoshi: workhorse corporativo (cuerpo, headings, botones), self-hosted
const satoshi = localFont({
  src: [
    { path: "../public/fonts/Satoshi-Light.otf", weight: "300", style: "normal" },
    { path: "../public/fonts/Satoshi-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/Satoshi-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/Satoshi-Bold.otf", weight: "700", style: "normal" },
    { path: "../public/fonts/Satoshi-Black.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Dashboard Scraper - Toperty",
  description: "Sistema de monitoreo y análisis de propiedades inmobiliarias",
  generator: "Toperty",
  // El favicon lo provee automáticamente app/icon.png (marca corporativa)
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${satoshi.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <AlertProvider>
          <ConfirmProvider>
            <ToastProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </ToastProvider>
          </ConfirmProvider>
        </AlertProvider>
        {/* <Analytics /> */}  {/* Temporalmente deshabilitado para pruebas */}
      </body>
    </html>
  )
}
