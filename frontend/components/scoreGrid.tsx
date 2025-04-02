"use client";

import { useState } from "react";
import { ScoreCard } from "@/components/scoreCard";
import { ScoreGeneration } from "@/lib/api-hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

interface ScoreGridProps {
  scores: ScoreGeneration[];
  isLoading: boolean;
  showSearch?: boolean;
  title?: string;
}

export function ScoreGrid({ scores, isLoading, showSearch = false, title = "Recent Scores" }: ScoreGridProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredScores = scores?.filter(score => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      score.title.toLowerCase().includes(query) || 
      (score.youtube_url && score.youtube_url.toLowerCase().includes(query))
    );
  });
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        
        {showSearch && (
          <form onSubmit={handleSearch} className="w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search scores..."
                className="w-full sm:w-[250px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[180px] w-full rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredScores?.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredScores.map((score) => (
            <ScoreCard key={score.id} score={score} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No scores found</p>
        </div>
      )}
    </div>
  );
}
