"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreGrid } from "@/components/scoreGrid";
import { useScoreGenerations } from "@/lib/api-hooks";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const { data: scores, isLoading } = useScoreGenerations();
  const [filteredScores, setFilteredScores] = useState([]);

  useEffect(() => {
    if (scores && query) {
      const lowercaseQuery = query.toLowerCase();
      const filtered = scores.filter(score => 
        score.title.toLowerCase().includes(lowercaseQuery) || 
        (score.youtube_url && score.youtube_url.toLowerCase().includes(lowercaseQuery))
      );
      setFilteredScores(filtered);
    } else if (scores) {
      setFilteredScores(scores);
    }
  }, [scores, query]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {query ? `Search results for "${query}"` : "All Scores"}
        </h1>
        <p className="text-muted-foreground">
          {filteredScores.length} {filteredScores.length === 1 ? "result" : "results"} found
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
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
        </div>
      ) : (
        <ScoreGrid 
          scores={filteredScores} 
          isLoading={false} 
          title={query ? `Results for "${query}"` : "All Scores"}
          showSearch={true}
        />
      )}
    </div>
  );
}
