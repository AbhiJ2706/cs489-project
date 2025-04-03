'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSwipeable } from 'react-swipeable';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type SnakePart = Position;

interface SnakeGameProps {
  isLoading: boolean;
  loadingProgress?: number; // 0-100
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const CELL_SIZE = 15;
const GAME_SPEED = 100;
const GRID_SIZE = { width: 20, height: 20 };

export const SnakeGame: React.FC<SnakeGameProps> = ({
  isLoading,
  loadingProgress = 0,
  onComplete,
  size = 'md',
  color = '#10b981' // emerald-500
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [snake, setSnake] = useState<SnakePart[]>([
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 }
  ]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const requestRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);

  // Calculate canvas size based on the size prop
  const getCanvasSize = () => {
    switch (size) {
      case 'sm':
        return { width: 200, height: 200 };
      case 'md':
        return { width: 300, height: 300 };
      case 'lg':
        return { width: 400, height: 400 };
    }
  };

  const canvasSize = getCanvasSize();

  // Handle swipes for mobile
  const swipeHandlers = useSwipeable({
    onSwipedUp: () => direction !== 'DOWN' && setDirection('UP'),
    onSwipedDown: () => direction !== 'UP' && setDirection('DOWN'),
    onSwipedLeft: () => direction !== 'RIGHT' && setDirection('LEFT'),
    onSwipedRight: () => direction !== 'LEFT' && setDirection('RIGHT'),
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  // Reset game
  const resetGame = () => {
    setSnake([
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 }
    ]);
    setDirection('RIGHT');
    setGameOver(false);
    setScore(0);
    placeFood();
  };

  // Place food at random position
  const placeFood = () => {
    const newFood = {
      x: Math.floor(Math.random() * GRID_SIZE.width),
      y: Math.floor(Math.random() * GRID_SIZE.height)
    };
    
    // Make sure food doesn't appear on the snake
    const isOnSnake = snake.some(part => part.x === newFood.x && part.y === newFood.y);
    if (isOnSnake) {
      placeFood();
    } else {
      setFood(newFood);
    }
  };

  // Check if snake hit itself or wall
  const checkCollision = (head: Position): boolean => {
    // Check wall collision
    if (
      head.x < 0 ||
      head.x >= GRID_SIZE.width ||
      head.y < 0 ||
      head.y >= GRID_SIZE.height
    ) {
      return true;
    }

    // Check self collision (except the tail which will move)
    for (let i = 1; i < snake.length; i++) {
      if (head.x === snake[i].x && head.y === snake[i].y) {
        return true;
      }
    }
    
    return false;
  };

  // Game loop
  const gameLoop = (timestamp: number) => {
    if (!canvasRef.current || gameOver || isPaused) return;

    // Calculate delta time
    const deltaTime = timestamp - lastRenderTimeRef.current;
    
    if (deltaTime >= GAME_SPEED) {
      lastRenderTimeRef.current = timestamp;
      
      updateGameState();
      drawGame();
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };
  
  // Update game state (move snake, check collisions)
  const updateGameState = () => {
    const newSnake = [...snake];
    const head = { ...newSnake[0] };

    // Move head based on direction
    switch (direction) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // Check if game over
    if (checkCollision(head)) {
      setGameOver(true);
      return;
    }

    // Insert new head
    newSnake.unshift(head);
    
    // Check if food eaten
    if (head.x === food.x && head.y === food.y) {
      setScore(prev => prev + 1);
      placeFood();
    } else {
      // Remove tail if no food eaten
      newSnake.pop();
    }

    setSnake(newSnake);
  };

  // Draw game
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate cell size based on canvas size
    const cellWidth = canvas.width / GRID_SIZE.width;
    const cellHeight = canvas.height / GRID_SIZE.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    ctx.fillStyle = color;
    snake.forEach((part, index) => {
      // Head has a different shade
      if (index === 0) {
        ctx.fillStyle = color;
      } else {
        // Make body slightly transparent
        ctx.fillStyle = `${color}cc`;
      }
      
      ctx.fillRect(
        part.x * cellWidth,
        part.y * cellHeight,
        cellWidth,
        cellHeight
      );
      
      // Add rounded corners for better visuals
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        part.x * cellWidth + 1,
        part.y * cellHeight + 1,
        cellWidth - 2,
        cellHeight - 2
      );
    });

    // Draw food
    ctx.fillStyle = '#f43f5e'; // rose-500
    ctx.beginPath();
    ctx.arc(
      food.x * cellWidth + cellWidth / 2,
      food.y * cellHeight + cellHeight / 2,
      cellWidth / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Draw loading progress text
    if (isLoading) {
      ctx.fillStyle = 'white';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Loading... ${Math.round(loadingProgress)}%`,
        canvas.width / 2,
        canvas.height - 20
      );
    }
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
          if (direction !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
          if (direction !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
          if (direction !== 'LEFT') setDirection('RIGHT');
          break;
        case ' ':
          setIsPaused(prev => !prev);
          break;
        case 'r':
          resetGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  // Start/stop game loop
  useEffect(() => {
    if (isLoading && !gameOver && !isPaused) {
      lastRenderTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isLoading, gameOver, isPaused, snake]);

  // Handle completion
  useEffect(() => {
    if (loadingProgress >= 100 && onComplete) {
      onComplete();
    }
  }, [loadingProgress, onComplete]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set actual canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    // Initial draw
    drawGame();
  }, [canvasSize]);

  // Place initial food
  useEffect(() => {
    placeFood();
  }, []);

  return (
    <div 
      {...swipeHandlers} 
      className="flex flex-col items-center justify-center touch-none select-none"
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border border-gray-300 rounded-lg shadow-md bg-gray-900"
        style={{ 
          width: canvasSize.width, 
          height: canvasSize.height, 
          touchAction: 'none' 
        }}
      />
      
      {/* Mobile controls */}
      <div className="md:hidden mt-4 grid grid-cols-3 gap-2">
        <div />
        <button
          className="p-4 bg-gray-800 rounded-lg shadow-md"
          onClick={() => direction !== 'DOWN' && setDirection('UP')}
        >
          ↑
        </button>
        <div />
        
        <button
          className="p-4 bg-gray-800 rounded-lg shadow-md"
          onClick={() => direction !== 'RIGHT' && setDirection('LEFT')}
        >
          ←
        </button>
        <button
          className="p-4 bg-gray-800 rounded-lg shadow-md"
          onClick={() => setIsPaused(prev => !prev)}
        >
          {isPaused ? '▶️' : '⏸️'}
        </button>
        <button
          className="p-4 bg-gray-800 rounded-lg shadow-md"
          onClick={() => direction !== 'LEFT' && setDirection('RIGHT')}
        >
          →
        </button>
        
        <div />
        <button
          className="p-4 bg-gray-800 rounded-lg shadow-md"
          onClick={() => direction !== 'UP' && setDirection('DOWN')}
        >
          ↓
        </button>
        <div />
      </div>
      
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-bold mb-2">Game Over!</h2>
            <p className="mb-4">Score: {score}</p>
            <button
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              onClick={resetGame}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
