/**
 * API utilities to centralize API endpoint handling
 */

// Define the base API URL for development and production
const DEV_API_URL = "http://localhost:8000";
const PROD_API_URL = "https://soundcloud-wrapper-production.up.railway.app";

/**
 * Get the base API URL based on the environment
 * Uses production URL in production environment, otherwise uses local development URL
 */
export const getApiBaseUrl = (): string => {
  // Check if we're in a production environment
  // In a real Next.js app, we could use process.env.NODE_ENV or NEXT_PUBLIC_* environment variables
  const isProduction = process.env.NODE_ENV === "production";
  return isProduction ? PROD_API_URL : DEV_API_URL;
};

/**
 * Helper function to build API endpoints
 * @param path - The API endpoint path (without leading slash)
 * @returns The full API URL
 */
export const apiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  // Ensure path doesn't start with a slash
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${baseUrl}/${normalizedPath}`;
};

/**
 * Enhanced fetch function that uses the correct API URL
 * @param path - The API endpoint path (without leading slash)
 * @param options - Standard fetch options
 * @returns Promise with the fetch response
 */
export const apiFetch = async <T = any>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  // Default fetch options with CORS settings
  const defaultOptions: RequestInit = {
    mode: 'cors',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  // Merge default options with provided options
  const fetchOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options?.headers || {}),
    },
  };
  
  const response = await fetch(apiUrl(path), fetchOptions);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return response as unknown as T;
  }
  
  // Parse JSON for JSON responses
  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    throw new Error('Failed to parse API response as JSON');
  }
};

/**
 * Helper function to download a file from the API
 * @param path - The API endpoint path
 * @param filename - The filename to save as
 */
export const apiDownload = (path: string, filename: string): void => {
  const url = apiUrl(path);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
