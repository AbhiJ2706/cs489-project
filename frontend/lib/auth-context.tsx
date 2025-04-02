"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/apiUtils";

// Helper function to check if we're in a browser environment
const isBrowser = () => typeof window !== 'undefined';

interface User {
  id: number;
  email: string;
  name: string;
  profile_image?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (isBrowser()) {
        const token = localStorage.getItem("auth_token");
        if (token) {
          try {
            await fetchUserProfile(token);
          } catch (error) {
            console.error("Failed to fetch user profile:", error);
            localStorage.removeItem("auth_token");
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const fetchUserProfile = async (token: string) => {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user profile");
    }

    const userData = await response.json();
    setUser(userData);
  };

  const login = async (token: string) => {
    if (isBrowser()) {
      localStorage.setItem("auth_token", token);
    }
    await fetchUserProfile(token);
  };

  const logout = () => {
    if (isBrowser()) {
      localStorage.removeItem("auth_token");
    }
    setUser(null);
  };

  const getToken = () => {
    return isBrowser() ? localStorage.getItem("auth_token") : null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
