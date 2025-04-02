'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAccessToken } from '@/lib/spotify-api';
import { Button } from '@/components/ui/button';

// Separate client component that uses search params
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(`Authentication failed: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('No authentication code received');
      return;
    }

    const processAuth = async () => {
      try {
        // Use Spotify client ID from env variables
        await getAccessToken(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '', code);
        setStatus('success');
        
        // Redirect back to upload page after a short delay
        setTimeout(() => {
          router.push('/upload');
        }, 2000);
      } catch (err) {
        console.error('Auth error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    processAuth();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <h1 className="text-2xl font-bold">Connecting to Spotify...</h1>
          <p className="text-muted-foreground">Please wait while we complete the authentication</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Successfully connected!</h1>
          <p className="text-muted-foreground">Redirecting you back to the upload page...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Connection failed</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => router.push('/upload')}>Return to Upload</Button>
        </div>
      )}
    </div>
  );
}

// Main component that wraps the CallbackHandler in a Suspense boundary
export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
