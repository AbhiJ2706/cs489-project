// Spotify API utility functions

export async function redirectToAuthCodeFlow(clientId: string): Promise<void> {
  // Log when this function is called
  console.log("→ Starting Spotify auth flow");

  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  // Store the code verifier in localStorage
  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", getRedirectUri());
  params.append(
    "scope",
    "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-read-recently-played user-top-read"
  );
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  console.log("→ Full authorization URL:", authUrl);

  // Redirect to the authorization URL
  window.location.href = authUrl;
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
    body: params,
  });

  const { access_token, expires_in } = await response.json();

  // Save the access token and expiration
  const expirationTime = new Date().getTime() + expires_in * 1000;
  localStorage.setItem("accessToken", access_token);
  localStorage.setItem("accessTokenExpiration", expirationTime.toString());

  return access_token;
}

export async function fetchProfile(): Promise<SpotifyProfile> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("No access token found");
  }

  const response = await fetch("https://api.spotify.com/v1/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchRecentlyPlayed() {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("No access token found");
  }

  const response = await fetch(
    "https://api.spotify.com/v1/me/player/recently-played",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recently played tracks");
  }

  const data = await response.json();
  return data.items;
}

type ItemType = "artists" | "tracks";
type TimeRange = "short_term" | "medium_term" | "long_term";

export async function fetchTopItems(
  type: ItemType = "tracks",
  timeRange: TimeRange = "medium_term",
  limit: number = 10,
  offset: number = 0
) {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("No access token found");
  }

  const url = new URL(`https://api.spotify.com/v1/me/top/${type}`);
  url.searchParams.append("time_range", timeRange);
  url.searchParams.append("limit", limit.toString());
  url.searchParams.append("offset", offset.toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch top ${type}: ${response.statusText}`);
  }

  return await response.json();
}

// Helper functions for PKCE auth
function generateCodeVerifier(length: number) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Helper function to get the correct redirect URI based on environment
function getRedirectUri(): string {
  console.log("→ getRedirectUri called");

  // Check if we're in a browser environment
  if (typeof window !== "undefined") {
    const { hostname, protocol, host } = window.location;
    console.log("→ Current hostname:", hostname);
    console.log("→ Window location:", {
      protocol,
      hostname,
      host,
      fullLocation: window.location.toString(),
      href: window.location.href,
    });

    // Direct approach - check if it's a visualize.music domain (with or without www)
    if (hostname.includes("visualize.music")) {
      console.log("→ visualize.music domain detected");
      return "https://visualize.music/callback";
    }

    // Localhost development
    if (hostname === "localhost") {
      console.log("→ Localhost detected, using localhost redirect");
      return "http://localhost:3000/callback";
    }

    console.log("→ No specific redirect rule matched for hostname:", hostname);
  } else {
    console.log("→ Window is undefined (likely server-side rendering)");
  }

  // Fallback, though this is likely to cause an error if it doesn't match what's registered
  console.log("→ Using fallback redirect URI");
  return "https://visualize.music/callback";
}

// Define TypeScript types for Spotify responses
interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
  country: string;
  product: string;
  // Add other properties as needed
}
