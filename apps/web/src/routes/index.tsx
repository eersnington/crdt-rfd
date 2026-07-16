import { HydrationBoundary, RegistryProvider, useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { RfdExplorer } from "@/components/rfd-explorer";
import { RfdHeader } from "@/components/rfd-header";
import { RfdSearchProvider } from "@/components/rfd-search";
import { sessionAtom, signOutAtom } from "@/rpc/client";
import { getInitialApplicationState } from "@/server/application/initial-state";

export const Route = createFileRoute("/")({
  loader: () => getInitialApplicationState(),
  component: App,
});

function App() {
  const state = Route.useLoaderData();

  return (
    <RegistryProvider key={state[0]?.dehydratedAt} defaultIdleTTL={60_000}>
      <HydrationBoundary state={state}>
        <Archive />
      </HydrationBoundary>
    </RegistryProvider>
  );
}

function Archive() {
  const session = useAtomValue(sessionAtom);
  const [signOutResult, signOut] = useAtom(signOutAtom);
  const signedIn = AsyncResult.isSuccess(session) && session.value !== null;

  return (
    <RfdSearchProvider>
      <main className="min-h-svh bg-background">
        <RfdHeader
          signedIn={signedIn}
          signingOut={signOutResult.waiting}
          onSignOut={() => signOut()}
        />
        {AsyncResult.isFailure(session) ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-center text-sm text-destructive">
            Your session could not be loaded. Sign in again or refresh the page to retry.
          </div>
        ) : null}
        {AsyncResult.isFailure(signOutResult) ? (
          <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-center text-sm text-destructive">
            Sign out failed. Check your connection and try again; your current session is unchanged.
          </div>
        ) : null}
        <RfdExplorer />
      </main>
    </RfdSearchProvider>
  );
}
