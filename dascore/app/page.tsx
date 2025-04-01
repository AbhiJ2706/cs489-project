"use client";

import { useState, useEffect, useRef } from "react";
import { FileUpload } from "@/components/fileUpload";
import { AudioPlayer } from "@/components/audioPlayer";
import { ConversionPanel } from "@/components/conversionPanel";
import { ResultsPanel } from "@/components/resultsPanel";
import { Toaster } from "@/components/ui/sonner";
import { Music, RefreshCw, Youtube } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

// Define the API response type for file conversion
interface ConversionResponse {
  file_id: string;
  message: string;
  has_pdf: boolean;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertedFileId, setConvertedFileId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "convert" | "results" | "processing-youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false);
  const [isValidYoutubeUrl, setIsValidYoutubeUrl] = useState<boolean>(false);
  
  // Use a single YouTube player ref to maintain state
  const youtubePlayerRef = useRef<any>(null);

  // Clear all data on page refresh
  useEffect(() => {
    return () => {
      // Clean up any file IDs when component unmounts
      if (convertedFileId) {
        apiFetch(`files/${convertedFileId}`, {
          method: "DELETE",
        }).catch(err => {
          console.error("Failed to clean up files:", err);
        });
      }
    };
  }, [convertedFileId]);

  // Validate YouTube URL
  const validateYoutubeUrl = (url: string) => {
    // Updated regex for YouTube URLs to include music.youtube.com
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(music\.youtube\.com|youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
  };

  // Handle YouTube URL change
  const handleYoutubeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    setIsValidYoutubeUrl(validateYoutubeUrl(url));
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setYoutubeUrl(null);
    setStep("convert");
    setConvertedFileId(null);
  };

  const handleYoutubeSubmit = async (url: string) => {
    if (!url || !validateYoutubeUrl(url)) {
      toast.error("Please enter a valid YouTube URL");
      return;
    }
    
    setIsProcessingYoutube(true);
    setYoutubeUrl(url);
    setSelectedFile(null);
    setStep("processing-youtube");
    
    try {
      // Normalize YouTube URL by converting music.youtube.com to youtube.com
      const normalizedUrl = url.replace('music.youtube.com', 'youtube.com');
      
      // Call the YouTube API endpoint
      const response = await apiFetch<ConversionResponse>('convert-youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      
      if (response && response.file_id) {
        toast.success("YouTube audio processed successfully!");
        setConvertedFileId(response.file_id);
        setStep("results");
      } else {
        toast.error("Failed to process YouTube URL");
        setStep("upload");
      }
    } catch (error) {
      console.error("YouTube processing error:", error);
      toast.error("Failed to process YouTube URL. Please try another video.");
      setStep("upload");
    } finally {
      setIsProcessingYoutube(false);
    }
  };

  const handleConversionComplete = (fileId: string) => {
    setConvertedFileId(fileId);
    setStep("results");
  };

  const handleReset = () => {
    // Clean up the current file ID
    if (convertedFileId) {
      apiFetch(`files/${convertedFileId}`, {
        method: "DELETE",
      }).catch(err => {
        console.error("Failed to clean up files:", err);
      });
    }
    
    setSelectedFile(null);
    setYoutubeUrl(null);
    setConvertedFileId(null);
    setIsProcessingYoutube(false);
    setStep("upload");
  };

  // Render YouTube input and player section
  const renderYoutubeSection = () => {
    if (!youtubeUrl) return null;
    
    return (
      <Card className="w-full max-w-md mx-auto mb-4">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Youtube className="h-5 w-5" />
              {step === "processing-youtube" ? "Processing YouTube Video" : "YouTube Source"}
            </h3>
            
            {/* YouTube player - never unmounted once created */}
            <div className="rounded-md overflow-hidden aspect-video">
              <ReactPlayer
                ref={youtubePlayerRef}
                url={youtubeUrl}
                width="100%"
                height="100%"
                controls={true}
              />
            </div>
            
            {/* YouTube URL input */}
            <div className="flex flex-col">
              <Input
                type="url"
                value={youtubeUrl || ""}
                onChange={handleYoutubeUrlChange}
                className="mb-2"
                placeholder="Enter YouTube URL"
                disabled={isProcessingYoutube}
              />
              
              {step === "processing-youtube" ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary mr-2" />
                  <p className="text-sm">
                    Processing... Please wait while we download and convert the audio.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => handleYoutubeSubmit(youtubeUrl || "")}
                  disabled={!youtubeUrl || !isValidYoutubeUrl || isProcessingYoutube}
                  className="w-full"
                >
                  {isProcessingYoutube ? "Processing..." : 
                    step === "results" ? "Try Another YouTube Video" : "Convert to Sheet Music"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
            Upload your WAV audio files or YouTube videos and convert them to sheet music with just a click
          </p>
        </header>

        <main className="max-w-md mx-auto space-y-4">
          {/* Step: Upload */}
          {step === "upload" && (
            <FileUpload 
              onFileSelect={handleFileSelect} 
              onYoutubeUrlSubmit={(url) => {
                setYoutubeUrl(url);
                setIsValidYoutubeUrl(validateYoutubeUrl(url));
                handleYoutubeSubmit(url);
              }} 
            />
          )}
          
          {/* YouTube section - always rendered when there's a YouTube URL */}
          {youtubeUrl && renderYoutubeSection()}
          
          {/* Step: Convert (WAV file) */}
          {selectedFile && step === "convert" && (
            <>
              <AudioPlayer file={selectedFile} />
              <ConversionPanel 
                file={selectedFile} 
                onConversionComplete={handleConversionComplete} 
              />
            </>
          )}
          
          {/* Step: Results */}
          {step === "results" && convertedFileId && (
            <ResultsPanel 
              fileId={convertedFileId} 
              originalFile={selectedFile}
              onReset={handleReset} 
            />
          )}
        </main>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 DaScore. All rights reserved.</p>
        </footer>
      </div>
      
      <Toaster />
    </div>
  );
}
