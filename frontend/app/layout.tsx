import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react"
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";
import { Music } from "lucide-react";
import Image from "next/image";
import { ClerkProviderWrapper } from "../components/auth/ClerkProviderWrapper";
import { AuthButton } from "../components/auth/AuthComponent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DaScore | Audio to Sheet Music Converter",
  description: "Turn your audio into sheet music. Convert WAV files, YouTube videos, and Spotify tracks to sheet music with signal processing.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
    ]
  },
  openGraph: {
    title: "DaScore | Transform Audio into Beautiful Sheet Music",
    description: "Turn your audio into sheet music instantly. Upload WAV files or convert YouTube videos and Spotify tracks to professional sheet music with AI technology.",
    url: "https://visualize.music",
    siteName: "DaScore",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png", 
        width: 1200,
        height: 630,
        alt: "DaScore - Audio to Sheet Music Converter"
      }
    ],
  },
  twitter: {
    title: "DaScore | Transform Audio into Beautiful Sheet Music",
    description: "Turn your audio into sheet music instantly. Upload WAV files or convert YouTube videos and Spotify tracks to professional sheet music with AI technology.",
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Analytics />
        <ClerkProviderWrapper>
          <Providers>
            <div className="relative flex min-h-screen flex-col">
              {/* Global Navigation Header */}
              <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
                <div className="container flex h-14 items-center px-4">
                  <div className="mr-4 flex">
                    <Link href="/" className="flex items-center space-x-2">
                      <Image 
                        src="/darklogo.svg" 
                        alt="DaScore Logo" 
                        width={32} 
                        height={32} 
                      />
                      <span className="font-bold">DaScore</span>
                    </Link>
                  </div>
                  <nav className="flex flex-1 items-center justify-between">
                    <div className="flex items-center gap-6 text-sm">
                      <Link 
                        href="/" 
                        className="transition-colors hover:text-foreground/80 text-foreground/60 hover:text-foreground"
                      >
                        Home
                      </Link>
                      <Link 
                        href="/upload" 
                        className="transition-colors hover:text-foreground/80 text-foreground/60 hover:text-foreground"
                      >
                        Convert Audio
                      </Link>
                      <Link 
                        href="/roadmap" 
                        className="transition-colors hover:text-foreground/80 text-foreground/60 hover:text-foreground"
                      >
                        Roadmap
                      </Link>
                    </div>
                    <div className="ml-auto">
                      <AuthButton />
                    </div>
                  </nav>
                </div>
              </header>
              <div className="flex-1">
                {children}
              </div>
            </div>
          </Providers>
        </ClerkProviderWrapper>
      </body>
    </html>
  );
}
