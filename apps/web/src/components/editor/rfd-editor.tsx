import { useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import type { CurrentUser, RfdId } from "@crdt-rfd/domain";

import { useMountEffect } from "@/lib/use-mount-effect";
import { Button } from "@/components/ui/button";
import { RfdRoomProvider } from "@/editor/room-provider";

const colors = ["#ef4444", "#f97316", "#16a34a", "#0284c7", "#7c3aed", "#db2777"];

const colorFor = (id: string) => {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
};

export function RfdEditor({
  rfdId,
  user,
  onClose,
}: {
  readonly rfdId: RfdId;
  readonly user: CurrentUser;
  readonly onClose: () => void;
}) {
  const [provider] = useState(() => new RfdRoomProvider(rfdId));
  const [slashOpen, setSlashOpen] = useState(false);
  const state = useSyncExternalStore(
    provider.subscribe,
    provider.getSnapshot,
    provider.getSnapshot,
  );
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Markdown,
      Collaboration.configure({ document: provider.document, field: "content" }),
      CollaborationCaret.configure({
        provider,
        user: {
          name: user.name,
          color: colorFor(user.id),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-[55svh] outline-none prose prose-neutral dark:prose-invert max-w-none text-base leading-7",
        "aria-label": "RFD document body",
      },
      handleKeyDown: (view, event) => {
        const selection = view.state.selection.$from;
        if (
          event.key !== "/" ||
          selection.parentOffset !== 0 ||
          selection.parent.textContent !== ""
        ) {
          return false;
        }
        setSlashOpen(true);
        return true;
      },
    },
  });

  useMountEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: user.name,
      color: colorFor(user.id),
    });
    provider.connect();
    return provider.disconnect;
  });

  const roomLabel =
    state.connection !== "connected"
      ? state.connection
      : (state.room?._tag.toLowerCase() ?? "loading");

  return (
    <main className="min-h-svh bg-background px-4 pt-24 pb-28 sm:px-6 sm:pt-28">
      <div className="mx-auto max-w-5xl">
        <header className="sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 border bg-background/95 p-2 shadow-sm backdrop-blur">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              Bold
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              Italic
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              List
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              Code
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
              {roomLabel}
            </span>
            <Button
              type="button"
              disabled={state.connection !== "connected" || state.room?._tag !== "Dirty"}
              onClick={provider.checkpoint}
            >
              Checkpoint
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Back to document
            </Button>
          </div>
        </header>
        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <article className="border bg-card px-5 py-8 sm:px-10 sm:py-12">
            {state.error === null ? null : (
              <p
                className="mb-5 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {state.error}
              </p>
            )}
            {slashOpen ? (
              <div className="mb-5 flex flex-wrap gap-1 border bg-popover p-2 shadow-lg">
                {[
                  ["Heading", () => editor?.chain().focus().toggleHeading({ level: 2 }).run()],
                  ["Bullet list", () => editor?.chain().focus().toggleBulletList().run()],
                  ["Quote", () => editor?.chain().focus().toggleBlockquote().run()],
                  ["Code block", () => editor?.chain().focus().toggleCodeBlock().run()],
                  ["Divider", () => editor?.chain().focus().setHorizontalRule().run()],
                ].map(([label, command]) => (
                  <Button
                    key={String(label)}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (typeof command === "function") command();
                      setSlashOpen(false);
                    }}
                  >
                    {String(label)}
                  </Button>
                ))}
                <Button type="button" variant="ghost" onClick={() => setSlashOpen(false)}>
                  Close
                </Button>
              </div>
            ) : null}
            <EditorContent editor={editor} />
          </article>
          <MetadataPanel provider={provider} />
        </section>
      </div>
    </main>
  );
}

function MetadataPanel({ provider }: { readonly provider: RfdRoomProvider }) {
  const metadata = provider.document.getMap<unknown>("metadata");
  const subscribe = (listener: () => void) => {
    metadata.observe(listener);
    return () => metadata.unobserve(listener);
  };
  const getSnapshot = () => JSON.stringify(Object.fromEntries(metadata.entries()));
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const value = JSON.parse(snapshot) as {
    readonly title?: string;
    readonly status?: string;
    readonly authors?: readonly string[];
    readonly reviewers?: readonly string[];
    readonly supersedes?: readonly number[];
    readonly related?: readonly number[];
  };

  return (
    <aside className="h-fit border bg-card p-4">
      <p className="font-mono text-xs text-primary uppercase">Document metadata</p>
      <label className="mt-4 block text-xs text-muted-foreground" htmlFor="rfd-title">
        Title
      </label>
      <input
        id="rfd-title"
        className="mt-1 w-full border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-ring/50"
        value={value.title ?? ""}
        onChange={(event) => metadata.set("title", event.target.value)}
      />
      <label className="mt-4 block text-xs text-muted-foreground" htmlFor="rfd-status">
        Status
      </label>
      <select
        id="rfd-status"
        className="mt-1 w-full border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-ring/50"
        value={value.status ?? "draft"}
        onChange={(event) => metadata.set("status", event.target.value)}
      >
        {(["draft", "discussion", "accepted", "rejected", "superseded"] as const).map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <MetadataListInput
        id="rfd-authors"
        label="Authors"
        value={value.authors?.join(", ") ?? ""}
        onCommit={(items) => metadata.set("authors", items)}
      />
      <MetadataListInput
        id="rfd-reviewers"
        label="Reviewers"
        value={value.reviewers?.join(", ") ?? ""}
        onCommit={(items) => metadata.set("reviewers", items)}
      />
      <MetadataListInput
        id="rfd-related"
        label="Related RFD numbers"
        value={value.related?.join(", ") ?? ""}
        onCommit={(items) =>
          metadata.set(
            "related",
            items.flatMap((item) => {
              const number = Number(item);
              return Number.isInteger(number) && number > 0 ? [number] : [];
            }),
          )
        }
      />
      <MetadataListInput
        id="rfd-supersedes"
        label="Supersedes RFD numbers"
        value={value.supersedes?.join(", ") ?? ""}
        onCommit={(items) =>
          metadata.set(
            "supersedes",
            items.flatMap((item) => {
              const number = Number(item);
              return Number.isInteger(number) && number > 0 ? [number] : [];
            }),
          )
        }
      />
    </aside>
  );
}

function MetadataListInput({
  id,
  label,
  value,
  onCommit,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onCommit: (items: string[]) => void;
}) {
  return (
    <label className="mt-4 block text-xs text-muted-foreground" htmlFor={id}>
      {label}
      <input
        key={value}
        id={id}
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
