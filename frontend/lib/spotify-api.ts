// Spotify API utility functions

export async function redirectToAuthCodeFlow(clientId: string) {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", getRedirectUri());
  params.append("scope", "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-read-recently-played");
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function getAccessToken(clientId: string, code: string) {
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", getRedirectUri());
  params.append("code_verifier", verifier ?? "");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const { access_token, expires_in } = await response.json();
  
  // Save the access token and expiration
  const expirationTime = new Date().getTime() + expires_in * 1000;
  localStorage.setItem("accessToken", access_token);
  localStorage.setItem("accessTokenExpiration", expirationTime.toString());
  
  return access_token;
}

export async function fetchProfile(): Promise<SpotifyProfile> {
  const accessToken = localStorage.getItem('accessToken');
  
  if (!accessToken) {
    throw new Error('No access token found');
  }
  
  const response = await fetch("https://api.spotify.com/v1/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchRecentlyPlayed() {
  const accessToken = localStorage.getItem('accessToken');
  
  if (!accessToken) {
    throw new Error('No access token found');
  }
  
  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch recently played tracks');
  }

  const data = await response.json();
  return data.items;
}

// Helper functions for PKCE auth
function generateCodeVerifier(length: number) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper function to get the correct redirect URI based on environment
function getRedirectUri(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // In production (visualizer.music domain)
    if (window.location.hostname === 'visualizer.music') {
      return 'https://visualizer.music/callback';
    }
  }
  
  // Default to localhost for development
  return 'http://localhost:3000/callback';
}

// Define TypeScript types for Spotify responses
interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: Array<{url: string}>;
  country: string;
  product: string;
  // Add other properties as needed
}
