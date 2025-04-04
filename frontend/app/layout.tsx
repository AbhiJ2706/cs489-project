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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://visualize.music'),
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
                <div className="flex h-14 items-center justify-between w-full px-0 max-w-full">
                  {/* Left: Logo and Navigation */}
                  <div className="flex items-center gap-6 pl-4">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                      <Link href="/" className="flex items-center space-x-2">
                        <Image
                          src="/darklogo.png"
                          alt="DaScore Logo"
                          width={32}
                          height={32}
                        />
                        <span className="font-bold">DaScore</span>
                      </Link>
                    </div>
                    
                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-6 text-sm">
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
                    </nav>
                  </div>
                  
                  {/* Right Side: Auth Button & Mobile Menu */}
                  <div className="flex items-center">
                    {/* Desktop Auth Button */}
                    <div className="hidden md:block pr-4">
                      <AuthButton />
                    </div>
                    
                    {/* Mobile Menu (CSS-only approach) */}
                    <div className="md:hidden relative">
                      <input type="checkbox" id="mobile-menu-toggle" className="hidden peer" />
                      <label htmlFor="mobile-menu-toggle" className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer">
                        <svg className="peer-checked:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="4" x2="20" y1="12" y2="12"></line>
                          <line x1="4" x2="20" y1="6" y2="6"></line>
                          <line x1="4" x2="20" y1="18" y2="18"></line>
                        </svg>
                        <svg className="hidden peer-checked:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18"></path>
                          <path d="m6 6 12 12"></path>
                        </svg>
                      </label>
                      <div className="fixed inset-0 top-[60px] z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 hidden peer-checked:block">
                        <div className="container py-6 px-4 flex flex-col gap-6">
                          <nav className="flex flex-col space-y-4 text-base">
                            <Link href="/" className="flex py-2 text-foreground/70 hover:text-foreground transition-colors">
                              Home
                            </Link>
                            <Link href="/upload" className="flex py-2 text-foreground/70 hover:text-foreground transition-colors">
                              Convert Audio
                            </Link>
                            <Link href="/roadmap" className="flex py-2 text-foreground/70 hover:text-foreground transition-colors">
                              Roadmap
                            </Link>
                          </nav>
                          
                          <div className="pt-4 border-t">
                            <AuthButton />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
