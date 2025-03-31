"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpenSheetMusicDisplay } from "@/components/openSheetMusicDisplay";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { apiFetch, apiUrl } from "@/lib/apiUtils";

export default function MusicXMLViewer() {
  const { fileId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [musicXmlContent, setMusicXmlContent] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;

    const fetchMusicXml = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiFetch(`musicxml-content/${fileId}`);
        
        if (!response.ok) {
          throw new Error("Failed to load MusicXML content");
        }
        
        const xmlContent = await response.text();
        setMusicXmlContent(xmlContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMusicXml();
  }, [fileId]);

  const handleDownload = () => {
    if (!fileId) return;
    
    const url = apiUrl(`download/musicxml/${fileId}`);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sheet_music.musicxml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Converter
          </Link>
          
          {!isLoading && !error && (
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download MusicXML
            </Button>
          )}
        </div>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Sheet Music Viewer</h1>
          
          {isLoading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="bg-white rounded-md p-4 overflow-auto">
              {musicXmlContent && (
                <OpenSheetMusicDisplay 
                  musicXml={musicXmlContent}
                  options={{
                    autoResize: true,
                    drawTitle: true,
                    drawSubtitle: true,
                    drawComposer: true,
                    drawCredits: true,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 