import { useEffect, useState, useRef } from 'react';
import * as Slider from '@radix-ui/react-slider';

interface RangeSelectorProps {
  min: number;
  max: number;
  defaultValue?: [number, number];
  step?: number;
  onValueChange?: (value: [number, number]) => void;
  disabled?: boolean;
  className?: string;
}

export function RangeSelector({
  min,
  max,
  defaultValue = [min, max],
  step = 1,
  onValueChange,
  disabled = false,
  className = "",
}: RangeSelectorProps) {
  // Initialize with default or min/max
  const initialValue: [number, number] = [
    Math.max(min, defaultValue[0]),
    Math.min(max, defaultValue[1]),
  ];

  const [value, setValue] = useState<[number, number]>(initialValue);

  // Track previous values to detect changes
  const prevMinRef = useRef(min);
  const prevMaxRef = useRef(max);
  const prevDefaultValueRef = useRef<[number, number]>(defaultValue);
  
  // Update internal state when props change
  useEffect(() => {
    const minChanged = min !== prevMinRef.current;
    const maxChanged = max !== prevMaxRef.current;
    const defaultValueChanged = 
      defaultValue[0] !== prevDefaultValueRef.current[0] || 
      defaultValue[1] !== prevDefaultValueRef.current[1];
    
    // Only run this effect if relevant props have changed
    if (minChanged || maxChanged || defaultValueChanged) {
      // If default value changed significantly, prioritize it
      let newValue: [number, number];
      
      if (defaultValueChanged && 
          (defaultValue[1] - defaultValue[0]) > (value[1] - value[0])) {
        // Use new default values if they represent a wider range
        newValue = [
          Math.max(min, defaultValue[0]),
          Math.min(max, defaultValue[1])
        ];
      } else {
        // Otherwise adjust current values to fit within new min/max
        newValue = [
          Math.max(min, Math.min(value[0], max)),
          Math.min(max, Math.max(value[1], min))
        ];
      }
      
      // Only update if there's actually a change needed
      if (newValue[0] !== value[0] || newValue[1] !== value[1]) {
        setValue(newValue);
        // Also notify parent of the change
        onValueChange?.(newValue);
      }
      
      // Update refs for next comparison
      prevMinRef.current = min;
      prevMaxRef.current = max;
      prevDefaultValueRef.current = defaultValue;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]); // Intentionally exclude 'value' to prevent infinite re-renders

  const handleValueChange = (newValue: number[]) => {
    const typedValue: [number, number] = [newValue[0], newValue[1]];
    setValue(typedValue);
    onValueChange?.(typedValue);
  };

  return (
    <Slider.Root
      className={`relative flex items-center select-none touch-none w-full ${className}`}
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <Slider.Track className="relative flex-grow h-2 bg-secondary rounded-full">
        <Slider.Range className="absolute h-full bg-primary rounded-full" />
      </Slider.Track>
      <Slider.Thumb
        className="block h-5 w-5 rounded-full border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        aria-label="Minimum"
      />
      <Slider.Thumb
        className="block h-5 w-5 rounded-full border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        aria-label="Maximum"
      />
    </Slider.Root>
  );
}
