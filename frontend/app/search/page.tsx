import { Suspense } from "react";
import { SearchClient } from "@/components/searchClient";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading search results...</div>}>
      <SearchClient />
    </Suspense>
  );
}
