"use client";

import { useState, useEffect, useCallback } from "react";
import db from "@/lib/instantdb";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, RefreshCw, Trash, Music } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/apiUtils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import dynamic from "next/dynamic";

// Import PdfViewer dynamically to avoid SSR issues with PDF.js
const DynamicPdfViewer = dynamic(() => import("./PdfViewer"), { 
  ssr: false,
  loading: () => <div>Loading PDF viewer...</div>
});

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
  const { user, isAuthenticated } = useAuth();
  const [availableFiles, setAvailableFiles] = useState<AvailableFiles>({
    musicxml: false,
    pdf: false,
  });
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [synthesizedAudioUrl, setSynthesizedAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Simple direct state for InstantDB files
  const [instantAudioUrl, setInstantAudioUrl] = useState<string | null>(null);
  const [instantPdfUrl, setInstantPdfUrl] = useState<string | null>(null);
  const [instantMusicXmlUrl, setInstantMusicXmlUrl] = useState<string | null>(null);
  const [instantSynthesizedUrl, setInstantSynthesizedUrl] = useState<string | null>(null);
  const [instantFilesUploaded, setInstantFilesUploaded] = useState(false);

  // Upload files to InstantDB
  const uploadFilesToInstantDB = useCallback(async () => {
    if (!db || !isAuthenticated || !user || !fileId) return;
    
    try {
      // Upload original audio
      if (originalAudioUrl) {
        try {
          const audioResp = await fetch(originalAudioUrl);
          if (audioResp.ok) {
            const audioBlob = await audioResp.blob();
            const audioFile = new File([audioBlob], `${fileId}_audio.wav`, { type: 'audio/wav' });
            const result = await db.storage.uploadFile(`${user.id}/${fileId}_audio.wav`, audioFile);
            // Check if upload was successful and extract URL
            if (result?.data) {
              // InstantDB returns different formats in different versions
              // Handle both possible response formats
              const url = typeof result.data === 'object' && 'url' in result.data 
                ? String(result.data.url)
                : typeof result === 'object' && 'url' in result 
                  ? String(result.url)
                  : null;
                  
              if (url) setInstantAudioUrl(url);
            }
          }
        } catch (err) {
          console.error("Failed to upload audio file:", err);
        }
      }
      
      // Upload PDF
      if (availableFiles.pdf) {
        try {
          const pdfUrl = apiUrl(`files/${fileId}?type=pdf`);
          const pdfResp = await fetch(pdfUrl);
          if (pdfResp.ok) {
            const pdfBlob = await pdfResp.blob();
            const pdfFile = new File([pdfBlob], `${fileId}_sheet.pdf`, { type: 'application/pdf' });
            const result = await db.storage.uploadFile(`${user.id}/${fileId}_sheet.pdf`, pdfFile);
            // Extract URL safely
            if (result?.data) {
              const url = typeof result.data === 'object' && 'url' in result.data 
                ? String(result.data.url)
                : typeof result === 'object' && 'url' in result 
                  ? String(result.url)
                  : null;
                  
              if (url) setInstantPdfUrl(url);
            }
          }
        } catch (err) {
          console.error("Failed to upload PDF file:", err);
        }
      }
      
      // Upload MusicXML
      if (availableFiles.musicxml) {
        try {
          const xmlUrl = apiUrl(`files/${fileId}?type=musicxml`);
          const xmlResp = await fetch(xmlUrl);
          if (xmlResp.ok) {
            const xmlBlob = await xmlResp.blob();
            const xmlFile = new File([xmlBlob], `${fileId}_sheet.xml`, { type: 'application/xml' });
            const result = await db.storage.uploadFile(`${user.id}/${fileId}_sheet.xml`, xmlFile);
            // Extract URL safely
            if (result?.data) {
              const url = typeof result.data === 'object' && 'url' in result.data 
                ? String(result.data.url)
                : typeof result === 'object' && 'url' in result 
                  ? String(result.url)
                  : null;
                  
              if (url) setInstantMusicXmlUrl(url);
            }
          }
        } catch (err) {
          console.error("Failed to upload MusicXML file:", err);
        }
      }
      
      // Upload synthesized audio
      if (synthesizedAudioUrl) {
        try {
          const synthResp = await fetch(synthesizedAudioUrl);
          if (synthResp.ok) {
            const synthBlob = await synthResp.blob();
            const synthFile = new File([synthBlob], `${fileId}_synthesized.wav`, { type: 'audio/wav' });
            const result = await db.storage.uploadFile(`${user.id}/${fileId}_synthesized.wav`, synthFile);
            // Extract URL safely
            if (result?.data) {
              const url = typeof result.data === 'object' && 'url' in result.data 
                ? String(result.data.url)
                : typeof result === 'object' && 'url' in result 
                  ? String(result.url)
                  : null;
                  
              if (url) setInstantSynthesizedUrl(url);
            }
          }
        } catch (err) {
          console.error("Failed to upload synthesized audio file:", err);
        }
      }

      // Mark as uploaded
      setInstantFilesUploaded(true);
    } catch (err) {
      console.error("Error uploading to InstantDB:", err);
    }
  }, [fileId, isAuthenticated, user, originalAudioUrl, synthesizedAudioUrl, availableFiles]);

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
        
        // Upload to InstantDB if authenticated and we have the library
        if (isAuthenticated && user && db && !instantFilesUploaded) {
          uploadFilesToInstantDB();
        }
      } catch (error) {
        console.error("Error fetching file status:", error);
        setError("Failed to fetch file status");
        setIsLoading(false);
      }
    };

    fetchFileStatus();
  }, [fileId, isAuthenticated, user, instantFilesUploaded, uploadFilesToInstantDB]);

  // Handle downloads with InstantDB URLs if available
  const handleDownload = async (fileType: "musicxml" | "pdf") => {
    if (!fileId) return;

    // Try to use InstantDB URL if available
    if (fileType === "pdf" && instantPdfUrl) {
      const a = document.createElement('a');
      a.href = instantPdfUrl;
      a.download = `sheet-music-${fileId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    
    if (fileType === "musicxml" && instantMusicXmlUrl) {
      const a = document.createElement('a');
      a.href = instantMusicXmlUrl;
      a.download = `sheet-music-${fileId}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Fallback to API URL
    const url = apiUrl(`files/${fileId}?type=${fileType}`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileId}.${fileType === "musicxml" ? "xml" : "pdf"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAudio = (isOriginal: boolean) => {
    if (!fileId) return;
    
    // Try to use InstantDB URL if available
    if (isOriginal && instantAudioUrl) {
      const a = document.createElement('a');
      a.href = instantAudioUrl;
      a.download = `original-audio-${fileId}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    
    if (!isOriginal && instantSynthesizedUrl) {
      const a = document.createElement('a');
      a.href = instantSynthesizedUrl;
      a.download = `synthesized-audio-${fileId}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Fallback to API URL
    const url = isOriginal ? 
      apiUrl(`uploads/${fileId}`) : 
      apiUrl(`audio/${fileId}`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileId}${isOriginal ? '_original' : '_synthesized'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async () => {
    if (!fileId) return;

    try {
      // Delete from API
      await apiFetch(`files/${fileId}`, {
        method: "DELETE",
      });
      
      // Delete from InstantDB if authenticated
      if (db && isAuthenticated && instantFilesUploaded) {
        // Try to delete each file
        const filePaths = [
          `${user?.id}/${fileId}_audio.wav`,
          `${user?.id}/${fileId}_sheet.pdf`,
          `${user?.id}/${fileId}_sheet.xml`,
          `${user?.id}/${fileId}_synthesized.wav`
        ];
        
        for (const path of filePaths) {
          try {
            await db.storage.delete(path);
          } catch (err) {
            console.error(`Failed to delete file ${path}:`, err);
          }
        }
      }
      
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
            {(availableFiles.pdf || instantPdfUrl) && (
              <div>
                <h3 className="text-sm font-medium mb-2">Sheet Music Preview</h3>
                <div className="aspect-[3/4] w-full bg-muted rounded-md overflow-hidden mb-2 sm:mb-4">
                  <DynamicPdfViewer fileUrl={instantPdfUrl || apiUrl(`preview/${fileId}`)} />
                </div>
              </div>
            )}
            
            {/* Original Audio */}
            {(originalAudioUrl || instantAudioUrl) && (
              <div>
                <h3 className="text-sm font-medium mb-1 sm:mb-2">Original Audio</h3>
                <audio
                  src={instantAudioUrl || originalAudioUrl || undefined}
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
                src={instantSynthesizedUrl || synthesizedAudioUrl || undefined}
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
              <div className="grid grid-cols-1 gap-2 sm:gap-4">
                <Button 
                  onClick={() => handleDownload("musicxml")} 
                  disabled={!availableFiles.musicxml && !instantMusicXmlUrl}
                  className="flex items-center justify-center gap-2"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                  <span>Download MusicXML</span>
                </Button>
                
                <Button 
                  onClick={() => handleDownload("pdf")} 
                  disabled={!availableFiles.pdf && !instantPdfUrl}
                  className="flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </Button>
                
                <Button 
                  onClick={() => handleDownloadAudio(true)} 
                  disabled={!originalAudioUrl && !instantAudioUrl}
                  className="flex items-center justify-center gap-2"
                  variant="outline"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Original Audio</span>
                </Button>
                
                <Button 
                  onClick={() => handleDownloadAudio(false)} 
                  disabled={!synthesizedAudioUrl && !instantSynthesizedUrl}
                  className="flex items-center justify-center gap-2"
                >
                  <Music className="h-4 w-4" />
                  <span>Download Synthesized Audio</span>
                </Button>
              </div>
            </div>

            <div className="flex justify-between border-t pt-4 mt-6">
              <Button onClick={onReset} variant="outline">
                Convert Another File
              </Button>
              <Button onClick={handleDelete} variant="destructive" className="flex items-center gap-2">
                <Trash className="h-4 w-4" />
                Delete Files
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}