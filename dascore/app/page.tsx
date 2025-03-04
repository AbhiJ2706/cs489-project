"use client";

import { useState, useEffect } from "react";
import { FileUpload } from "@/components/fileUpload";
import { AudioPlayer } from "@/components/audioPlayer";
import { ConversionPanel } from "@/components/conversionPanel";
import { ResultsPanel } from "@/components/resultsPanel";
import { Toaster } from "@/components/ui/sonner";
import { Music } from "lucide-react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertedFileId, setConvertedFileId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "convert" | "results">("upload");

  // Clear all data on page refresh
  useEffect(() => {
    return () => {
      // Clean up any file IDs when component unmounts
      if (convertedFileId) {
        fetch(`http://localhost:8000/files/${convertedFileId}`, {
          method: "DELETE",
        }).catch(err => {
          console.error("Failed to clean up files:", err);
        });
      }
    };
  }, [convertedFileId]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setStep("convert");
    setConvertedFileId(null);
  };

  const handleConversionComplete = (fileId: string) => {
    setConvertedFileId(fileId);
    setStep("results");
  };

  const handleReset = () => {
    // Clean up the current file ID
    if (convertedFileId) {
      fetch(`http://localhost:8000/files/${convertedFileId}`, {
        method: "DELETE",
      }).catch(err => {
        console.error("Failed to clean up files:", err);
      });
    }
    
    setSelectedFile(null);
    setConvertedFileId(null);
    setStep("upload");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4">
            <Music className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            DaScore
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Upload your WAV audio files and convert them to sheet music with just a click
          </p>
        </header>

        <main className="max-w-md mx-auto space-y-8">
          {step === "upload" && (
            <FileUpload onFileSelect={handleFileSelect} />
          )}
          
          {selectedFile && step === "convert" && (
            <>
              <AudioPlayer file={selectedFile} />
              <ConversionPanel 
                file={selectedFile} 
                onConversionComplete={handleConversionComplete} 
              />
            </>
          )}
          
          {step === "results" && convertedFileId && (
            <ResultsPanel 
              fileId={convertedFileId} 
              onReset={handleReset} 
            />
          )}
        </main>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>© 2024 DaScore. All rights reserved.</p>
        </footer>
      </div>
      
      <Toaster />
    </div>
  );
}
