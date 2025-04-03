'use client';

import {
  useAuth,
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs';
import { init } from '@instantdb/react';
import { useEffect } from 'react';

// ID for app: Dascore
const APP_ID = '6624afdc-c7a0-4519-a142-f06f54a115b9';

const db = init({ appId: APP_ID });

// Use the clerk client name you set in the Instant dashboard auth tab
const CLERK_CLIENT_NAME = 'dascore';

function InstantAuth() {
  const { getToken, signOut } = useAuth();

  useEffect(() => {
    const signInToInstantWithClerkToken = async () => {
      // getToken gets the jwt from Clerk for your signed in user.
      const idToken = await getToken();

      if (!idToken) {
        // No jwt, can't sign in to instant
        return;
      }

      // Create a long-lived session with Instant for your clerk user
      // It will look up the user by email or create a new user with
      // the email address in the session token.
      db.auth.signInWithIdToken({
        clientName: CLERK_CLIENT_NAME,
        idToken: idToken,
      });
    };

    signInToInstantWithClerkToken();
  }, [getToken]);

  const { isLoading, user, error } = db.useAuth();

  if (isLoading) {
    return null;
  }
  
  if (error) {
    console.error("Error signing in to Instant:", error.message);
    return null;
  }
  
  return null; // Auth happens in the background, no UI needed
}

export function AuthButton() {
  return (
    <>
      <SignedIn>
        <div className="flex items-center gap-2">
          <UserButton afterSignOutUrl="/" />
          <InstantAuth />
        </div>
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </>
  );
}
