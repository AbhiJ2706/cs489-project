"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RoadmapPage() {
  const router = useRouter();
  const [iframeHeight, setIframeHeight] = useState("100vh");
  
  // Calculate the dynamic height on client-side
  useEffect(() => {
    // Account for the header + padding
    const height = window.innerHeight - 100;
    setIframeHeight(`${height}px`);
    
    // Add resize listener
    const handleResize = () => {
      const newHeight = window.innerHeight - 100;
      setIframeHeight(`${newHeight}px`);
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col w-full min-h-screen">
      <header className="p-4 bg-white/95 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">DaScore Project Roadmap</h1>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-4">
        <div className="w-full" style={{ height: iframeHeight }}>
          <iframe
            src="https://mew-edge.ideaflow.app/g/all/global-root-to-users/all/users-to-user-relation-id-google-oauth2|101211266193087387124/all/b2022661/959cf461"
            className="w-full h-full rounded-lg border"
            style={{ minHeight: "700px" }}
            allow="clipboard-read; clipboard-write; camera; microphone; geolocation; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals allow-top-navigation"
          ></iframe>
        </div>
      </main>
    </div>
  );
}