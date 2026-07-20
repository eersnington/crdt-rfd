import { HydrationBoundary, RegistryProvider, useAtom, useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useState, type FormEvent } from "react";

import { RfdExplorer } from "@/components/rfd-explorer";
import { RfdHeader } from "@/components/rfd-header";
import { RfdSearchProvider } from "@/components/rfd-search";
import { createRfdAtom, sessionAtom, signOutAtom } from "@/rpc/client";
import { getInitialApplicationState } from "@/server/application/initial-state";

export const Route = createFileRoute("/")({
  loader: () => getInitialApplicationState(),
  component: App,
});

function App() {
  const state = Route.useLoaderData();

  return (
    <RegistryProvider defaultIdleTTL={60_000}>
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
        {signedIn ? <CreateRfd /> : null}
        <RfdExplorer />
      </main>
    </RfdSearchProvider>
  );
}

function CreateRfd() {
  const [title, setTitle] = useState("");
  const [result, create] = useAtom(createRfdAtom);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = title.trim();
    if (normalized.length === 0 || result.waiting) return;
    create({ payload: { title: normalized }, reactivityKeys: ["catalog"] });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="new-rfd-title">
          RFD title
        </label>
        <input
          id="new-rfd-title"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder="Start a new discussion"
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={result.waiting || title.trim().length === 0}
          className="rounded-md bg-primary px-4 py-2 font-mono text-xs tracking-wide text-primary-foreground uppercase disabled:opacity-50"
        >
          {result.waiting ? "Creating…" : "New RFD"}
        </button>
      </form>
      {AsyncResult.isFailure(result) ? (
        <p className="pt-2 text-sm text-destructive">
          {"message" in result.cause
            ? String(result.cause.message)
            : "The RFD could not be created. Try again."}
        </p>
      ) : null}
      {AsyncResult.isSuccess(result) ? (
        <p className="pt-2 text-sm text-muted-foreground">
          RFD {result.value.number} was created and committed.
        </p>
      ) : null}
    </div>
  );
}
