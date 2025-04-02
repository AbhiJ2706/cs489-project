'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreGrid } from "@/components/scoreGrid";
import { useScoreGenerations } from "@/lib/api-hooks";
import { Skeleton } from "@/components/ui/skeleton";

export function SearchClient() {
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
          {query ? `Search Results for "${query}"` : "All Scores"}
        </h1>
        {query && (
          <p className="text-muted-foreground">
            Found {filteredScores.length} results
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredScores.length > 0 ? (
            <ScoreGrid scores={filteredScores} isLoading={isLoading} />
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No scores found matching your search criteria.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
