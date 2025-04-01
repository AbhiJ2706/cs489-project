"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Music, Upload, AlertCircle, Youtube, Music2, Link } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

// Maximum file size in bytes (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onUrlSubmit?: (url: string) => void;
}

export function FileUpload({ onFileSelect, onUrlSubmit }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL related state
  const [url, setUrl] = useState<string>("");
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlType, setUrlType] = useState<"youtube" | "spotify" | null>(null);
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) return;

    // Validate file type
    if (!file.type.includes("audio/wav") && !file.name.toLowerCase().endsWith(".wav")) {
      setError("Please upload a WAV file only");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds the limit of 100MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);

    // Simulate upload progress
    simulateUpload();
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          toast.success("File uploaded successfully!");
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Detect URL type and validate it
  const validateUrl = (inputUrl: string) => {
    // YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(music\.youtube\.com|youtube\.com|youtu\.be)\/.+$/;
    if (youtubeRegex.test(inputUrl)) {
      setUrlType("youtube");
      return true;
    }
    
    // Spotify URL validation
    const spotifyRegex = /^(https?:\/\/)?(open\.spotify\.com\/track\/|spotify:track:)[a-zA-Z0-9]+(\?.*)?$/;
    if (spotifyRegex.test(inputUrl)) {
      setUrlType("spotify");
      return true;
    }
    
    setUrlType(null);
    return false;
  };

  // Handle URL change
  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setIsValidUrl(validateUrl(inputUrl));
    setUrlError(null);
  };

  // Handle URL submit
  const handleUrlSubmit = async () => {
    if (!isValidUrl) {
      setUrlError("Please enter a valid YouTube or Spotify URL");
      return;
    }
    
    setIsProcessingUrl(true);
    setUrlError(null);
    
    try {
      if (onUrlSubmit) {
        onUrlSubmit(url);
      }
    } catch (error) {
      setUrlError("Failed to process URL. Please try again.");
      console.error("URL processing error:", error);
    } finally {
      // Don't set isProcessingUrl to false here, since the caller will handle success/failure
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Upload Audio
        </CardTitle>
        <CardDescription>
          Upload a WAV file or provide a YouTube/Spotify URL
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="file" className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={triggerFileInput}
            >
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                WAV files only (max 100MB)
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".wav,audio/wav"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {selectedFile && !isUploading && (
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="url" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="url-input" className="text-sm font-medium block mb-1">YouTube or Spotify URL</label>
                <Input
                  id="url-input"
                  type="url"
                  placeholder="Paste YouTube or Spotify track URL..."
                  value={url}
                  onChange={handleUrlChange}
                  className="w-full"
                  disabled={isProcessingUrl}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports YouTube and Spotify track URLs
                </p>
                
                {/* Show appropriate service icon based on detected URL type */}
                {urlType && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">Detected: </span>
                    {urlType === "youtube" ? (
                      <div className="flex items-center gap-1 text-red-500">
                        <Youtube className="h-3 w-3" /> <span className="text-xs">YouTube</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-500">
                        <Music2 className="h-3 w-3" /> <span className="text-xs">Spotify</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Preview for YouTube URLs */}
              {url && urlType === "youtube" && isValidUrl && (
                <div className="rounded-md overflow-hidden aspect-video">
                  <ReactPlayer
                    url={url}
                    width="100%"
                    height="100%"
                    controls={true}
                    light={true}
                  />
                </div>
              )}
              
              {/* Preview for Spotify URLs */}
              {url && urlType === "spotify" && isValidUrl && (
                <div className="rounded-md overflow-hidden">
                  {url.includes("spotify.com/track/") && (
                    <iframe 
                      src={`https://open.spotify.com/embed/track/${url.split("spotify.com/track/")[1].split("?")[0]}`}
                      width="100%" 
                      height="152" 
                      frameBorder="0" 
                      allow="encrypted-media"
                    ></iframe>
                  )}
                  {url.includes("spotify:track:") && (
                    <iframe 
                      src={`https://open.spotify.com/embed/track/${url.split("spotify:track:")[1].split("?")[0]}`}
                      width="100%" 
                      height="152" 
                      frameBorder="0" 
                      allow="encrypted-media"
                    ></iframe>
                  )}
                </div>
              )}
              
              {/* Spotify connection button */}
              <div className="flex items-center gap-2 my-4 p-3 border border-dashed border-green-500/30 rounded-lg bg-green-500/5">
                <Music2 className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Connect Spotify Account</h4>
                  <p className="text-xs text-muted-foreground">Sign in to access your playlists and favorites</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-green-500/10 border-green-500/20 hover:bg-green-500/20 text-green-600"
                  onClick={() => window.open('https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=YOUR_REDIRECT_URI&scope=user-read-private%20user-read-email%20playlist-read-private', '_blank')}
                >
                  Connect
                </Button>
              </div>
              
              {urlError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{urlError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleUrlSubmit} 
                className="w-full"
                disabled={!isValidUrl || isProcessingUrl}
              >
                {isProcessingUrl ? "Processing..." : "Convert to Sheet Music"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        {/* Card footer is left empty intentionally as the actions are in each tab */}
      </CardFooter>
    </Card>
  );
}