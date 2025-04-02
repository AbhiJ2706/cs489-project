"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useScoreGeneration } from "@/lib/api-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Music, Download } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/apiUtils";
import dynamic from "next/dynamic";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

export default function ScoreDetail({ id }: { id: string }) {
  const router = useRouter();
  const scoreId = parseInt(id);
  const { data: score, isLoading, error } = useScoreGeneration(scoreId);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (error) {
      toast.error("Failed to load score details");
    }
  }, [error]);

  const handleGoBack = () => {
    router.push("/");
  };

  const handleDownload = async () => {
    if (!score) return;
    
    setIsDownloading(true);
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/files/${score.file_id}`);
      
      if (!response.ok) {
        throw new Error("Failed to download score");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${score.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Score downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download score");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Toaster />
        <Button variant="ghost" className="mb-6" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="container max-w-4xl py-8">
        <Toaster />
        <Button variant="ghost" className="mb-6" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Score Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The score you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            <Button onClick={handleGoBack}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Toaster />
      <Button variant="ghost" className="mb-6" onClick={handleGoBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{score.title}</h1>
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Score
          </Button>
        </div>
        
        {score.youtube_url && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-video">
                <ReactPlayer
                  url={score.youtube_url}
                  width="100%"
                  height="100%"
                  controls={true}
                />
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardContent className="p-6">
            <div className="bg-muted rounded-md p-4 overflow-auto max-h-[500px]">
              <iframe
                src={`${getApiBaseUrl()}/files/${score.file_id}/view`}
                className="w-full h-[400px] border-0"
                title={`Score: ${score.title}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
