import { lazy, Suspense, useState } from "react";
import {
  RegistryProvider,
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react";
import { MagnifyingGlassIcon, TreeStructureIcon } from "@phosphor-icons/react";
import { RfdId } from "@crdt-rfd/domain";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { RfdSearchProvider } from "@/components/rfd-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { RfdReader } from "@/components/editor/rfd-reader";
import { rfdDocumentAtom, searchDialogOpenAtom, sessionAtom, signOutAtom } from "@/rpc/client";

const RfdCollaborativeDocument = lazy(() =>
  import("@/components/editor/rfd-editor").then((module) => ({
    default: module.RfdCollaborativeDocument,
  })),
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
  const refreshDocument = useAtomRefresh(rfdDocumentAtom(rfdId));
  const session = useAtomValue(sessionAtom);
  const [editing, setEditing] = useState(false);

  if (AsyncResult.isFailure(document)) {
    return <DocumentMessage message="The committed RFD could not be loaded. Try again shortly." />;
  }
  if (!AsyncResult.isSuccess(document)) {
    return <DocumentMessage message="Loading committed RFD…" />;
  }
  const user = AsyncResult.isSuccess(session) ? session.value?.user : undefined;
  const committed = document.value;

  if (editing && user !== undefined) {
    return (
      <main className="min-h-svh bg-background px-4 pt-28 pb-12 sm:px-6 sm:pt-32 sm:pb-20">
        <article className="mx-auto max-w-3xl">
          <Suspense fallback={<DocumentMessage message="Opening collaborative editor…" />}>
            <RfdCollaborativeDocument
              key={rfdId}
              rfdId={rfdId}
              user={user}
              onCheckpoint={refreshDocument}
              renderMetadata={({ title, status, metadata, canEdit, setMetadata }) => (
                <EditableDocumentHeader
                  number={committed.number}
                  author={committed.author}
                  headSha={committed.headSha}
                  title={title}
                  status={status}
                  metadata={metadata}
                  canEdit={canEdit}
                  setMetadata={setMetadata}
                />
              )}
              renderActions={({ publish, canPublish }) => (
                <div className="flex items-center gap-2">
                  <Button type="button" disabled={!canPublish} onClick={publish}>
                    Publish
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Done editing
                  </Button>
                </div>
              )}
            />
          </Suspense>
        </article>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-background px-4 pt-28 pb-12 sm:px-6 sm:pt-32 sm:pb-20">
      <article className="mx-auto max-w-3xl">
        <header className="border-b pb-8">
          <p className="font-mono text-xs text-primary">RFD {committed.number}</p>
          <h1 className="mt-3 text-balance font-heading text-4xl leading-tight sm:text-5xl">
            {committed.title}
          </h1>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {committed.author} · {committed.status} · {committed.headSha.slice(0, 8)}
          </p>
          {user === undefined ? null : (
            <Button type="button" className="mt-4" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </header>
        <RfdReader source={committed.body} />
      </article>
    </main>
  );
}

function EditableDocumentHeader({
  number,
  author,
  headSha,
  title,
  status,
  metadata,
  canEdit,
  setMetadata,
}: {
  readonly number: number;
  readonly author: string;
  readonly headSha: string;
  readonly title: string;
  readonly status: string;
  readonly metadata: {
    readonly authors?: readonly string[];
    readonly reviewers?: readonly string[];
    readonly related?: readonly number[];
    readonly supersedes?: readonly number[];
  };
  readonly canEdit: boolean;
  readonly setMetadata: (key: string, value: unknown) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <header className="border-b pb-8">
      <p className="font-mono text-xs text-primary">RFD {number}</p>
      <input
        aria-label="RFD title"
        readOnly={!canEdit}
        className="mt-3 w-full bg-transparent text-balance font-heading text-4xl leading-tight outline-none focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-5xl"
        value={title}
        onChange={(event) => setMetadata("title", event.target.value)}
      />
      <p className="mt-4 font-mono text-xs text-muted-foreground">
        {author} ·{" "}
        <select
          aria-label="RFD status"
          disabled={!canEdit}
          className="bg-transparent font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
          value={status}
          onChange={(event) => setMetadata("status", event.target.value)}
        >
          {(["draft", "discussion", "accepted", "rejected", "superseded"] as const).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>{" "}
        · {headSha.slice(0, 8)}
      </p>
      <button
        type="button"
        className="mt-4 font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => setDetailsOpen((open) => !open)}
      >
        Document details
      </button>
      {detailsOpen ? (
        <dl className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
          <MetadataListInput
            label="Authors"
            value={metadata.authors?.join(", ") ?? ""}
            canEdit={canEdit}
            onCommit={(items) => setMetadata("authors", items)}
          />
          <MetadataListInput
            label="Reviewers"
            value={metadata.reviewers?.join(", ") ?? ""}
            canEdit={canEdit}
            onCommit={(items) => setMetadata("reviewers", items)}
          />
          <MetadataListInput
            label="Related RFD numbers"
            value={metadata.related?.join(", ") ?? ""}
            canEdit={canEdit}
            onCommit={(items) =>
              setMetadata(
                "related",
                items.flatMap((item) => {
                  const number = Number(item);
                  return Number.isInteger(number) && number > 0 ? [number] : [];
                }),
              )
            }
          />
          <MetadataListInput
            label="Supersedes RFD numbers"
            value={metadata.supersedes?.join(", ") ?? ""}
            canEdit={canEdit}
            onCommit={(items) =>
              setMetadata(
                "supersedes",
                items.flatMap((item) => {
                  const number = Number(item);
                  return Number.isInteger(number) && number > 0 ? [number] : [];
                }),
              )
            }
          />
        </dl>
      ) : null}
    </header>
  );
}

function MetadataListInput({
  label,
  value,
  canEdit,
  onCommit,
}: {
  readonly label: string;
  readonly value: string;
  readonly canEdit: boolean;
  readonly onCommit: (items: string[]) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        key={value}
        readOnly={!canEdit}
        className="mt-1 w-full border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-ring/50"
        defaultValue={value}
        onBlur={(event) =>
          onCommit(
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    </label>
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
