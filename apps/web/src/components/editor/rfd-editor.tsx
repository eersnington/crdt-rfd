import { useState, useSyncExternalStore, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import type { CurrentUser, RfdId } from "@crdt-rfd/domain";

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

export function RfdCollaborativeDocument({
  rfdId,
  user,
  onCheckpoint,
  renderMetadata,
  renderActions,
}: {
  readonly rfdId: RfdId;
  readonly user: CurrentUser | undefined;
  readonly onCheckpoint: () => void;
  readonly renderMetadata: (metadata: {
    readonly title: string;
    readonly status: string;
    readonly metadata: RfdMetadata;
    readonly canEdit: boolean;
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
  // Capabilities arrive with the room snapshot. Until then, the surface must
  // remain read-only so viewers never get a brief writable editor.
  const canEdit = state.capability?.canEdit ?? false;
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit,
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
    },
    [canEdit],
  );

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
      ? state.connection
      : state.checkpointPending || state.room?._tag === "Checkpointing"
        ? "Checkpointing…"
        : state.localChangePending || state.room?._tag === "Dirty"
          ? "Changes waiting for checkpoint"
          : state.room?._tag === "Conflicted"
            ? "Conflict"
            : state.room?._tag === "Clean"
              ? "Checkpointed"
              : "Loading live document";

  const setMetadata = (key: string, value: unknown) => metadataMap.set(key, value);

  return (
    <>
      {renderMetadata({
        title: metadata.title ?? "",
        status: metadata.status ?? "draft",
        metadata,
        canEdit,
        setMetadata,
      })}
      {state.error === null ? null : (
        <p
          className="mb-6 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <EditorContent editor={editor} />
      {editor === null || !canEdit ? null : (
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
      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {roomState}
            {canEdit ? null : " · Read only"}
            {presenceCount > 1
              ? ` · ${presenceCount - 1} collaborator${presenceCount === 2 ? "" : "s"}`
              : ""}
          </span>
          {editor === null || !canEdit ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" />}>
                Insert
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  Heading
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()}>
                  List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                  Quote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                  Code block
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                  Divider
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {renderActions({ checkpoint, canPublish, roomState })}
      </div>
    </>
  );
}
