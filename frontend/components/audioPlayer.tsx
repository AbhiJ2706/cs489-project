"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Volume2, VolumeX, RefreshCw, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch, apiUrl } from "@/lib/apiUtils";

interface AudioPlayerProps {
  file?: File | null;
  fileId?: string | null;
  originalAudio?: boolean;
}

export function AudioPlayer({ file, fileId, originalAudio = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const prevUrlRef = useRef<string | null>(null); // Track previous URL for cleanup

  // Create audio element from a URL (either local file or remote)
  const setupAudioElement = (url: string) => {
    // Reset player state
    setIsPlaying(false);
    setCurrentTime(0);
    
    // If there's an existing audio element, clean it up
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    // Create new audio element
    const audio = new Audio(url);
    audioRef.current = audio;
    
    // Set up event listeners
    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
  };

  // Manage file URL creation and cleanup
  const setupFileURL = useCallback((fileObj: File) => {
    // Clean up previous URL if it exists
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    
    // Create new URL
    const url = URL.createObjectURL(fileObj);
    prevUrlRef.current = url;
    setAudioUrl(url);
    setupAudioElement(url);
    
    return url;
  }, []);
  
  // Clean up URLs and audio on unmount
  const cleanupResources = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
  }, []);

  // Handle local file uploads
  useEffect(() => {
    if (!file) return;
    
    setupFileURL(file);
    
    return cleanupResources;
  }, [file, setupFileURL, cleanupResources]);

  // Define fetchSynthesizedAudio with useCallback to avoid recreation on each render
  const fetchSynthesizedAudio = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First, request the server to synthesize audio from MusicXML
      const response = await apiFetch(originalAudio ? `files/${id}/original_audio` : `synthesize/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to synthesize audio');
      }
      
      const data = await response.json();
      
      // Get the audio URL from the response - strip the leading slash if present
      const audioUrlPath = data.audio_url.startsWith('/') ? data.audio_url.substring(1) : data.audio_url;
      const audioPath = apiUrl(audioUrlPath);
      
      // Set the audio URL state variable
      setAudioUrl(audioPath);
      
      // Create new audio element with the URL
      setupAudioElement(audioPath);
      
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [originalAudio]);  // Add originalAudio as dependency

  // Handle fileId-based playback (synthesized audio from MusicXML)
  useEffect(() => {
    if (fileId) {
      // Don't try to fetch original audio - that's handled by ResultsPanel now
      if (!originalAudio) {
        fetchSynthesizedAudio(fileId);
      }
    }
  }, [fileId, fetchSynthesizedAudio, originalAudio]);  // Add originalAudio as dependency

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    } else {
      audioRef.current.play();
      progressInterval.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    }
    
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const refreshAudio = () => {
    if (fileId) {
      fetchSynthesizedAudio(fileId);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = file ? file.name : `synthesized_sheet_music_${fileId}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    
    const newTime = pos * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  if (!file && !fileId) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Audio Player</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium truncate">
                {file ? file.name : 'Synthesized Sheet Music Audio'}
              </div>
              
              <div 
                className="h-2 bg-muted rounded-full cursor-pointer relative overflow-hidden"
                onClick={handleProgressClick}
              >
                <Progress 
                  value={(currentTime / duration) * 100 || 0} 
                  className="h-full absolute top-0 left-0"
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              
              <div className="flex justify-center gap-4">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={togglePlayPause}
                  disabled={!audioUrl || isLoading}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={toggleMute}
                  disabled={!audioUrl || isLoading}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={downloadAudio}
                  disabled={!audioUrl || isLoading}
                >
                  <Download className="h-4 w-4" />
                </Button>
                
                {fileId && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={refreshAudio}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}