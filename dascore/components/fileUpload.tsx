"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Music, Upload, AlertCircle, Youtube } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

// Maximum file size in bytes (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onYoutubeUrlSubmit?: (url: string) => void;
}

export function FileUpload({ onFileSelect, onYoutubeUrlSubmit }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // YouTube related state
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [isValidYoutubeUrl, setIsValidYoutubeUrl] = useState<boolean>(false);
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

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

  const validateYoutubeUrl = (url: string) => {
    // Updated regex for YouTube URLs to include music.youtube.com
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(music\.youtube\.com|youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
  };

  const handleYoutubeUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    setIsValidYoutubeUrl(validateYoutubeUrl(url));
    setYoutubeError(null);
  };

  const handleYoutubeSubmit = async () => {
    if (!isValidYoutubeUrl) {
      setYoutubeError("Please enter a valid YouTube URL");
      return;
    }

    setIsProcessingYoutube(true);
    setYoutubeError(null);

    try {
      // Normalize YouTube URL by converting music.youtube.com to youtube.com
      const normalizedUrl = youtubeUrl.replace('music.youtube.com', 'youtube.com');
      
      if (onYoutubeUrlSubmit) {
        onYoutubeUrlSubmit(normalizedUrl);
      }
    } catch (error) {
      setYoutubeError("Failed to process YouTube URL. Please try again.");
      console.error("YouTube processing error:", error);
    } finally {
      // Don't set isProcessingYoutube to false here, since the caller will handle success/failure
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
          Upload a WAV file or provide a YouTube URL
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="youtube" className="flex items-center gap-2">
              <Youtube className="h-4 w-4" />
              YouTube
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
          
          <TabsContent value="youtube" className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="youtube-url" className="text-sm font-medium block mb-1">YouTube URL</label>
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={handleYoutubeUrlChange}
                  className="w-full"
                  disabled={isProcessingYoutube}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Both youtube.com and music.youtube.com URLs are supported
                </p>
              </div>
              
              {youtubeUrl && isValidYoutubeUrl && (
                <div className="rounded-md overflow-hidden aspect-video">
                  <ReactPlayer
                    url={youtubeUrl}
                    width="100%"
                    height="100%"
                    controls={true}
                    light={true}
                  />
                </div>
              )}
              
              {youtubeError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{youtubeError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleYoutubeSubmit} 
                className="w-full"
                disabled={!isValidYoutubeUrl || isProcessingYoutube}
              >
                {isProcessingYoutube ? "Processing..." : "Convert to Sheet Music"}
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