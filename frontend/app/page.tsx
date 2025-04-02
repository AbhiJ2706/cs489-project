"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { ScoreGrid } from "@/components/scoreGrid";
import { Toaster } from "@/components/ui/sonner";
import { Music, Upload, Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScoreGenerations } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: scoreGenerations, isLoading: scoresLoading } = useScoreGenerations();
  const [activeTab, setActiveTab] = useState<"featured" | "recent">("featured");

  return (
    <>
      {/* <Navbar /> */}
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b">
          <div className="container mx-auto px-4 py-16 sm:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                {/* <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full">
                  <Music className="h-5 w-5 text-primary" />
                  <span className="ml-2 text-sm font-medium">AI-Powered Sheet Music Generation</span>
                </div> */}
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                  Convert Audio to <span className="text-primary">Sheet Music</span> in Seconds
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg">
                  Transform your audio files, YouTube videos, or Spotify tracks into beautiful, accurate sheet music with our AI-powered technology.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/upload">
                    <Button size="lg" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Start Converting
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="gap-2" onClick={() => document.getElementById('recent-scores')?.scrollIntoView({ behavior: 'smooth' })}>
                    <Play className="h-4 w-4" />
                    See Examples
                  </Button>
                </div>
              </div>
              {/* <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent z-10"></div>
                <div className="grid grid-cols-2 gap-4 transform rotate-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-[3/4] bg-muted rounded-lg overflow-hidden shadow-lg">
                      <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Music className="h-8 w-8 text-primary/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div> */}
            </div>
          </div>
        </section>

        {/* Recent Scores Section */}
        <section id="recent-scores" className="container mx-auto px-4 py-16">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight mb-4 sm:mb-0">Explore Scores</h2>
            <div className="flex items-center space-x-2">
              <Button 
                variant={activeTab === "featured" ? "default" : "outline"}
                onClick={() => setActiveTab("featured")}
                className="text-sm"
              >
                Featured
              </Button>
              <Button 
                variant={activeTab === "recent" ? "default" : "outline"}
                onClick={() => setActiveTab("recent")}
                className="text-sm"
              >
                Recent
              </Button>
            </div>
          </div>

          {/* Score Grid */}
          <ScoreGrid 
            scores={scoreGenerations || []} 
            isLoading={scoresLoading} 
            showSearch={true} 
            title=""
          />

          {/* Call to Action */}
          <div className="mt-12 text-center">
            <Link href="/upload">
              <Button size="lg" className="gap-2">
                Create Your Own <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 border-t">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Audio</h3>
              <p className="text-muted-foreground">Upload WAV files or paste YouTube/Spotify links to get started</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Processing</h3>
              <p className="text-muted-foreground">Our AI analyzes the audio and extracts musical notes and rhythms</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Sheet Music</h3>
              <p className="text-muted-foreground">Download your sheet music in various formats or share with others</p>
            </div>
          </div>
        </section>

        <footer className="container mx-auto px-4 py-8 border-t text-center">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} DaScore. All rights reserved.</p>
            <p className="text-sm text-muted-foreground">
              Made with ❤️ by{" "}
              <a href="https://x.com/abhijain2706" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Abhi</a>,{" "}
              <a href="https://x.com/onlychans1" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Eden</a>,{" "}
              <a href="https://x.com/itsraiyansayeed" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Raiyan</a> and{" "}
              <a href="https://x.com/isawamman" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Amman</a>
            </p>
          </div>
        </footer>
      </div>
      <Toaster />
    </>
  );
}
