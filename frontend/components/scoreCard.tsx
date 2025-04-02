"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreGeneration } from "@/lib/api-hooks";
import { formatDistanceToNow } from "date-fns";
import { Music, Trash2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDeleteScoreGeneration } from "@/lib/api-hooks";
import { toast } from "sonner";

interface ScoreCardProps {
  score: ScoreGeneration;
}

export function ScoreCard({ score }: ScoreCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteScoreMutation = useDeleteScoreGeneration();
  
  const handleViewScore = () => {
    router.push(`/scores/${score.id}`);
  };
  
  const handleDeleteScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      await deleteScoreMutation.mutateAsync(score.id);
      toast.success("Score deleted successfully");
    } catch (error) {
      console.error("Failed to delete score:", error);
      toast.error("Failed to delete score");
    } finally {
      setIsDeleting(false);
    }
  };
  
  const formattedDate = score.created_at 
    ? formatDistanceToNow(new Date(score.created_at), { addSuffix: true })
    : "Unknown date";
  
  return (
    <Card 
      className="overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={handleViewScore}
    >
      <div className="relative aspect-video bg-muted">
        {score.thumbnail_url ? (
          <Image
            src={score.thumbnail_url}
            alt={score.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Music className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
      </div>
      
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg truncate">{score.title}</CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 pb-2">
        <p className="text-sm text-muted-foreground">Created {formattedDate}</p>
      </CardContent>
      
      <CardFooter className="p-4 pt-2 flex justify-between">
        <Button 
          variant="outline" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (score.youtube_url) {
              window.open(score.youtube_url, "_blank");
            }
          }}
          disabled={!score.youtube_url}
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          YouTube
        </Button>
        
        <Button 
          variant="destructive" 
          size="sm"
          onClick={handleDeleteScore}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
