import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { RfdExplorer } from "@/components/rfd-explorer";
import { RfdHeader } from "@/components/rfd-header";
import { RfdSearchProvider } from "@/components/rfd-search";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/server/auth-functions";

export const Route = createFileRoute("/")({
  loader: () => getSession(),
  component: App,
});

function App() {
  const session = Route.useLoaderData();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    setIsSigningOut(true);
    const result = await authClient.signOut();

    if (result.error) {
      setIsSigningOut(false);
      return;
    }

    await router.invalidate();
  };

  return (
    <RfdSearchProvider>
      <main className="min-h-svh bg-background">
        <RfdHeader signedIn={session !== null} signingOut={isSigningOut} onSignOut={signOut} />
        <RfdExplorer />
      </main>
    </RfdSearchProvider>
  );
}
