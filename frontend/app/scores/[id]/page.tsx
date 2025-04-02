import { Suspense } from 'react';
import ScoreClient from './ScoreClient';

// This type matches what Next.js 15 expects
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await the params Promise
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ScoreClient id={resolvedParams.id} />
    </Suspense>
  );
}
