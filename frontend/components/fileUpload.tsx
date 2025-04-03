"use client";

import { useState, useRef, ChangeEvent, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Music, Upload, AlertCircle, Youtube, Music2, Link, Clock, User, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { RangeSelector } from "@/components/RangeSelector";
import dynamic from "next/dynamic";
import Image from "next/image";
import { redirectToAuthCodeFlow, fetchProfile, fetchRecentlyPlayed, fetchTopItems } from '@/lib/spotify-api';

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

// Maximum file size in bytes (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onUrlSubmit?: (url: string, maxDuration: number, selectedTrack?: any) => void;
}

export function FileUpload({ onFileSelect, onUrlSubmit }: FileUploadProps) {
  const { isAuthenticated } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  
  // URL related state
  const [url, setUrl] = useState<string>("");
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlType, setUrlType] = useState<"youtube" | "spotify" | null>(null);
  const [isAuthenticatedWithSpotify, setIsAuthenticatedWithSpotify] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [mediaDuration, setMediaDuration] = useState<number>(0); // Track duration in seconds
  
  // Spotify profile data
  const [profileData, setProfileData] = useState<any>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Duration setting
  const [audioDuration, setAudioDuration] = useState<[number, number]>([0, 0]); // Update duration state to range
  
  // Function to load Spotify profile data and recently played tracks
  const loadSpotifyData = useCallback(async () => {
    if (!isAuthenticatedWithSpotify) return;
    
    setIsLoadingProfile(true);
    try {
      const profile = await fetchProfile();
      setProfileData(profile);
      
      const recentTracks = await fetchRecentlyPlayed();
      setRecentlyPlayed(recentTracks);
      
      const topTracksData = await fetchTopItems("tracks", "short_term", 5);
      setTopTracks(topTracksData.items);
    } catch (error) {
      console.error('Error fetching Spotify data:', error);
      setUrlError('Failed to load Spotify data. Please try reconnecting.');
    } finally {
      setIsLoadingProfile(false);
    }
  }, [isAuthenticatedWithSpotify, setUrlError, setProfileData, setRecentlyPlayed, setTopTracks, setIsLoadingProfile]);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const expiration = localStorage.getItem('accessTokenExpiration');
    
    if (accessToken && expiration) {
      const isExpired = Number(expiration) < new Date().getTime();
      setIsAuthenticatedWithSpotify(!isExpired);
      
      // If authenticated, fetch the profile data
      if (!isExpired) {
        loadSpotifyData();
      }
    }
  }, [loadSpotifyData]);
  
  // Check for auth code in URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Exchange the code for an access token
        import('@/lib/spotify-api').then(({ getAccessToken }) => {
          getAccessToken(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '', code)
            .then(() => {
              setIsAuthenticatedWithSpotify(true);
              // Clear the URL parameters
              window.history.replaceState({}, document.title, window.location.pathname);
              // Load the profile data
              loadSpotifyData();
              toast.success("Successfully connected to Spotify");
            })
            .catch(error => {
              console.error("Failed to exchange auth code for token:", error);
              toast.error("Failed to connect to Spotify");
            });
        });
      }
    }
  }, [loadSpotifyData]);

  const handleSpotifyConnect = async () => {
    try {
      // Using the client ID from environment variable
      await redirectToAuthCodeFlow(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '');
    } catch (error) {
      console.error('Spotify auth error:', error);
      setUrlError('Failed to connect to Spotify. Please try again.');
    }
  };

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

  // Handle URL input change
  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    
    // Clear previous errors
    setUrlError(null);
    
    // Detect URL type
    if (inputUrl.includes("youtube.com") || inputUrl.includes("youtu.be")) {
      setUrlType("youtube");
      setIsValidUrl(isValidYouTubeUrl(inputUrl));
    } else if (inputUrl.includes("spotify.com/track/") || inputUrl.startsWith("spotify:track:")) {
      setUrlType("spotify");
      setIsValidUrl(isValidSpotifyUrl(inputUrl));
    } else {
      setUrlType(null);
      setIsValidUrl(false);
    }
  };

  // Handle URL form submission
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      setUrlError("Please enter a URL");
      return;
    }
    
    // Validate URL format
    if (urlType === "youtube") {
      if (!isValidYouTubeUrl(url)) {
        setUrlError("Please enter a valid YouTube URL");
        return;
      }
    } else if (urlType === "spotify") {
      if (!isValidSpotifyUrl(url)) {
        setUrlError("Please enter a valid Spotify track URL");
        return;
      }
    } else {
      setUrlError("Please enter a valid YouTube or Spotify URL");
      return;
    }
    
    // Clear any previous errors
    setUrlError(null);
    
    // Set processing state
    setIsProcessingUrl(true);
    
    // Calculate duration from range
    const [startTime, endTime] = audioDuration;
    const duration = endTime - startTime;
    
    // Call the onUrlSubmit callback with the appropriate parameters
    if (onUrlSubmit) {
      if (urlType === "spotify") {
        onUrlSubmit(url, duration, selectedTrack);
      } else {
        // For YouTube, add the start time parameter
        const urlWithRange = url.includes('?') ? 
          `${url}&t=${startTime}` : 
          `${url}?t=${startTime}`;
        onUrlSubmit(urlWithRange, duration);
      }
    }
  };
  
  // Submit URL for processing
  const submitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (onUrlSubmit) {
        // Calculate duration from range
        const [startTime, endTime] = audioDuration;
        const duration = endTime - startTime;
        
        // For Spotify, pass the selected track data
        if (urlType === "spotify") {
          await onUrlSubmit(url, duration, selectedTrack);
        } else {
          // For YouTube, add the start time parameter
          const urlWithRange = url.includes('?') ? 
            `${url}&t=${startTime}` : 
            `${url}?t=${startTime}`;
          await onUrlSubmit(urlWithRange, duration);
        }
      }
    } catch (error) {
      console.error("Error submitting URL:", error);
      setUrlError("Failed to process the URL. Please try again.");
    } finally {
      setIsProcessingUrl(false);
    }
  };

  // Helper function to validate YouTube URL
  const isValidYouTubeUrl = (url: string) => {
    return url.includes("youtube.com/watch") || 
           url.includes("youtu.be/") || 
           url.includes("youtube.com/shorts/");
  };
  
  // Helper function to validate Spotify URL
  const isValidSpotifyUrl = (url: string) => {
    return url.includes("spotify.com/track/") || 
           url.startsWith("spotify:track:");
  };

  const handleTrackSelect = (trackUri: string, track: any) => {
    // Convert Spotify URI to URL format if needed
    // spotify:track:1234567 => https://open.spotify.com/track/1234567
    let trackUrl = trackUri;
    if (trackUri.startsWith("spotify:track:")) {
      const trackId = trackUri.split(":")[2];
      trackUrl = `https://open.spotify.com/track/${trackId}`;
    }
    
    // Update the URL state directly
    setUrl(trackUrl);
    
    // Also update the input field value
    if (urlInputRef.current) {
      urlInputRef.current.value = trackUrl;
    }
    
    // Store the selected track data
    setSelectedTrack(track);
    
    // Update URL type and validation
    setUrlType("spotify");
    setIsValidUrl(true);
    
    // Clear any errors
    setUrlError(null);
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
          {isAuthenticated && (
            <span className="block mt-1 text-xs text-green-500">
              Your score sheet will be saved to your account
            </span>
          )}
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
                  ref={urlInputRef}
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
                    onDuration={(duration) => {
                      setMediaDuration(duration);
                      setAudioDuration([0, Math.ceil(duration)]);
                    }}
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
                      onLoad={() => {
                        // Set Spotify track duration when available in selectedTrack
                        if (selectedTrack?.duration_ms) {
                          const durationInSeconds = Math.ceil(selectedTrack.duration_ms / 1000);
                          setMediaDuration(durationInSeconds);
                          setAudioDuration([0, durationInSeconds]);
                        }
                      }}
                    ></iframe>
                  )}
                  {url.includes("spotify:track:") && (
                    <iframe 
                      src={`https://open.spotify.com/embed/track/${url.split("spotify:track:")[1].split("?")[0]}`}
                      width="100%" 
                      height="152" 
                      frameBorder="0" 
                      allow="encrypted-media"
                      onLoad={() => {
                        // Set Spotify track duration when available in selectedTrack
                        if (selectedTrack?.duration_ms) {
                          const durationInSeconds = Math.ceil(selectedTrack.duration_ms / 1000);
                          setMediaDuration(durationInSeconds);
                          setAudioDuration([0, durationInSeconds]);
                        }
                      }}
                    ></iframe>
                  )}
                </div>
              )}
              
              {/* Time Range Selector - Only show when we have a YouTube or Spotify URL with duration */}
              {(urlType === "youtube" || urlType === "spotify") && isValidUrl && mediaDuration > 0 && (
                <div className="space-y-2 border-t border-dashed pt-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Audio Time Range</span>
                    </div>
                    <span className="text-sm font-medium">{audioDuration[0].toFixed(1)} - {audioDuration[1].toFixed(1)} seconds</span>
                  </div>
                  <RangeSelector
                    min={0}
                    max={mediaDuration}
                    defaultValue={audioDuration}
                    onValueChange={(values) => setAudioDuration(values)}
                    step={0.5}
                    className="py-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the range selector to set audio start and end positions for conversion
                  </p>
                </div>
              )}
              
              {/* Spotify connection button */}
              <div className="flex items-center gap-2 my-4 p-3 border border-dashed border-green-500/30 rounded-lg bg-green-500/5">
                <Music2 className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Connect Spotify Account</h4>
                  <p className="text-xs text-muted-foreground">
                    {isAuthenticatedWithSpotify 
                      ? "You're connected to Spotify" 
                      : "Sign in to access your playlists and favorites"}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-green-500/10 border-green-500/20 hover:bg-green-500/20 text-green-600"
                  onClick={handleSpotifyConnect}
                >
                  {isAuthenticatedWithSpotify ? "Reconnect" : "Connect"}
                </Button>
              </div>
              
              {/* Spotify Profile Data */}
              {isAuthenticatedWithSpotify && profileData && (
                <div className="mt-4 p-4 border rounded-lg border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-green-500/20 flex items-center justify-center">
                      {profileData.images && profileData.images[0] ? (
                        <Image 
                          src={profileData.images[0].url} 
                          alt={profileData.display_name}
                          width={48}
                          height={48}
                          className="object-cover" 
                        />
                      ) : (
                        <User className="h-6 w-6 text-green-700" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{profileData.display_name}</h3>
                      <p className="text-xs text-muted-foreground">{profileData.email}</p>
                    </div>
                  </div>
                  
                  {recentlyPlayed && recentlyPlayed.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 mb-1.5">
                        <Clock className="h-4 w-4" />
                        <span>Recently Played</span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {recentlyPlayed.slice(0, 5).map((item: any) => (
                          <div 
                            key={item.played_at} 
                            className="flex items-center gap-2 p-2 rounded hover:bg-green-500/10 cursor-pointer"
                            onClick={() => handleTrackSelect(item.track.uri, item.track)}
                          >
                            <div className="h-8 w-8 flex-shrink-0 relative">
                              {item.track.album.images && item.track.album.images[0] && (
                                <Image 
                                  src={item.track.album.images[0].url} 
                                  alt={item.track.album.name}
                                  width={32}
                                  height={32}
                                  className="object-cover rounded"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.track.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {item.track.artists.map((artist: any) => artist.name).join(", ")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {topTracks && topTracks.length > 0 && (
                    <div className="pt-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 mb-1.5">
                        <TrendingUp className="h-4 w-4" />
                        <span>Your Top Tracks</span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {topTracks.map((track: any) => (
                          <div 
                            key={track.id} 
                            className="flex items-center gap-2 p-2 rounded hover:bg-green-500/10 cursor-pointer"
                            onClick={() => handleTrackSelect(track.uri, track)}
                          >
                            <div className="h-8 w-8 flex-shrink-0 relative">
                              {track.album.images && track.album.images[0] && (
                                <Image 
                                  src={track.album.images[0].url} 
                                  alt={track.album.name}
                                  width={32}
                                  height={32}
                                  className="object-cover rounded"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{track.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {track.artists.map((artist: any) => artist.name).join(", ")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {isLoadingProfile && (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin h-5 w-5 border-2 border-green-500 rounded-full border-t-transparent"></div>
                  <span className="ml-2 text-sm">Loading profile data...</span>
                </div>
              )}
              
              {urlError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{urlError}</AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={submitUrl}>
                <Button 
                  type="submit"
                  className="w-full"
                  disabled={!isValidUrl || isProcessingUrl}
                >
                  {isProcessingUrl ? "Processing..." : "Convert to Sheet Music"}
                </Button>
              </form>
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