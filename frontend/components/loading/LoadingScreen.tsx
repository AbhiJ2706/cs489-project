'use client';

import React from 'react';
import { SnakeGame } from './SnakeGame';

interface LoadingScreenProps {
  isLoading: boolean;
  progress?: number;
  message?: string;
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isLoading,
  progress = 0,
  message = 'Processing your audio...',
  onComplete,
  size = 'md',
  color = '#10b981'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-background rounded-lg p-6 shadow-lg max-w-md w-full mx-auto text-center">
        <h2 className="text-xl font-bold mb-4">{message}</h2>
        
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
          Play snake while you wait! Use arrow keys or swipe to control.
        </p>
      </div>
    </div>
  );
};
