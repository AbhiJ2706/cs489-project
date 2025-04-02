"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useScoreGeneration } from "@/lib/api-hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Music, Download, Youtube, FileMusic, Calendar } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/apiUtils";
import { format } from "date-fns";
import dynamic from "next/dynamic";

// Import ReactPlayer dynamically to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

export default function ScoreClient({ id }: { id: string }) {
  const router = useRouter();
  const scoreId = parseInt(id);
  const { data: score, isLoading, error } = useScoreGeneration(scoreId);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(score?.youtube_url ? "video" : "score");

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
      <div className="min-h-screen bg-muted/40 p-4 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <Button variant="ghost" className="mb-6" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          
          <Card className="w-full">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-lg" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="min-h-screen bg-muted/40 p-4 lg:p-8">
        <div className="mx-auto max-w-6xl">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <Toaster />
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Score
          </Button>
        </div>
        
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold">{score.title}</h1>
                  <p className="flex items-center mt-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(new Date(score.created_at), "PPP")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    <FileMusic className="h-4 w-4 mr-1" />
                    PDF Score
                  </Badge>
                  {score.youtube_url && (
                    <Badge variant="secondary">
                      <Youtube className="h-4 w-4 mr-1" />
                      YouTube
                    </Badge>
                  )}
                </div>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  {score.youtube_url && (
                    <TabsTrigger value="video">
                      <Youtube className="h-4 w-4 mr-2" />
                      Video
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="score">
                    <FileMusic className="h-4 w-4 mr-2" />
                    Score
                  </TabsTrigger>
                </TabsList>
                
                {score.youtube_url && (
                  <TabsContent value="video" className="mt-4">
                    <div className="aspect-video rounded-lg overflow-hidden bg-black">
                      <ReactPlayer
                        url={score.youtube_url}
                        width="100%"
                        height="100%"
                        controls={true}
                      />
                    </div>
                  </TabsContent>
                )}
                
                <TabsContent value="score" className="mt-4">
                  <div className="bg-white rounded-lg overflow-hidden">
                    <iframe
                      src={`${getApiBaseUrl()}/files/${score.file_id}/view`}
                      className="w-full h-[calc(100vh-24rem)] min-h-[600px] border-0"
                      title={`Score: ${score.title}`}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
