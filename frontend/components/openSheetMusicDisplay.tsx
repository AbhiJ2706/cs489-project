"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface OpenSheetMusicDisplayProps {
  musicXml: string;
  options?: {
    autoResize?: boolean;
    drawTitle?: boolean;
    drawSubtitle?: boolean;
    drawComposer?: boolean;
    drawCredits?: boolean;
    drawPartNames?: boolean;
    drawMeasureNumbers?: boolean;
    drawTimeSignatures?: boolean;
    drawMetronomeMarks?: boolean;
    [key: string]: any;
  };
}

export function OpenSheetMusicDisplay({ musicXml, options = {} }: OpenSheetMusicDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<any>(null);
  const isScriptLoadedRef = useRef(false);

  // Initialize OSMD when the script is loaded
  const initializeOSMD = () => {
    if (!containerRef.current || !window.opensheetmusicdisplay) return;
    
    try {
      // Create a new instance of OpenSheetMusicDisplay
      osmdRef.current = new window.opensheetmusicdisplay.OpenSheetMusicDisplay(containerRef.current);
      
      // Apply options
      Object.entries(options).forEach(([key, value]) => {
        if (osmdRef.current.EngravingRules && key in osmdRef.current.EngravingRules) {
          osmdRef.current.EngravingRules[key] = value;
        } else if (key in osmdRef.current) {
          osmdRef.current[key] = value;
        }
      });
      
      // Load and render the MusicXML
      osmdRef.current.load(musicXml)
        .then(() => {
          osmdRef.current.render();
        })
        .catch((error: any) => {
          console.error("Error rendering MusicXML:", error);
        });
    } catch (error) {
      console.error("Error initializing OSMD:", error);
    }
  };

  // Handle script load event
  const handleScriptLoad = () => {
    isScriptLoadedRef.current = true;
    initializeOSMD();
  };

  // Re-render when musicXml changes
  useEffect(() => {
    if (isScriptLoadedRef.current && osmdRef.current && musicXml) {
      try {
        osmdRef.current.load(musicXml)
          .then(() => {
            osmdRef.current.render();
          })
          .catch((error: any) => {
            console.error("Error rendering MusicXML:", error);
          });
      } catch (error) {
        console.error("Error loading MusicXML:", error);
      }
    }
  }, [musicXml]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (osmdRef.current) {
        try {
          osmdRef.current.clear();
        } catch (error) {
          console.error("Error clearing OSMD:", error);
        }
      }
    };
  }, []);

  return (
    <>
      <Script 
        src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.0/build/opensheetmusicdisplay.min.js"
        onLoad={handleScriptLoad}
        strategy="afterInteractive"
      />
      <div ref={containerRef} className="w-full min-h-[500px]" />
    </>
  );
}

// Add the OSMD type to the window object
declare global {
  interface Window {
    opensheetmusicdisplay: {
      OpenSheetMusicDisplay: new (element: HTMLElement) => any;
    };
  }
} 