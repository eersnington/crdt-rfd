import { useState, useSyncExternalStore, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { PlusIcon } from "@phosphor-icons/react";
import type { CurrentUser, RfdId, RfdStatus } from "@crdt-rfd/domain";

import { RfdReader } from "@/components/editor/rfd-reader";
import { useMountEffect } from "@/lib/use-mount-effect";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RfdRoomProvider } from "@/editor/room-provider";
import { useYMetadata, type RfdMetadata } from "@/editor/use-y-metadata";

const colors = ["#ef4444", "#f97316", "#16a34a", "#0284c7", "#7c3aed", "#db2777"];

const colorFor = (id: string) => {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
};

export type LiveDocumentBaseline = {
  readonly title: string;
  readonly status: RfdStatus;
  readonly body: string;
  readonly authors?: readonly string[];
};

export function RfdCollaborativeDocument({
  rfdId,
  user,
  baseline,
  onCheckpoint,
  renderMetadata,
  renderActions,
}: {
  readonly rfdId: RfdId;
  readonly user: CurrentUser | undefined;
  readonly baseline: LiveDocumentBaseline;
  readonly onCheckpoint: () => void;
  readonly renderMetadata: (metadata: {
    readonly title: string;
    readonly status: string;
    readonly metadata: RfdMetadata;
    readonly canEdit: boolean;
    readonly documentReady: boolean;
    readonly setMetadata: (key: string, value: unknown) => void;
  }) => ReactNode;
  readonly renderActions: (actions: {
    readonly checkpoint: (message?: string) => void;
    readonly canPublish: boolean;
    readonly roomState: string;
  }) => ReactNode;
}) {
  const [provider] = useState(() => new RfdRoomProvider(rfdId, onCheckpoint));
  const state = useSyncExternalStore(
    provider.subscribe,
    provider.getSnapshot,
    provider.getSnapshot,
  );
  const metadataMap = provider.document.getMap<unknown>("metadata");
  const metadata = useYMetadata(metadataMap);
  const canEdit = state.capability?.canEdit ?? false;
  const documentReady = state.room !== null;
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Markdown,
      Collaboration.configure({ document: provider.document, field: "content" }),
      CollaborationCaret.configure({
        provider,
        user: {
          name: user?.name ?? "Viewer",
          color: colorFor(user?.id ?? "viewer"),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "document-prose min-h-[24rem] outline-none",
        "aria-label": "RFD document body",
      },
    },
  });

  if (editor !== null && editor.isEditable !== canEdit) {
    editor.setEditable(canEdit);
  }

  useMountEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: user?.name ?? "Viewer",
      color: colorFor(user?.id ?? "viewer"),
    });
    provider.connect();
    return provider.disconnect;
  });

  const checkpoint = provider.checkpoint;
  const canPublish =
    state.connection === "connected" &&
    !state.checkpointPending &&
    (state.room?._tag === "Dirty" || state.localChangePending) &&
    (state.capability?.canCheckpoint ?? true);
  const presenceCount = provider.awareness.getStates().size;
  const roomState =
    state.connection !== "connected"
      ? state.connection === "connecting"
        ? "Connecting…"
        : "Disconnected"
      : state.checkpointPending || state.room?._tag === "Checkpointing"
        ? "Checkpointing…"
        : state.localChangePending || state.room?._tag === "Dirty"
          ? "Changes waiting for checkpoint"
          : state.room?._tag === "Conflicted"
            ? "Conflict"
            : state.room?._tag === "Clean"
              ? "Checkpointed"
              : "Connecting…";

  const setMetadata = (key: string, value: unknown) => metadataMap.set(key, value);
  // Keep an intentionally cleared title empty while editing; baseline is only a
  // pre-snapshot fallback, not a live coercion.
  const title = metadata.title === undefined ? baseline.title : metadata.title;
  const status = metadata.status ?? baseline.status;
  const resolvedMetadata: RfdMetadata = {
    ...metadata,
    title,
    status,
    authors: metadata.authors ?? baseline.authors,
  };

  return (
    <>
      {renderMetadata({
        title,
        status,
        metadata: resolvedMetadata,
        canEdit: canEdit && documentReady,
        documentReady,
        setMetadata,
      })}
      <div className="sticky top-14 z-30 -mx-4 mt-6 mb-8 border-b bg-background/90 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-[5.75rem] shrink-0 items-center">
              {editor !== null && canEdit && documentReady ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button type="button" size="sm" variant="outline" />}
                  >
                    <PlusIcon aria-hidden="true" />
                    Insert
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    >
                      Heading
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                    >
                      List
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    >
                      Quote
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    >
                      Code block
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    >
                      Divider
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            <span className="min-w-40 truncate font-mono text-xs text-muted-foreground">
              {roomState}
              {canEdit || !documentReady ? null : " · Read only"}
              {presenceCount > 1
                ? ` · ${presenceCount - 1} collaborator${presenceCount === 2 ? "" : "s"}`
                : ""}
            </span>
          </div>
          {renderActions({ checkpoint, canPublish, roomState })}
        </div>
      </div>
      {state.error === null ? null : (
        <p
          className="mb-6 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <div className="min-h-[24rem]">
        {documentReady ? <EditorContent editor={editor} /> : <RfdReader source={baseline.body} />}
      </div>
      {editor === null || !canEdit || !documentReady ? null : (
        <BubbleMenu editor={editor} className="editor-bubble-menu">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Bold
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            Italic
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            Code
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            List
          </Button>
        </BubbleMenu>
      )}
    </>
  );
}
