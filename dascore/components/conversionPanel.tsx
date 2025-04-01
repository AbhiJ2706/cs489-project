"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileMusic, AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/apiUtils";

interface ConversionPanelProps {
  file: File | null;
  onConversionComplete: (fileId: string) => void;
}

interface ConversionResponse {
  file_id: string;
  message: string;
  has_pdf: boolean;
}

export function ConversionPanel({ file, onConversionComplete }: ConversionPanelProps) {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    setError(null);
    setProgress(0);

    // Simulate progress while actual conversion happens
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Cap at 90% until we get actual completion
        return prev < 90 ? prev + 5 : prev;
      });
    }, 500);

    try {
      // Create form data for the file upload
      const formData = new FormData();
      formData.append("file", file);
      
      // Optional: Add title from filename
      const title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      formData.append("title", title);

      // Send the file to the API
      try {
        const data = await apiFetch<ConversionResponse>("convert", {
          method: "POST",
          body: formData,
        });
        
        // Set progress to 100% and notify success
        setProgress(100);
        
        // Show appropriate toast message
        if (!data.has_pdf) {
          toast.warning("PDF generation failed, but MusicXML is available");
        } else {
          toast.success("Conversion successful!");
        }
        
        // Call the completion handler
        onConversionComplete(data.file_id);
      } catch (error) {
        console.error("Conversion error:", error);
        setError(error instanceof Error ? error.message : "Conversion failed");
        toast.error("Failed to convert audio");
      } finally {
        clearInterval(progressInterval);
        setIsConverting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      toast.error("Conversion failed. Please try again.");
    }
  };

  if (!file) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileMusic className="h-5 w-5" />
          Convert to Sheet Music
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isConverting && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Converting...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleConvert} 
          className="w-full"
          disabled={isConverting || !file}
        >
          {isConverting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            "Convert to Sheet Music"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 