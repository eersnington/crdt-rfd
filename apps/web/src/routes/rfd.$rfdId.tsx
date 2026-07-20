import { lazy, Suspense, useRef, useState, type ReactNode } from "react";
import {
  HydrationBoundary,
  RegistryProvider,
  useAtom,
  useAtomRefresh,
  useAtomValue,
} from "@effect/atom-react";
import {
  CaretDownIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { BranchName, RfdId, type CommitSha, type RfdRef } from "@crdt-rfd/domain";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Cause, Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { RfdHeader } from "@/components/rfd-header";
import { RfdSearchProvider } from "@/components/rfd-search";
import { RfdStatusControl } from "@/components/rfd-status-control";
import { Button } from "@/components/ui/button";
import { parseRfdStatus } from "@/lib/rfd-presentation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RfdReader } from "@/components/editor/rfd-reader";
import { useMountEffect } from "@/lib/use-mount-effect";
import {
  rfdDocumentAtom,
  rfdHistoryAtom,
  rfdRefAtom,
  cloneCredentialAtom,
  forkRfdAtom,
  sessionAtom,
  signOutAtom,
} from "@/rpc/client";
import { getRfdInitialApplicationState } from "@/server/application/initial-state";

const loadCollaborativeDocument = () =>
  import("@/components/editor/rfd-editor").then((module) => ({
    default: module.RfdCollaborativeDocument,
  }));

const RfdCollaborativeDocument = lazy(loadCollaborativeDocument);
const mainBranch = Schema.decodeUnknownSync(BranchName)("main");

// Page-level document actions speak in the same mono-uppercase voice as the
// catalog's primary actions and the metadata eyebrows.
const actionButtonClass = "font-mono text-xs uppercase tracking-wider";

const rpcFailureMessage = (cause: Cause.Cause<unknown>, fallback: string): string => {
  const squashed = Cause.squash(cause);
  if (
    squashed !== null &&
    typeof squashed === "object" &&
    "message" in squashed &&
    typeof squashed.message === "string" &&
    squashed.message.length > 0
  ) {
    return squashed.message;
  }
  if (typeof squashed === "string" && squashed.length > 0) return squashed;
  return fallback;
};

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
  const signedIn = AsyncResult.isSuccess(session) && session.value !== null;

  return (
    <RfdHeader signedIn={signedIn} signingOut={signOutResult.waiting} onSignOut={() => signOut()} />
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
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<CommitSha | null>(null);
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [checkpointMessage, setCheckpointMessage] = useState("");

  if (AsyncResult.isFailure(document)) {
    return <DocumentMessage message="The committed RFD could not be loaded. Try again shortly." />;
  }
  if (!AsyncResult.isSuccess(document)) {
    return <DocumentMessage message="Loading committed RFD…" />;
  }
  const user = AsyncResult.isSuccess(session) ? session.value?.user : undefined;
  const signedIn = user !== undefined;
  const committed = document.value;

  if (selectedCheckpoint !== null) {
    return (
      <HistoricalRfdDocument
        rfdId={rfdId}
        sha={selectedCheckpoint}
        signedIn={signedIn}
        forkedFrom={committed.forkedFrom}
        onReturn={() => setSelectedCheckpoint(null)}
        onSelect={(next) => setSelectedCheckpoint(next)}
      />
    );
  }

  if (live) {
    return (
      <main className="min-h-svh bg-background">
        <article className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-24">
          <Suspense fallback={<LiveDocumentPlaceholder committed={committed} />}>
            <RfdCollaborativeDocument
              key={rfdId}
              rfdId={rfdId}
              user={user}
              baseline={{
                title: committed.title,
                status: committed.status,
                body: committed.body,
              }}
              onCheckpoint={refreshDocument}
              renderMetadata={({ title, status, metadata, canEdit, setMetadata }) => (
                <EditableDocumentHeader
                  number={committed.number}
                  forkedFrom={committed.forkedFrom}
                  author={committed.author}
                  headSha={committed.headSha}
                  checkpointMessage={committed.checkpointMessage}
                  title={title}
                  fallbackTitle={committed.title}
                  status={parseRfdStatus(status)}
                  metadata={metadata}
                  canEdit={canEdit}
                  setMetadata={setMetadata}
                />
              )}
              renderActions={({ checkpoint, canPublish, roomState }) => (
                <>
                  <div className="flex h-8 shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      className={actionButtonClass}
                      disabled={!canPublish}
                      onClick={() => setCheckpointDialogOpen(true)}
                    >
                      {roomState === "Checkpointing…" ? "Checkpointing…" : "Checkpoint"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={actionButtonClass}
                      onClick={() => setLive(false)}
                    >
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
    <main className="min-h-svh bg-background">
      <article className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-24">
        <header>
          <RfdEyebrow number={committed.number} forkedFrom={committed.forkedFrom} />
          <h1 className="mt-3 text-balance font-heading text-4xl leading-tight sm:text-5xl">
            {committed.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {signedIn ? (
              <Button
                type="button"
                className={actionButtonClass}
                onPointerEnter={() => void loadCollaborativeDocument()}
                onFocus={() => void loadCollaborativeDocument()}
                onClick={() => setLive(true)}
              >
                <PencilSimpleIcon aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={actionButtonClass}
              onPointerEnter={prefetchHistory}
              onFocus={prefetchHistory}
              onClick={() => setHistoryOpen(true)}
            >
              <ClockCounterClockwiseIcon aria-hidden="true" />
              History
            </Button>
            <VersionActions
              rfdId={rfdId}
              ref={{ _tag: "Branch", branch: mainBranch }}
              signedIn={signedIn}
              canFork={signedIn}
            />
          </div>
          <dl className="mt-8">
            <PropertyRow label="Status">
              <RfdStatusControl status={committed.status} canEdit={false} />
            </PropertyRow>
            <PropertyRow label="Author">{committed.author}</PropertyRow>
            <PropertyRow label="Updated">
              {new Date(committed.updated).toLocaleString()}
            </PropertyRow>
            <PropertyRow label="Checkpoint">
              <span className="font-mono text-xs">{committed.headSha.slice(0, 8)}</span>
              <span className="text-muted-foreground"> · {committed.checkpointMessage}</span>
              <span
                aria-label="Latest checkpoint"
                className="ml-2 inline-block size-2 rounded-full bg-primary align-middle"
              />
            </PropertyRow>
          </dl>
        </header>
        <RfdReader source={committed.body} />
      </article>
      <HistoryPrefetch rfdId={rfdId} />
      {historyOpen ? (
        <RfdHistory
          rfdId={rfdId}
          latest={{
            sha: committed.headSha,
            author: committed.author,
            updated: committed.updated,
            message: committed.checkpointMessage,
          }}
          viewingSha={committed.headSha}
          onClose={() => setHistoryOpen(false)}
          onSelect={(sha) => {
            setSelectedCheckpoint(sha);
            setHistoryOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function PropertyRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 border-t py-2.5 last:border-b">
      <dt className="w-20 shrink-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase sm:w-24">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}

function RfdEyebrow({
  number,
  forkedFrom,
}: {
  readonly number: number;
  readonly forkedFrom: { readonly rfdId: string; readonly number: number } | null;
}) {
  return (
    <p className="font-mono text-xs tracking-wider text-primary uppercase">
      RFD {number}
      {forkedFrom === null ? null : (
        <>
          <span className="text-muted-foreground"> · </span>
          <Link
            to="/rfd/$rfdId"
            params={{ rfdId: forkedFrom.rfdId }}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Fork of RFD {forkedFrom.number}
          </Link>
        </>
      )}
    </p>
  );
}

function LiveDocumentPlaceholder({
  committed,
}: {
  readonly committed: {
    readonly number: number;
    readonly title: string;
    readonly status: ReturnType<typeof parseRfdStatus>;
    readonly author: string;
    readonly headSha: string;
    readonly checkpointMessage: string;
    readonly body: string;
    readonly forkedFrom: { readonly rfdId: string; readonly number: number } | null;
  };
}) {
  return (
    <>
      <EditableDocumentHeader
        number={committed.number}
        forkedFrom={committed.forkedFrom}
        author={committed.author === "" ? "…" : committed.author}
        headSha={committed.headSha}
        checkpointMessage={committed.checkpointMessage}
        title={committed.title}
        fallbackTitle={committed.title}
        status={committed.status}
        metadata={{}}
        canEdit={false}
        setMetadata={() => undefined}
      />
      <div className="sticky top-14 z-30 -mx-4 mt-6 mb-8 border-b bg-background/90 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-[5.75rem] shrink-0 items-center" />
            <span className="min-w-40 truncate font-mono text-xs text-muted-foreground">
              Connecting…
            </span>
          </div>
          <div className="flex h-8 shrink-0 items-center gap-2">
            <Button type="button" className={actionButtonClass} disabled>
              Checkpoint
            </Button>
            <Button type="button" variant="outline" className={actionButtonClass} disabled>
              Close live view
            </Button>
          </div>
        </div>
      </div>
      <div className="min-h-[24rem]">
        {committed.body === "" ? (
          <Skeleton className="min-h-[24rem]" aria-label="Loading live document" />
        ) : (
          <RfdReader source={committed.body} />
        )}
      </div>
    </>
  );
}

function HistoryPrefetch({ rfdId }: { readonly rfdId: typeof RfdId.Type }) {
  const prefetchHistory = useAtomRefresh(rfdHistoryAtom(rfdId));

  useMountEffect(() => {
    prefetchHistory();
  });

  return null;
}

function RfdHistory({
  rfdId,
  latest,
  viewingSha,
  onClose,
  onSelect,
}: {
  readonly rfdId: typeof RfdId.Type;
  readonly latest: {
    readonly sha: CommitSha;
    readonly message: string;
    readonly author: string;
    readonly updated: string;
  };
  readonly viewingSha: CommitSha;
  readonly onClose: () => void;
  readonly onSelect: (sha: CommitSha) => void;
}) {
  return (
    <Drawer open direction="right" onOpenChange={(open) => (open ? undefined : onClose())}>
      <DrawerContent aria-label="RFD history">
        <DrawerHeader className="flex-row items-start justify-between gap-4 border-b">
          <div>
            <p className="font-mono text-[11px] tracking-wider text-primary uppercase">
              Git history
            </p>
            <DrawerTitle className="mt-1">Checkpoints</DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-6">
          <ol className="divide-y">
            <li>
              <CheckpointRow
                message={latest.message}
                author={latest.author}
                when={latest.updated}
                sha={latest.sha}
                isLatest
                isViewing={viewingSha === latest.sha}
                onClick={() => onSelect(latest.sha)}
              />
            </li>
            <Suspense
              fallback={
                <li className="py-4 text-sm text-muted-foreground">Loading earlier checkpoints…</li>
              }
            >
              <EarlierCheckpoints
                rfdId={rfdId}
                latestSha={latest.sha}
                viewingSha={viewingSha}
                onSelect={onSelect}
              />
            </Suspense>
          </ol>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function EarlierCheckpoints({
  rfdId,
  latestSha,
  viewingSha,
  onSelect,
}: {
  readonly rfdId: typeof RfdId.Type;
  readonly latestSha: CommitSha;
  readonly viewingSha: CommitSha;
  readonly onSelect: (sha: CommitSha) => void;
}) {
  const [readHistory, setReadHistory] = useState(false);

  useMountEffect(() => {
    setReadHistory(true);
  });

  if (!readHistory) {
    return <li className="py-4 text-sm text-muted-foreground">Loading earlier checkpoints…</li>;
  }

  return (
    <LoadedEarlierCheckpoints
      rfdId={rfdId}
      latestSha={latestSha}
      viewingSha={viewingSha}
      onSelect={onSelect}
    />
  );
}

function LoadedEarlierCheckpoints({
  rfdId,
  latestSha,
  viewingSha,
  onSelect,
}: {
  readonly rfdId: typeof RfdId.Type;
  readonly latestSha: CommitSha;
  readonly viewingSha: CommitSha;
  readonly onSelect: (sha: CommitSha) => void;
}) {
  const history = useAtomValue(rfdHistoryAtom(rfdId));
  if (AsyncResult.isFailure(history)) {
    return (
      <li className="pt-6 text-sm text-destructive">
        History could not be loaded. Try again shortly.
      </li>
    );
  }
  if (!AsyncResult.isSuccess(history)) {
    return <li className="py-4 text-sm text-muted-foreground">Loading earlier checkpoints…</li>;
  }

  return history.value
    .filter((checkpoint) => checkpoint.sha !== latestSha)
    .map((checkpoint) => (
      <li key={checkpoint.sha}>
        <CheckpointRow
          message={checkpoint.message}
          author={checkpoint.author}
          when={checkpoint.createdAt}
          sha={checkpoint.sha}
          isViewing={viewingSha === checkpoint.sha}
          onClick={() => onSelect(checkpoint.sha)}
        />
      </li>
    ));
}

function CheckpointRow({
  message,
  author,
  when,
  sha,
  isLatest = false,
  isViewing = false,
  onClick,
}: {
  readonly message: string;
  readonly author: string;
  readonly when: string;
  readonly sha: CommitSha;
  readonly isLatest?: boolean;
  readonly isViewing?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="block w-full py-4 text-left outline-none hover:bg-accent/50 focus-visible:bg-accent/50"
      onClick={onClick}
      aria-current={isViewing ? "true" : undefined}
    >
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {author} · {new Date(when).toLocaleString()} · {sha.slice(0, 8)}
        {isLatest ? (
          <span
            aria-label="Latest checkpoint"
            className="ml-2 inline-block size-2 rounded-full bg-primary align-middle"
          />
        ) : null}
        {isViewing ? (
          <span
            aria-label="Currently viewing"
            className="ml-2 inline-block size-2 rounded-full bg-status-superseded align-middle"
          />
        ) : null}
      </p>
    </button>
  );
}

function HistoricalRfdDocument({
  rfdId,
  sha,
  signedIn,
  forkedFrom,
  onReturn,
  onSelect,
}: {
  readonly rfdId: typeof RfdId.Type;
  readonly sha: CommitSha;
  readonly signedIn: boolean;
  readonly forkedFrom: { readonly rfdId: string; readonly number: number } | null;
  readonly onReturn: () => void;
  readonly onSelect: (sha: CommitSha) => void;
}) {
  const document = useAtomValue(rfdRefAtom({ rfdId, sha }));
  const latest = useAtomValue(rfdDocumentAtom(rfdId));
  const prefetchHistory = useAtomRefresh(rfdHistoryAtom(rfdId));
  const [historyOpen, setHistoryOpen] = useState(false);
  const latestDoc = AsyncResult.isSuccess(latest) ? latest.value : null;

  return (
    <main className="min-h-svh bg-background">
      <article className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-24">
        <p className="border-l-2 border-primary bg-primary/5 px-3 py-2 font-mono text-xs text-foreground">
          Viewing checkpoint {sha.slice(0, 8)} — a read-only snapshot of this RFD.
        </p>
        {AsyncResult.isFailure(document) ? (
          <p
            className="mt-8 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            This checkpoint could not be loaded. The latest RFD remains available.
          </p>
        ) : !AsyncResult.isSuccess(document) ? (
          <div className="mt-8">
            <LiveDocumentPlaceholder
              committed={{
                number: 0,
                title: "Loading checkpoint",
                status: "draft",
                author: "",
                headSha: sha,
                checkpointMessage: "",
                body: "",
                forkedFrom: null,
              }}
            />
          </div>
        ) : (
          <header className="mt-8">
            <RfdEyebrow number={document.value.number} forkedFrom={forkedFrom} />
            <h1 className="mt-3 text-balance font-heading text-4xl leading-tight sm:text-5xl">
              {document.value.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button type="button" className={actionButtonClass} onClick={onReturn}>
                Return to latest
              </Button>
              <Button
                type="button"
                variant="outline"
                className={actionButtonClass}
                onPointerEnter={prefetchHistory}
                onFocus={prefetchHistory}
                onClick={() => setHistoryOpen(true)}
              >
                <ClockCounterClockwiseIcon aria-hidden="true" />
                History
              </Button>
              <VersionActions rfdId={rfdId} ref={{ _tag: "Checkpoint", sha }} signedIn={signedIn} />
            </div>
            <dl className="mt-8">
              <PropertyRow label="Status">
                <RfdStatusControl status={document.value.status} canEdit={false} />
              </PropertyRow>
              <PropertyRow label="Author">{document.value.author}</PropertyRow>
              <PropertyRow label="Updated">
                {new Date(document.value.updated).toLocaleString()}
              </PropertyRow>
              <PropertyRow label="Checkpoint">
                <span className="font-mono text-xs">{sha.slice(0, 8)}</span>
                <span className="text-muted-foreground"> · {document.value.checkpointMessage}</span>
                <span
                  aria-label="Currently viewing"
                  className="ml-2 inline-block size-2 rounded-full bg-status-superseded align-middle"
                />
              </PropertyRow>
            </dl>
          </header>
        )}
        {AsyncResult.isSuccess(document) ? <RfdReader source={document.value.body} /> : null}
      </article>
      <HistoryPrefetch rfdId={rfdId} />
      {historyOpen && latestDoc !== null ? (
        <RfdHistory
          rfdId={rfdId}
          latest={{
            sha: latestDoc.headSha,
            author: latestDoc.author,
            updated: latestDoc.updated,
            message: latestDoc.checkpointMessage,
          }}
          viewingSha={sha}
          onClose={() => setHistoryOpen(false)}
          onSelect={(next) => {
            setHistoryOpen(false);
            if (next === latestDoc.headSha) onReturn();
            else if (next !== sha) onSelect(next);
          }}
        />
      ) : null}
    </main>
  );
}

function VersionActions({
  rfdId,
  ref,
  signedIn,
  canFork = false,
}: {
  readonly rfdId: typeof RfdId.Type;
  readonly ref: RfdRef;
  readonly signedIn: boolean;
  readonly canFork?: boolean;
}) {
  const [cloneOpen, setCloneOpen] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);
  const [forkStarted, setForkStarted] = useState(false);
  const forkBaselineId = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cloneResult, mintCloneCredential] = useAtom(cloneCredentialAtom);
  const [forkResult, fork] = useAtom(forkRfdAtom);
  const refLabel = ref._tag === "Branch" ? ref.branch : ref.sha.slice(0, 8);
  const credential = AsyncResult.isSuccess(cloneResult) ? cloneResult.value : null;
  const cloneCommand =
    credential === null
      ? null
      : credential.remote.replace(
          /^https:\/\//,
          `https://${credential.username}:${credential.token}@`,
        );

  const copyCloneCommand = () => {
    if (cloneCommand === null) return;
    void navigator.clipboard.writeText(`git clone ${cloneCommand}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    });
  };

  if (
    forkStarted &&
    AsyncResult.isSuccess(forkResult) &&
    !forkResult.waiting &&
    forkResult.value.rfdId !== forkBaselineId.current
  ) {
    return <Navigate to="/rfd/$rfdId" params={{ rfdId: forkResult.value.rfdId }} />;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" className={actionButtonClass} />}
        >
          Actions
          <CaretDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setCloneOpen(true)}>Clone {refLabel}</DropdownMenuItem>
          {canFork ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setForkOpen(true)}>Fork RFD</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={cloneOpen}
        onOpenChange={(open) => {
          setCloneOpen(open);
          if (!open) setCopied(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone {refLabel}</DialogTitle>
            <DialogDescription>
              Generate a read-only Git credential for this version. It expires after five minutes.
            </DialogDescription>
          </DialogHeader>
          {!signedIn ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Sign in to generate a short-lived read-only clone credential.
              </p>
              <Button nativeButton={false} render={<Link to="/login" />}>
                Sign in
              </Button>
            </div>
          ) : credential === null ? (
            <Button
              type="button"
              disabled={cloneResult.waiting}
              onClick={() => mintCloneCredential({ payload: { rfdId, ref } })}
            >
              {cloneResult.waiting ? "Generating…" : "Generate credential"}
            </Button>
          ) : (
            <div className="grid gap-2">
              <code className="block overflow-x-auto border bg-muted/40 p-3 font-mono text-xs whitespace-nowrap text-foreground">
                git clone {cloneCommand}
              </code>
              <p className="text-xs text-muted-foreground">
                Read-only access expires {new Date(credential.expiresAt).toLocaleTimeString()}.
              </p>
              <Button type="button" variant="outline" onClick={copyCloneCommand}>
                {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                {copied ? "Copied" : "Copy command"}
              </Button>
            </div>
          )}
          {signedIn && AsyncResult.isFailure(cloneResult) ? (
            <p className="text-sm text-destructive" role="alert">
              {rpcFailureMessage(cloneResult.cause, "The clone credential could not be generated.")}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={forkOpen}
        onOpenChange={(open) => {
          setForkOpen(open);
          if (!open) setForkStarted(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork this RFD</DialogTitle>
            <DialogDescription>
              Creates a new RFD and independent Artifacts repository from {refLabel}. The source
              stays unchanged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForkOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={forkResult.waiting}
              onClick={() => {
                forkBaselineId.current = AsyncResult.isSuccess(forkResult)
                  ? forkResult.value.rfdId
                  : null;
                setForkStarted(true);
                fork({
                  payload: { sourceRfdId: rfdId, source: ref },
                  reactivityKeys: ["catalog"],
                });
              }}
            >
              {forkResult.waiting ? "Creating fork…" : "Create fork"}
            </Button>
          </DialogFooter>
          {forkStarted && AsyncResult.isFailure(forkResult) ? (
            <p className="text-sm text-destructive" role="alert">
              {rpcFailureMessage(forkResult.cause, "The fork could not be created.")}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditableDocumentHeader({
  number,
  forkedFrom,
  author,
  headSha,
  checkpointMessage,
  title,
  fallbackTitle,
  status,
  metadata,
  canEdit,
  setMetadata,
}: {
  readonly number: number;
  readonly forkedFrom: { readonly rfdId: string; readonly number: number } | null;
  readonly author: string;
  readonly headSha: string;
  readonly checkpointMessage: string;
  readonly title: string;
  readonly fallbackTitle: string;
  readonly status: ReturnType<typeof parseRfdStatus>;
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
    <header>
      <RfdEyebrow number={number} forkedFrom={forkedFrom} />
      <input
        aria-label="RFD title"
        readOnly={!canEdit}
        className="mt-3 w-full bg-transparent text-balance font-heading text-4xl leading-tight outline-none focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-5xl"
        value={title}
        onChange={(event) => setMetadata("title", event.target.value)}
        onBlur={() => {
          if (!canEdit) return;
          if (title.trim().length > 0) return;
          setMetadata("title", fallbackTitle);
        }}
      />
      <dl className="mt-6">
        <PropertyRow label="Status">
          <RfdStatusControl
            status={status}
            canEdit={canEdit}
            appearance="editor"
            onChange={(next) => setMetadata("status", next)}
          />
        </PropertyRow>
        <PropertyRow label="Author">{author}</PropertyRow>
        <PropertyRow label="Checkpoint">
          <span className="font-mono text-xs">{headSha.slice(0, 8)}</span>
          <span className="text-muted-foreground"> · {checkpointMessage}</span>
        </PropertyRow>
      </dl>
      <button
        type="button"
        className="mt-4 font-mono text-[11px] tracking-wider text-muted-foreground uppercase underline-offset-4 hover:text-foreground hover:underline"
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
    <label className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
      {label}
      <input
        key={value}
        readOnly={!canEdit}
        className="mt-1.5 w-full border bg-background px-3 py-2 font-sans text-sm tracking-normal text-foreground normal-case outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-ring/50"
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
    <main className="grid min-h-[calc(100svh-3.5rem)] place-items-center bg-background px-4 text-center">
      <div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link to="/" className="mt-4 inline-block font-mono text-xs text-primary uppercase">
          Return to the catalog
        </Link>
      </div>
    </main>
  );
}
