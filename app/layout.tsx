import type { Metadata } from "next"
import { Geist } from "next/font/google"
import Sidebar from "@/components/Sidebar"
import "./globals.css"

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EÜR-App",
  description: "Einnahmenüberschussrechnung für Einzelunternehmer",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans flex">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-x-auto">{children}</main>
      </body>
    </html>
  )
}
