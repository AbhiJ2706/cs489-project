'use client';

import React, { ReactNode, useState } from 'react';
import { SnakeGame } from './SnakeGame';
import { XCircle, Minimize2, Maximize2 } from 'lucide-react';

interface LoadingScreenProps {
  isLoading: boolean;
  progress?: number;
  message?: string;
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  mediaPlayer?: ReactNode; 
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isLoading,
  progress = 0,
  message = 'Processing your audio...',
  onComplete,
  size = 'md',
  color = '#10b981',
  mediaPlayer
}) => {
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 bg-background rounded-lg shadow-lg p-3 cursor-pointer flex items-center space-x-2 border border-border animate-pulse"
        onClick={() => setMinimized(false)}
      >
        <div className="h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></div>
        <span className="font-medium text-sm">Processing: {Math.round(progress)}%</span>
        <Maximize2 className="h-4 w-4 text-muted-foreground ml-2" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-background rounded-lg p-6 shadow-lg max-w-md w-full mx-auto text-center relative">
        <div className="absolute top-3 right-3 flex space-x-2">
          <button 
            onClick={() => setMinimized(true)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Minimize"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
        </div>
        
        <h2 className="text-xl font-bold mb-4">{message}</h2>
        
        {mediaPlayer && (
          <div className="mb-4 rounded-md overflow-hidden">
            {mediaPlayer}
          </div>
        )}
        
        <div className="mb-4">
          <SnakeGame 
            isLoading={isLoading} 
            loadingProgress={progress} 
            onComplete={onComplete}
            size={size}
            color={color}
          />
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        
        <p className="text-sm text-gray-500">
          Play snake while you wait or minimize this window to continue browsing.
        </p>
      </div>
    </div>
  );
};
