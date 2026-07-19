import { lazy, Suspense, useState } from "react";
import { RegistryProvider, useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { MagnifyingGlassIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { RfdId } from "@crdt-rfd/domain";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { RfdSearchProvider } from "@/components/rfd-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { rfdDocumentAtom, searchDialogOpenAtom, sessionAtom, signOutAtom } from "@/rpc/client";

const RfdEditor = lazy(() =>
  import("@/components/editor/rfd-editor").then((module) => ({ default: module.RfdEditor })),
);

export const Route = createFileRoute("/rfd/$rfdId")({
  component: RfdPage,
});

function RfdPage() {
  return (
    <RegistryProvider defaultIdleTTL={60_000}>
      <RfdSearchProvider>
        <RfdPageChrome />
        <RfdRoute />
      </RfdSearchProvider>
    </RegistryProvider>
  );
}

function RfdPageChrome() {
  const session = useAtomValue(sessionAtom);
  const [signOutResult, signOut] = useAtom(signOutAtom);
  const setSearchOpen = useAtomSet(searchDialogOpenAtom);
  const signedIn = AsyncResult.isSuccess(session) && session.value !== null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between p-2 sm:p-3">
      <Link
        to="/"
        aria-label="RFD Archive home"
        className="pointer-events-auto inline-flex size-8 items-center justify-center border border-primary bg-primary text-primary-foreground transition-colors outline-none hover:bg-primary/80 focus-visible:ring-1 focus-visible:ring-ring/50"
      >
        <TreeStructureIcon size={18} aria-hidden="true" />
      </Link>

      <div className="pointer-events-auto flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSearchOpen(true)}
          aria-label="Search RFDs"
          aria-keyshortcuts="Meta+K Control+K"
        >
          <MagnifyingGlassIcon aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
        </Button>
        <ThemeToggle />
        {signedIn ? (
          <Button disabled={signOutResult.waiting} onClick={() => signOut()}>
            {signOutResult.waiting ? "Signing out…" : "Sign out"}
          </Button>
        ) : (
          <Button nativeButton={false} render={<Link to="/login" />}>
            Sign in
          </Button>
        )}
      </div>
    </div>
  );
}

function RfdRoute() {
  const { rfdId } = Route.useParams();
  const decoded = Schema.decodeUnknownResult(RfdId)(rfdId);

  return Result.isSuccess(decoded) ? (
    <RfdDocument rfdId={decoded.success} />
  ) : (
    <DocumentMessage message="This RFD link is invalid." />
  );
}

function RfdDocument({ rfdId }: { readonly rfdId: typeof RfdId.Type }) {
  const document = useAtomValue(rfdDocumentAtom(rfdId));
  const session = useAtomValue(sessionAtom);
  const [editing, setEditing] = useState(false);

  if (AsyncResult.isFailure(document)) {
    return <DocumentMessage message="The committed RFD could not be loaded. Try again shortly." />;
  }
  if (!AsyncResult.isSuccess(document)) {
    return <DocumentMessage message="Loading committed RFD…" />;
  }
  const user = AsyncResult.isSuccess(session) ? session.value?.user : undefined;
  if (editing && user !== undefined) {
    return (
      <Suspense fallback={<DocumentMessage message="Opening collaborative editor…" />}>
        <RfdEditor key={rfdId} rfdId={rfdId} user={user} onClose={() => setEditing(false)} />
      </Suspense>
    );
  }

  return (
    <main className="min-h-svh bg-background px-4 pt-28 pb-12 sm:px-6 sm:pt-32 sm:pb-20">
      <article className="mx-auto max-w-3xl">
        <Link to="/" className="font-mono text-xs tracking-wide text-primary uppercase">
          ← All RFDs
        </Link>
        {user === undefined ? null : (
          <Button type="button" className="float-right" onClick={() => setEditing(true)}>
            Edit collaboratively
          </Button>
        )}
        <header className="mt-10 border-b pb-8">
          <p className="font-mono text-xs text-primary">RFD {document.value.number}</p>
          <h1 className="mt-3 text-balance font-heading text-4xl leading-tight sm:text-5xl">
            {document.value.title}
          </h1>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {document.value.author} · {document.value.status} · {document.value.headSha.slice(0, 8)}
          </p>
        </header>
        <pre className="mt-10 overflow-x-auto whitespace-pre-wrap font-sans text-base leading-7">
          {document.value.body.trim()}
        </pre>
      </article>
    </main>
  );
}

function DocumentMessage({ message }: { readonly message: string }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 text-center">
      <div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link to="/" className="mt-4 inline-block font-mono text-xs text-primary uppercase">
          Return to the catalog
        </Link>
      </div>
    </main>
  );
}
