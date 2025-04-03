'use client'

import { useEffect, useRef, useState } from 'react'

interface SpotifyPlayerProps {
  trackId: string
  width?: string
  height?: string
  autoplay?: boolean
}

const SpotifyPlayer = ({
  trackId,
  width = '100%',
  height = '152',
  autoplay = true
}: SpotifyPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [controller, setController] = useState<any>(null)
  const [iframeApiLoaded, setIframeApiLoaded] = useState(false)
  
  console.log("SpotifyPlayer rendering with trackId:", trackId)
  
  // Load the Spotify iframe API
  useEffect(() => {
    console.log("Loading Spotify iframe API")
    if (document.getElementById('spotify-iframe-api')) {
      console.log("Spotify iframe API script already exists")
      setIframeApiLoaded(true)
      return
    }
    
    const script = document.createElement('script')
    script.id = 'spotify-iframe-api'
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    
    script.onload = () => {
      console.log("Spotify iframe API loaded successfully")
      setIframeApiLoaded(true)
    }
    
    document.body.appendChild(script)
    console.log("Added Spotify iframe API script to body")
    
    return () => {
      // Clean up if needed
    }
  }, [])
  
  // Initialize the iframe controller
  useEffect(() => {
    console.log("Initialize controller effect - trackId:", trackId, "iframeApiLoaded:", iframeApiLoaded, "containerRef exists:", !!containerRef.current)
    if (!trackId || !iframeApiLoaded || !containerRef.current) return
    
    const initializeController = () => {
      if (!window.SpotifyIframeApi) {
        console.log("window.SpotifyIframeApi not available yet")
        return
      }
      
      console.log("Creating Spotify controller with URI:", `spotify:track:${trackId}`)
      window.SpotifyIframeApi.createController(
        containerRef.current,
        {
          width,
          height,
          uri: `spotify:track:${trackId}`,
          autoplay
        },
        (embedController) => {
          console.log("Spotify controller created successfully")
          setController(embedController)
          
          // Add ready listener and start playing immediately
          embedController.addListener('ready', () => {
            console.log('Spotify embed ready, starting playback')
            embedController.play()
          })
        }
      )
    }
    
    if (window.SpotifyIframeApi) {
      console.log("SpotifyIframeApi available, initializing controller")
      initializeController()
    } else {
      console.log("Setting up onSpotifyIframeApiReady callback")
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        console.log("Spotify iframe API ready callback triggered")
        window.SpotifyIframeApi = IFrameAPI
        initializeController()
      }
    }
    
    return () => {
      // Clean up controller if needed
    }
  }, [trackId, iframeApiLoaded, width, height, autoplay])
  
  // Update track when trackId changes
  useEffect(() => {
    if (controller && trackId) {
      console.log("Updating track with URI:", `spotify:track:${trackId}`)
      controller.loadUri(`spotify:track:${trackId}`)
    }
  }, [trackId, controller])
  
  return (
    <div className="rounded-md overflow-hidden aspect-video">
      {!controller && trackId && (
        <iframe
          src={`https://open.spotify.com/embed/track/${trackId}?autoplay=1`}
          width={width}
          height={height}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          className="w-full h-full"
        ></iframe>
      )}
      <div ref={containerRef}></div>
    </div>
  )
}

// Add typings for the Spotify iframe API
declare global {
  interface Window {
    onSpotifyIframeApiReady: (IFrameAPI: any) => void
    SpotifyIframeApi: any
  }
}

export default SpotifyPlayer
