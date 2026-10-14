import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bio Cell – Prontuário e Estoque",
  description: "Sistema de prontuário eletrônico e controle de estoque de células-tronco",
  applicationName: "Bio Cell",
  // iPhone: abre em tela cheia quando adicionado à tela inicial
  appleWebApp: { capable: true, title: "Bio Cell", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1e5a28",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
