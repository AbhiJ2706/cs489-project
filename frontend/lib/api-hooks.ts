import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/apiUtils";

// Types
export interface ScoreGeneration {
  id: number;
  title: string;
  file_id: string;
  youtube_url?: string;
  thumbnail_url?: string;
  created_at: string;
  user_id?: number;
}

export interface ScoreGenerationCreate {
  title: string;
  file_id: string;
  youtube_url?: string;
  thumbnail_url?: string;
}

// Helper function to check if we're in a browser environment
const isBrowser = () => typeof window !== 'undefined';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = isBrowser() ? localStorage.getItem("auth_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Fetch all score generations
export const useScoreGenerations = () => {
  return useQuery({
    queryKey: ["scoreGenerations"],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/scores`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch score generations");
      }
      
      return response.json() as Promise<ScoreGeneration[]>;
    },
    // enabled: isBrowser() ? !!localStorage.getItem("auth_token") : false,
  });
};

// Fetch a single score generation
export const useScoreGeneration = (id: number) => {
  return useQuery({
    queryKey: ["scoreGeneration", id],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/scores/${id}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch score generation");
      }
      
      return response.json() as Promise<ScoreGeneration>;
    },
    // enabled: !!id && (isBrowser() ? !!localStorage.getItem("auth_token") : false),
  });
};

// Create a new score generation
export const useCreateScoreGeneration = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ScoreGenerationCreate) => {
      const response = await fetch(`${getApiBaseUrl()}/scores`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create score generation");
      }
      
      return response.json() as Promise<ScoreGeneration>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreGenerations"] });
    },
  });
};

// Delete a score generation
export const useDeleteScoreGeneration = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${getApiBaseUrl()}/scores/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete score generation");
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreGenerations"] });
    },
  });
};
