"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number[];
  onValueChange: (values: number[]) => void;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, value = [0], onValueChange, disabled = false, ...props }, ref) => {
    const currentValue = value[0] || min;
    const percentage = ((currentValue - min) / (max - min)) * 100;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value);
      onValueChange([newValue]);
    };
    
    return (
      <div
        ref={ref}
        className={cn("relative w-full touch-none select-none", className)}
        {...props}
      >
        <div className="relative h-1.5 w-full rounded-full bg-primary/20">
          <div 
            className="absolute h-full bg-primary rounded-full" 
            style={{ width: `${percentage}%` }} 
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div 
          className="absolute h-4 w-4 rounded-full border border-primary/50 bg-background shadow" 
          style={{ 
            left: `calc(${percentage}% - 0.5rem)`, 
            top: '-0.3125rem' 
          }}
        />
      </div>
    );
  }
);

Slider.displayName = "Slider";

export { Slider };
