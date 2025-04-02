"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, RefreshCw, Trash } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/apiUtils";
import Link from "next/link";
import PdfViewer from "./PdfViewer";

interface ResultsPanelProps {
  fileId: string;
  originalFile?: File | null;
  onReset: () => void;
}

interface AvailableFiles {
  musicxml: boolean;
  pdf: boolean;
  wav?: boolean;
}

export function ResultsPanel({ fileId, originalFile, onReset }: ResultsPanelProps) {
  const [availableFiles, setAvailableFiles] = useState<AvailableFiles>({
    musicxml: false,
    pdf: false,
  });
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [synthesizedAudioUrl, setSynthesizedAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;

    const fetchFileStatus = async () => {
      try {
        setIsLoading(true);
        // The apiFetch function now handles JSON parsing
        const data = await apiFetch<AvailableFiles>(`check-files/${fileId}`);

        setAvailableFiles({
          musicxml: Boolean(data.musicxml),
          pdf: Boolean(data.pdf)
        });

        // Set the audio URLs
        setOriginalAudioUrl(apiUrl(`uploads/${fileId}`));
        setSynthesizedAudioUrl(apiUrl(`audio/${fileId}`));
        
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

    const url = apiUrl(`files/${fileId}?type=${fileType}`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileId}.${fileType === "musicxml" ? "xml" : "pdf"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async () => {
    if (!fileId) return;

    try {
      await apiFetch(`files/${fileId}`, {
        method: "DELETE",
      });
      onReset();
    } catch (error) {
      console.error("Error deleting files:", error);
      setError("Failed to delete files");
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-full sm:max-w-md mx-auto mt-4 sm:mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">
              Please wait while we fetch your conversion results...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-full sm:max-w-md mx-auto mt-4 sm:mt-6">
        <CardHeader>
          <CardTitle className="text-red-500">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button onClick={onReset} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-full sm:max-w-md mx-auto mt-4 sm:mt-6">
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileText className="h-5 w-5" />
            Conversion Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 sm:space-y-6">
            {/* PDF Preview */}
            {availableFiles.pdf && (
              <div>
                <h3 className="text-sm font-medium mb-2">Sheet Music Preview</h3>
                <div className="aspect-[3/4] w-full bg-muted rounded-md overflow-hidden mb-2 sm:mb-4">
                  <PdfViewer fileUrl={apiUrl(`preview/${fileId}`)} />
                </div>
              </div>
            )}
            
            {/* Original Audio */}
            {originalAudioUrl && (
              <div>
                <h3 className="text-sm font-medium mb-1 sm:mb-2">Original Audio</h3>
                <audio
                  src={originalAudioUrl}
                  controls
                  className="w-full max-w-full"
                  title={originalFile?.name || "Original Audio.wav"}
                />
              </div>
            )}
            
            {/* Synthesized Audio */}
            <div>
              <h3 className="text-sm font-medium mb-1 sm:mb-2">Synthesized Audio</h3>
              <audio
                src={synthesizedAudioUrl || undefined}
                controls
                className="w-full max-w-full"
                title="Synthesized Sheet Music"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is how your sheet music sounds when played by a computer
              </p>
            </div>

            {/* Download Buttons */}
            <div className="pt-2 sm:pt-4">
              <h3 className="text-sm font-medium mb-2">Download Options</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <Button 
                  onClick={() => handleDownload("musicxml")} 
                  disabled={!availableFiles.musicxml}
                  className="flex items-center justify-center gap-2"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                  <span>MusicXML</span>
                </Button>
                
                <Button 
                  onClick={() => handleDownload("pdf")} 
                  disabled={!availableFiles.pdf}
                  className="flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span>PDF</span>
                </Button>
              </div>
            </div>

            {/* MusicXML Viewer */}
            {availableFiles.musicxml && (
              <div>
                <h3 className="text-sm font-medium mb-2">Interactive Viewer</h3>
                <Link href={`/musicxml-viewer/${fileId}`} target="_blank">
                  <Button className="w-full" variant="outline">
                    Open MusicXML Viewer
                  </Button>
                </Link>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <Button
                onClick={onReset}
                variant="default"
                className="flex-1"
              >
                Try Another
              </Button>

              <Button
                onClick={handleDelete}
                variant="destructive"
                className="flex items-center gap-1"
              >
                <Trash className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}