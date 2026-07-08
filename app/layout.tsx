import type { Metadata } from "next"
import { Geist } from "next/font/google"
import Sidebar from "@/components/Sidebar"
import AutoBackup from "@/components/AutoBackup"
import OnboardingWizard from "@/components/OnboardingWizard"
import "./globals.css"

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EÜR-App",
  description: "Einnahmenüberschussrechnung für Einzelunternehmer",
}

// Setzt den Farbmodus vor dem ersten Paint (kein Aufblitzen des falschen Themes).
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full font-sans flex">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <AutoBackup />
        <OnboardingWizard />
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-x-auto">{children}</main>
      </body>
    </html>
  )
}
