import { lazy, Suspense, useState } from "react";
import {
  HydrationBoundary,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RfdReader } from "@/components/editor/rfd-reader";
import { useMountEffect } from "@/lib/use-mount-effect";
import {
  rfdDocumentAtom,
  rfdHistoryAtom,
  searchDialogOpenAtom,
  sessionAtom,
  signOutAtom,
} from "@/rpc/client";
import { getRfdInitialApplicationState } from "@/server/application/initial-state";

const loadCollaborativeDocument = () =>
  import("@/components/editor/rfd-editor").then((module) => ({
    default: module.RfdCollaborativeDocument,
  }));

const RfdCollaborativeDocument = lazy(loadCollaborativeDocument);

export const Route = createFileRoute("/rfd/$rfdId")({
  loader: ({ params }) => getRfdInitialApplicationState({ data: { rfdId: params.rfdId } }),
  component: RfdPage,
});

function RfdPage() {
  const state = Route.useLoaderData();

  return (
    <RegistryProvider defaultIdleTTL={60_000}>
      <HydrationBoundary state={state}>
        <RfdSearchProvider>
          <RfdPageChrome />
          <RfdRoute />
        </RfdSearchProvider>
      </HydrationBoundary>
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
  const prefetchHistory = useAtomRefresh(rfdHistoryAtom(rfdId));
  const session = useAtomValue(sessionAtom);
  const [live, setLive] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [checkpointMessage, setCheckpointMessage] = useState("");

  if (AsyncResult.isFailure(document)) {
    return <DocumentMessage message="The committed RFD could not be loaded. Try again shortly." />;
  }
  if (!AsyncResult.isSuccess(document)) {
    return <DocumentMessage message="Loading committed RFD…" />;
  }
  const user = AsyncResult.isSuccess(session) ? session.value?.user : undefined;
  const committed = document.value;

  if (live) {
    return (
      <main className="min-h-svh bg-background px-4 pt-28 pb-12 sm:px-6 sm:pt-32 sm:pb-20">
        <article className="mx-auto max-w-3xl">
          <Suspense fallback={<LiveDocumentPlaceholder committed={committed} />}>
            <RfdCollaborativeDocument
              key={rfdId}
              rfdId={rfdId}
              user={user}
              onCheckpoint={refreshDocument}
              renderMetadata={({ title, metadata, canEdit, setMetadata }) => (
                <EditableDocumentHeader
                  number={committed.number}
                  author={committed.author}
                  headSha={committed.headSha}
                  checkpointMessage={committed.checkpointMessage}
                  title={title || committed.title}
                  metadata={metadata}
                  canEdit={canEdit}
                  setMetadata={setMetadata}
                />
              )}
              renderActions={({ checkpoint, canPublish, roomState }) => (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      disabled={!canPublish}
                      onClick={() => setCheckpointDialogOpen(true)}
                    >
                      {roomState === "Checkpointing…" ? "Checkpointing…" : "Checkpoint"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setLive(false)}>
                      Close live view
                    </Button>
                  </div>
                  <Dialog open={checkpointDialogOpen} onOpenChange={setCheckpointDialogOpen}>
                    <DialogContent showCloseButton={false}>
                      <DialogHeader>
                        <DialogTitle>Create checkpoint</DialogTitle>
                        <DialogDescription>
                          Save the current document to Git. A message makes this checkpoint easier
                          to find in history.
                        </DialogDescription>
                      </DialogHeader>
                      <Input
                        autoFocus
                        aria-label="Checkpoint message"
                        maxLength={200}
                        placeholder="Describe this change (optional)"
                        value={checkpointMessage}
                        onChange={(event) => setCheckpointMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          checkpoint(checkpointMessage.trim() || undefined);
                          setCheckpointMessage("");
                          setCheckpointDialogOpen(false);
                        }}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCheckpointDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          disabled={roomState === "Checkpointing…"}
                          onClick={() => {
                            checkpoint(checkpointMessage.trim() || undefined);
                            setCheckpointMessage("");
                            setCheckpointDialogOpen(false);
                          }}
                        >
                          Save checkpoint
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
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
        <header className="relative border-b pb-7">
          <p className="font-mono text-xs text-primary">RFD {committed.number}</p>
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onPointerEnter={prefetchHistory}
              onFocus={prefetchHistory}
              onClick={() => {
                prefetchHistory();
                setHistoryOpen(true);
              }}
            >
              History
            </Button>
            <Button
              type="button"
              size="sm"
              onPointerEnter={() => void loadCollaborativeDocument()}
              onFocus={() => void loadCollaborativeDocument()}
              onClick={() => setLive(true)}
            >
              Edit
            </Button>
          </div>
          <h1 className="mt-3 text-balance font-heading text-4xl leading-tight sm:text-5xl">
            {committed.title}
          </h1>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {committed.author} · {committed.checkpointMessage} · {committed.headSha.slice(0, 8)}
            <span
              aria-label="Latest checkpoint"
              className="ml-2 inline-block size-2 rounded-full bg-primary align-middle"
            />
          </p>
        </header>
        <RfdReader source={committed.body} />
      </article>
      <HistoryPrefetch rfdId={rfdId} />
      {historyOpen ? (
        <RfdHistory
          rfdId={rfdId}
          current={{
            sha: committed.headSha,
            author: committed.author,
            updated: committed.updated,
            message: committed.checkpointMessage,
          }}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
    </main>
  );
}

function LiveDocumentPlaceholder({
  committed,
}: {
  readonly committed: {
    readonly number: number;
    readonly title: string;
    readonly author: string;
    readonly headSha: string;
    readonly checkpointMessage: string;
  };
}) {
  return (
    <>
      <header className="border-b pb-8">
        <p className="font-mono text-xs text-primary">RFD {committed.number}</p>
        <h1 className="mt-3 text-balance font-heading text-4xl leading-tight sm:text-5xl">
          {committed.title}
        </h1>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          {committed.author} · {committed.checkpointMessage} · {committed.headSha.slice(0, 8)}
        </p>
      </header>
      <Skeleton className="mt-10 min-h-[24rem]" aria-label="Loading live document" />
    </>
  );
}

function HistoryPrefetch({ rfdId }: { readonly rfdId: typeof RfdId.Type }) {
  const prefetchHistory = useAtomRefresh(rfdHistoryAtom(rfdId));

  useMountEffect(() => {
    const timer = window.setTimeout(prefetchHistory, 500);
    return () => window.clearTimeout(timer);
  });

  return null;
}

function RfdHistory({
  rfdId,
  current,
  onClose,
}: {
  readonly rfdId: typeof RfdId.Type;
  readonly current: {
    readonly sha: string;
    readonly message: string;
    readonly author: string;
    readonly updated: string;
  };
  readonly onClose: () => void;
}) {
  const history = useAtomValue(rfdHistoryAtom(rfdId));

  return (
    <Drawer open direction="right" onOpenChange={(open) => (open ? undefined : onClose())}>
      <DrawerContent aria-label="RFD history">
        <DrawerHeader className="flex-row items-start justify-between gap-4 border-b">
          <div>
            <p className="font-mono text-xs text-primary">Git history</p>
            <DrawerTitle className="mt-1">Checkpoints</DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button type="button" variant="outline" size="sm">
              Close
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-6">
          <div className="border-b py-4">
            <p className="text-sm font-medium text-foreground">{current.message}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {current.author} · {new Date(current.updated).toLocaleString()} ·{" "}
              {current.sha.slice(0, 8)}
              <span
                aria-label="Latest checkpoint"
                className="ml-2 inline-block size-2 rounded-full bg-primary align-middle"
              />
            </p>
          </div>
          {AsyncResult.isFailure(history) ? (
            <p className="pt-6 text-sm text-destructive">
              History could not be loaded. Try again shortly.
            </p>
          ) : !AsyncResult.isSuccess(history) ? (
            <p className="py-4 text-sm text-muted-foreground">Loading earlier checkpoints…</p>
          ) : (
            <ol className="divide-y">
              {history.value
                .filter((checkpoint) => checkpoint.sha !== current.sha)
                .map((checkpoint) => (
                  <li key={checkpoint.sha} className="py-4">
                    <p className="text-sm font-medium text-foreground">{checkpoint.message}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {checkpoint.author} · {new Date(checkpoint.createdAt).toLocaleString()} ·{" "}
                      {checkpoint.sha.slice(0, 8)}
                    </p>
                  </li>
                ))}
            </ol>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function EditableDocumentHeader({
  number,
  author,
  headSha,
  checkpointMessage,
  title,
  metadata,
  canEdit,
  setMetadata,
}: {
  readonly number: number;
  readonly author: string;
  readonly headSha: string;
  readonly checkpointMessage: string;
  readonly title: string;
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
        {author} · {checkpointMessage} · {headSha.slice(0, 8)}
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
