"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { getApiBaseUrl } from "@/lib/apiUtils";

export default function SignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Function to handle Google Sign-In
  const handleGoogleSignIn = async () => {
    // In a real implementation, you would use a proper OAuth library
    // For now, we'll simulate the Google sign-in process
    setIsLoading(true);
    
    try {
      // Simulate Google authentication
      // In a real implementation, this would redirect to Google's OAuth page
      const mockGoogleUser = {
        token: "mock-google-token",
        name: "Test User",
        email: "test@example.com",
        profile_image: "https://ui-avatars.com/api/?name=Test+User",
        google_id: "google-123456789"
      };
      
      // Call our backend API to authenticate the user
      const response = await fetch(`${getApiBaseUrl()}/auth/google-signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockGoogleUser),
      });
      
      if (!response.ok) {
        throw new Error('Failed to authenticate with Google');
      }
      
      const data = await response.json();
      
      // Store the token in localStorage
      localStorage.setItem('auth_token', data.access_token);
      
      // Show success message
      toast.success("Successfully signed in!");
      
      // Redirect to home page
      router.push('/');
    } catch (error) {
      console.error("Authentication error:", error);
      toast.error("Failed to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Toaster />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to save and view your score sheet generations
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 gap-6">
            <Button 
              variant="outline" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-google">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  <path d="M12 16V8" />
                  <path d="M8 12h8" />
                </svg>
              )}
              Sign in with Google
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" disabled />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled>
            Sign In with Email
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
