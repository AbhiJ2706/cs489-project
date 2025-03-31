"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileDown, FileText, AlertCircle, RefreshCw, FileWarning, ExternalLink, Music } from "lucide-react";
import { AudioPlayer } from "./audioPlayer";
import { apiFetch, apiUrl } from "../lib/apiUtils";

interface ResultsPanelProps {
  fileId: string | null;
  onReset: () => void;
}

interface AvailableFiles {
  musicxml: boolean;
  pdf: boolean;
}

export function ResultsPanel({ fileId, onReset }: ResultsPanelProps) {
  const [availableFiles, setAvailableFiles] = useState<AvailableFiles>({
    musicxml: false,
    pdf: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;

    const fetchFileStatus = async () => {
      try {
        setIsLoading(true);
        const response = await apiFetch(`check-files/${fileId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch file status");
        }
        
        const data = await response.json();
        setAvailableFiles({
          musicxml: data.musicxml || false,
          pdf: data.pdf || false
        });
        
        if (fileId) {
          setOriginalAudioUrl(apiUrl(`uploads/${fileId}.wav`));
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching file status:", error);
        setError("Failed to fetch file status");
        setIsLoading(false);
      }
    };

    fetchFileStatus();
    
  }, [fileId]);

  const handleDownload = async (fileType: "musicxml" | "pdf") => {
    if (!fileId) return;
    
    const url = apiUrl(`download/${fileType}/${fileId}`);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sheet_music.${fileType}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${fileType.toUpperCase()} file downloaded successfully!`);
  };

  if (!fileId) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Conversion Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {availableFiles.pdf ? (
                <div className="aspect-[3/4] w-full bg-muted rounded-md overflow-hidden">
                  <iframe 
                    src={apiUrl(`preview/${fileId}`)}
                    className="w-full h-full border-0"
                    title="Sheet Music Preview"
                  />
                </div>
              ) : (
                <div className="aspect-[3/4] w-full bg-muted/30 rounded-md flex flex-col items-center justify-center p-6 text-center">
                  <FileWarning className="h-16 w-16 text-amber-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">PDF Preview Unavailable</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    PDF generation failed due to missing MuseScore or Lilypond. 
                    You can still download the MusicXML file and open it in your preferred music notation software.
                  </p>
                  <Alert className="text-left bg-amber-50 border-amber-200 text-amber-800">
                    <AlertTitle>Tip</AlertTitle>
                    <AlertDescription>
                      To view MusicXML files, you can use software like MuseScore, Finale, or Sibelius, 
                      or online tools like Flat.io or Noteflight.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Download Options:</p>
                <div className="flex gap-2">
                  {availableFiles.pdf && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleDownload("pdf")}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                  )}
                  <Button 
                    variant={availableFiles.pdf ? "outline" : "default"}
                    className="flex-1"
                    onClick={() => handleDownload("musicxml")}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    MusicXML
                  </Button>
                </div>
              </div>

              {availableFiles.musicxml && (
                <div className="pt-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full"
                  >
                    <a 
                      href={`/view?id=${fileId}&type=musicxml`}
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Sheet Music Viewer
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Opens in a new tab with interactive sheet music viewer
                  </p>
                </div>
              )}
              
              {/* Audio Players - Side by Side */}
              <div className="pt-4 border-t border-muted mt-4">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Music className="h-4 w-4" />
                  Compare Original vs Synthesized Audio
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original Audio Player */}
                  <div className="flex flex-col">
                    <div className="text-center font-medium mb-2">
                      Original Audio
                    </div>
                    {originalAudioUrl ? (
                      <audio 
                        controls 
                        src={originalAudioUrl} 
                        className="w-full"
                      ></audio>
                    ) : (
                      <AudioPlayer fileId={fileId} originalAudio={true} />
                    )}
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Original uploaded audio file
                    </p>
                  </div>
                  
                  {/* Synthesized Audio Player */}
                  {availableFiles.musicxml && (
                    <div className="flex flex-col">
                      <div className="text-center font-medium mb-2">
                        Synthesized Audio
                      </div>
                      <AudioPlayer fileId={fileId} />
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Audio synthesized from the sheet music
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onReset} 
          className="w-full"
          variant="secondary"
        >
          Convert Another File
        </Button>
      </CardFooter>
    </Card>
  );
}