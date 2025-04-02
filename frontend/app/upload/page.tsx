"use client";

import { useState, useEffect, useRef } from "react";
import { FileUpload } from "@/components/fileUpload";
import { AudioPlayer } from "@/components/audioPlayer";
import { ConversionPanel } from "@/components/conversionPanel";
import { ResultsPanel } from "@/components/resultsPanel";
import { Toaster } from "@/components/ui/sonner";
import { Music, RefreshCw, Youtube, Music2 } from "lucide-react";
import { apiFetch, getApiBaseUrl } from "@/lib/apiUtils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateScoreGeneration } from "@/lib/api-hooks";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

export default function UploadPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const createScoreMutation = useCreateScoreGeneration();
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertedFileId, setConvertedFileId] = useState<string | null>(null);
  
  // YouTube URL state
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false);
  
  // Spotify URL state
  const [spotifyUrl, setSpotifyUrl] = useState<string>("");
  const [isProcessingSpotify, setIsProcessingSpotify] = useState(false);

  // UI state
  const [step, setStep] = useState<
    "upload" | "processing-file" | "processing-youtube" | "processing-spotify" | "results"
  >("upload");
  
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

  // Helper for YouTube URL validation
  const validateYoutubeUrl = (url: string) => {
    const regex = /^(https?:\/\/)?(www\.)?(music\.youtube\.com|youtube\.com|youtu\.be)\/.+$/;
    return regex.test(url);
  };
  
  // Helper to extract YouTube video ID
  const extractYouTubeVideoId = (url: string) => {
    if (!url) return "";
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    return (match && match[2].length === 11) ? match[2] : "";
  };

  // Helper for Spotify URL validation
  const validateSpotifyUrl = (url: string) => {
    const spotifyRegex = /^(https?:\/\/)?(open\.spotify\.com\/track\/|spotify:track:)[a-zA-Z0-9]+(\?.*)?$/;
    return spotifyRegex.test(url);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setYoutubeUrl("");
    setSpotifyUrl("");
    setStep("processing-file");
    setConvertedFileId(null);
  };

  // Function to handle URL submission (YouTube or Spotify)
  const handleUrlSubmit = async (url: string) => {
    // Detect URL type for UI feedback (processing state)
    const isYoutubeUrl = url.includes("youtube.com") || url.includes("youtu.be");
    const isSpotifyUrl = url.includes("spotify.com/track/") || url.includes("spotify:track:");
    
    if (!url || (!isYoutubeUrl && !isSpotifyUrl)) {
      toast.error("Please enter a valid YouTube or Spotify URL");
      return;
    }
    
    // Set the appropriate processing state based on URL type
    if (isYoutubeUrl) {
      setIsProcessingYoutube(true);
      setYoutubeUrl(url);
      setStep("processing-youtube");
    } else {
      setIsProcessingSpotify(true);
      setSpotifyUrl(url);
      setStep("processing-spotify");
    }
    
    setSelectedFile(null);
    
    try {
      console.log("Processing URL:", url);
      
      // Call the unified URL API endpoint
      const response = await fetch(`${getApiBaseUrl()}/convert-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data && data.file_id) {
        toast.success("Audio processed successfully!");
        setConvertedFileId(data.file_id);
        setStep("results");
      } else {
        console.error("Invalid API response:", data);
        toast.error("Failed to process URL: Invalid response");
        setStep("upload");
      }
    } catch (error) {
      console.error("URL processing error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process URL");
      setStep("upload");
    } finally {
      // Reset processing states
      setIsProcessingYoutube(false);
      setIsProcessingSpotify(false);
    }
  };

  const handleConversionComplete = async (fileId: string) => {
    setConvertedFileId(fileId);
    setStep("results");
    
    // If user is authenticated, save the score generation
    if (isAuthenticated && fileId) {
      try {
        // Extract title from the file name or YouTube URL
        let title = "Score Generation";
        
        if (selectedFile) {
          title = selectedFile.name.replace(".wav", "");
        } else if (youtubeUrl) {
          // Try to extract title from YouTube URL
          title = `YouTube Score: ${new Date().toLocaleDateString()}`;
        } else if (spotifyUrl) {
          title = `Spotify Score: ${new Date().toLocaleDateString()}`;
        }

        // console.log("creating score generation");
        // console.log("title:", title);
        // console.log("fileId:", fileId);
        // console.log("youtubeUrl:", youtubeUrl);
        // console.log("spotifyUrl:", spotifyUrl);
        
        // Create the score generation
        await createScoreMutation.mutateAsync({
          title,
          file_id: fileId,
          youtube_url: youtubeUrl || undefined,
          thumbnail_url: youtubeUrl ? `https://img.youtube.com/vi/${extractYouTubeVideoId(youtubeUrl)}/0.jpg` : undefined
        });
        
        toast.success("Score saved to your collection!");
      } catch (error) {
        console.error("Failed to save score generation:", error);
        toast.error("Failed to save score to your collection");
      }
    }
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
    setYoutubeUrl("");
    setSpotifyUrl("");
    setIsProcessingYoutube(false);
    setIsProcessingSpotify(false);
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
                value={youtubeUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setYoutubeUrl(url);
                }}
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
                  onClick={() => handleUrlSubmit(youtubeUrl)}
                  disabled={!youtubeUrl || !validateYoutubeUrl(youtubeUrl) || isProcessingYoutube}
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

  // Render Spotify player and related content
  const renderSpotifySection = () => {
    if (!spotifyUrl) return null;
    
    // Extract Spotify track ID for embedding
    let trackId = "";
    if (spotifyUrl.includes("spotify.com/track/")) {
      trackId = spotifyUrl.split("spotify.com/track/")[1].split("?")[0];
    } else if (spotifyUrl.includes("spotify:track:")) {
      trackId = spotifyUrl.split("spotify:track:")[1].split("?")[0];
    }
    
    return (
      <Card className="w-full max-w-md mx-auto mb-4">
        <CardContent className="pt-6 pb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Music2 className="h-5 w-5" />
              {step === "processing-spotify" ? "Processing Spotify Track" : "Spotify Source"}
            </h3>
            
            {trackId && (
              <div className="rounded-md overflow-hidden aspect-video">
                <iframe 
                  src={`https://open.spotify.com/embed/track/${trackId}`}
                  width="100%" 
                  height="152" 
                  frameBorder="0" 
                  allow="encrypted-media"
                ></iframe>
              </div>
            )}
            
            {step === "processing-spotify" ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-primary mr-2" />
                <p className="text-sm">
                  Processing... Please wait while we download and convert the audio.
                </p>
              </div>
            ) : (
              <Button
                onClick={() => handleUrlSubmit(spotifyUrl)}
                disabled={!spotifyUrl || !validateSpotifyUrl(spotifyUrl) || isProcessingSpotify}
                className="w-full"
              >
                {isProcessingSpotify ? "Processing..." : 
                  step === "results" ? "Try Another Spotify Track" : "Convert to Sheet Music"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-12">
      <header className="text-center mb-6 sm:mb-12">
        <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4">
          <Music className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          Convert Audio to Sheet Music
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          Upload your WAV audio files or YouTube videos and convert them to sheet music with just a click
        </p>
      </header>

      <main className="max-w-full sm:max-w-md mx-auto space-y-4">
        {/* Step: Upload */}
        {step === "upload" && (
          <FileUpload 
            onFileSelect={handleFileSelect} 
            onUrlSubmit={handleUrlSubmit}
          />
        )}
        
        {/* YouTube section - always rendered when there's a YouTube URL */}
        {youtubeUrl && renderYoutubeSection()}
        
        {/* Spotify section - always rendered when there's a Spotify URL */}
        {spotifyUrl && renderSpotifySection()}
        
        {/* Step: Convert (WAV file) */}
        {selectedFile && step === "processing-file" && (
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

      <Toaster />
    </div>
  );
}
