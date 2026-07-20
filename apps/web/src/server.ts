import { createServerEntry } from "@tanstack/react-start/server-entry";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { DurableObject } from "cloudflare:workers";
import { Cause, Effect, Option, Result, Schema } from "effect";
import {
  CheckpointConflict,
  EditorMetadata,
  RfdId,
  RoomIdentity,
  parseRfdDocument,
  serializeRfdDocument,
  type CommitSha,
  type EditorMetadata as EditorMetadataValue,
  type RfdId as RfdIdValue,
  type RoomIdentity as RoomIdentityValue,
  type RoomStatus,
} from "@crdt-rfd/domain";
import * as Y from "yjs";

import type { WebsiteEnv } from "../../../packages/infra/alchemy.run";
import {
  parseEditorMarkdown,
  serializeEditorMarkdown,
  editorJsonToYDoc,
  yDocToEditorJson,
} from "./editor/markdown";
import { applyRoomUpdate } from "./editor/room-state";
import { applicationRuntime } from "./server/application/runtime";
import { proxyGitRequest } from "./server/git/proxy";
import { connectRfdRoom } from "./server/rooms/connect";
import { roomIdFromRequest } from "./server/rooms/path";
import { RfdRepository } from "./server/rfds/repository";

const startFetch = createStartHandler(defaultStreamHandler);

export default createServerEntry({
  fetch: async (...args) => {
    const [request] = args;
    const gitResponse = await proxyGitRequest(request);
    if (gitResponse !== null) return gitResponse;
    const rfdId = roomIdFromRequest(request);
    return rfdId === null ? startFetch(...args) : connectRfdRoom(request, rfdId);
  },
});

const messageDocumentUpdate = 0;
const messageAwareness = 1;
const messageDocumentSnapshot = 2;
const messageAwarenessQuery = 3;
const maximumUpdateBytes = 1_000_000;
const maximumSnapshotBytes = 5_000_000;
const automaticCheckpointDelayMs = 30_000;

interface SocketAttachment {
  readonly identity: RoomIdentityValue;
}

const metadataEntries = (
  metadata: EditorMetadataValue,
): ReadonlyArray<readonly [string, unknown]> => Object.entries(metadata);

const readMetadata = (document: Y.Doc): Record<string, unknown> => {
  const metadata = document.getMap<unknown>("metadata");
  return Object.fromEntries(metadata.entries());
};

export class RfdRoom extends DurableObject<WebsiteEnv> {
  private document = new Y.Doc();
  private rfdId: RfdIdValue | null = null;
  private baseSha: CommitSha | null = null;
  private status: RoomStatus | null = null;
  private generation = 0;
  private revision = 0;
  private lastEditor: SocketAttachment | null = null;

  constructor(ctx: DurableObjectState, env: WebsiteEnv) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    void this.ctx.blockConcurrencyWhile(async () => {
      const [snapshot, rfdId, baseSha, status, generation, lastEditor] = await Promise.all([
        this.ctx.storage.get<ArrayBuffer>("snapshot"),
        this.ctx.storage.get<string>("rfdId"),
        this.ctx.storage.get<CommitSha>("baseSha"),
        this.ctx.storage.get<RoomStatus>("status"),
        this.ctx.storage.get<number>("generation"),
        this.ctx.storage.get<SocketAttachment>("lastEditor"),
      ]);
      if (snapshot !== undefined) Y.applyUpdate(this.document, new Uint8Array(snapshot), this);
      if (rfdId !== undefined) this.rfdId = Schema.decodeUnknownSync(RfdId)(rfdId);
      this.baseSha = baseSha ?? null;
      this.status = status ?? null;
      this.generation = generation ?? 0;
      this.lastEditor = lastEditor ?? null;
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    }
    const rfdId = Schema.decodeUnknownResult(RfdId)(request.headers.get("x-rfd-id"));
    const identity = Schema.decodeUnknownResult(RoomIdentity)(
      JSON.parse(request.headers.get("x-room-identity") ?? "null"),
    );
    if (Result.isFailure(rfdId) || Result.isFailure(identity)) {
      return new Response("The room identity is invalid.", { status: 400 });
    }
    try {
      await this.ensureInitialized(rfdId.success);
    } catch (cause) {
      console.error("RfdRoom bootstrap failed", {
        rfdId: rfdId.success,
        name: cause instanceof Error ? cause.name : "UnknownError",
        message: cause instanceof Error ? cause.message : "Unknown room bootstrap failure",
      });
      return Response.json(
        {
          code: "RFD_ROOM_BOOTSTRAP_FAILED",
          message:
            "The collaborative room could not load its committed base. The committed RFD remains unchanged.",
        },
        { status: 503 },
      );
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ identity: identity.success } satisfies SocketAttachment);
    const role = identity.success.role;
    server.send(
      JSON.stringify({
        type: "bootstrap",
        generation: this.generation,
        capability: {
          role,
          canEdit: role !== "commenter",
          canCheckpoint: role !== "commenter",
          canManageMembers: role === "owner",
        },
      }),
    );
    server.send(this.frame(messageDocumentSnapshot, Y.encodeStateAsUpdate(this.document)));
    this.broadcast(this.frame(messageAwarenessQuery, new Uint8Array()), server);
    server.send(JSON.stringify({ type: "status", status: this.status }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string): Promise<void> {
    try {
      await this.handleWebSocketMessage(socket, message);
    } catch (cause) {
      console.error("RfdRoom message failed", {
        rfdId: this.rfdId,
        name: cause instanceof Error ? cause.name : "UnknownError",
        message: cause instanceof Error ? cause.message : "Unknown room message failure",
      });
      socket.close(1011, "Room update failed");
    }
  }

  override async alarm(): Promise<void> {
    if (this.lastEditor === null || this.status?._tag !== "Dirty") return;
    await this.checkpoint(this.lastEditor, undefined);
  }

  private readonly handleWebSocketMessage = async (
    socket: WebSocket,
    message: ArrayBuffer | string,
  ): Promise<void> => {
    if (typeof message === "string") {
      const command = JSON.parse(message) as {
        readonly type?: unknown;
        readonly message?: unknown;
      };
      if (command.type === "checkpoint") {
        const attachment = socket.deserializeAttachment() as SocketAttachment | null | undefined;
        if (attachment === null || attachment === undefined) {
          socket.send(JSON.stringify({ type: "error", message: "Checkpoint permission denied." }));
          return;
        }
        await this.checkpoint(
          attachment,
          socket,
          typeof command.message === "string" ? command.message.trim() || undefined : undefined,
        );
      }
      return;
    }
    const bytes = new Uint8Array(message);
    const kind = bytes[0];
    const payload = bytes.subarray(1);
    if (kind === messageAwareness) {
      this.broadcast(message, socket);
      return;
    }
    if (kind !== messageDocumentUpdate) return;
    if (payload.byteLength > maximumUpdateBytes) {
      socket.send(
        JSON.stringify({ type: "error", message: "The editor update exceeds the 1 MB limit." }),
      );
      return;
    }
    const attachment = socket.deserializeAttachment() as SocketAttachment | null | undefined;
    if (
      attachment === null ||
      attachment === undefined ||
      attachment.identity.role === "commenter"
    ) {
      socket.send(JSON.stringify({ type: "error", message: "Commenters cannot edit this RFD." }));
      return;
    }
    if (this.rfdId === null) {
      socket.close(1011, "Room is not initialized");
      return;
    }
    const rfdId = this.rfdId;
    const currentRole = await applicationRuntime.runPromise(
      Effect.flatMap(RfdRepository, (repository) =>
        repository.getRoomRole(rfdId, attachment.identity.userId),
      ),
    );
    if (currentRole !== "owner" && currentRole !== "editor") {
      socket.send(JSON.stringify({ type: "error", message: "Edit permission was revoked." }));
      socket.close(4003, "Edit permission revoked");
      return;
    }
    const candidate = new Y.Doc();
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(this.document));
    applyRoomUpdate(candidate, payload, this);
    if (Y.encodeStateAsUpdate(candidate).byteLength > maximumSnapshotBytes) {
      candidate.destroy();
      socket.send(
        JSON.stringify({ type: "error", message: "The draft exceeds the 5 MB room limit." }),
      );
      return;
    }
    candidate.destroy();
    if (!applyRoomUpdate(this.document, payload, this)) return;
    this.revision += 1;
    this.lastEditor = attachment;
    if (this.baseSha === null) return;
    this.status = { _tag: "Dirty", baseSha: this.baseSha };
    await this.persist();
    await this.ctx.storage.setAlarm(Date.now() + automaticCheckpointDelayMs);
    this.broadcast(message);
    this.broadcast(JSON.stringify({ type: "status", status: this.status }));
  };

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    socket.close(code, reason);
  }

  private readonly ensureInitialized = async (rfdId: RfdIdValue): Promise<void> => {
    const committed = await applicationRuntime.runPromise(
      Effect.flatMap(RfdRepository, (repository) => repository.loadCommittedSource(rfdId)),
    );
    if (this.rfdId !== null) {
      if (this.rfdId !== rfdId) throw new Error("A document room cannot serve multiple RFDs.");
      if (this.baseSha !== committed.headSha) {
        if (this.status?._tag === "Clean") {
          await this.resetFromCommitted(rfdId, committed, true);
        } else if (this.baseSha !== null) {
          this.status = {
            _tag: "Conflicted",
            baseSha: this.baseSha,
            remoteSha: committed.headSha,
          };
          await this.persist();
        }
      }
      return;
    }
    await this.resetFromCommitted(rfdId, committed, false);
  };

  private readonly resetFromCommitted = async (
    rfdId: RfdIdValue,
    committed: { readonly source: string; readonly headSha: CommitSha },
    notifyClients: boolean,
  ): Promise<void> => {
    if (notifyClients) {
      for (const socket of this.ctx.getWebSockets()) {
        socket.send(JSON.stringify({ type: "reset" }));
        socket.close(4001, "Committed document changed");
      }
      this.generation += 1;
    }
    const parsed = Result.getOrThrow(parseRfdDocument(committed.source));
    const editor = Result.getOrThrow(parseEditorMarkdown(parsed.body));
    this.document.destroy();
    this.document = editorJsonToYDoc(editor);
    this.revision = 0;
    const metadata = this.document.getMap<unknown>("metadata");
    for (const [key, value] of metadataEntries(parsed.frontmatter)) metadata.set(key, value);
    this.rfdId = rfdId;
    this.baseSha = committed.headSha;
    this.status = { _tag: "Clean", baseSha: committed.headSha };
    await this.persist();
  };

  private readonly checkpoint = async (
    attachment: SocketAttachment,
    socket: WebSocket | undefined,
    message?: string,
  ): Promise<void> => {
    if (attachment.identity.role === "commenter" || this.rfdId === null || this.baseSha === null) {
      socket?.send(JSON.stringify({ type: "error", message: "Checkpoint permission denied." }));
      return;
    }
    const rfdId = this.rfdId;
    const baseSha = this.baseSha;
    const document = this.document;
    const checkpointRevision = this.revision;
    const rawMetadata = { ...readMetadata(document) };
    // Empty title is allowed while editing; restore the last committed title on save.
    if (typeof rawMetadata.title !== "string" || rawMetadata.title.trim().length === 0) {
      const committed = await applicationRuntime.runPromise(
        Effect.flatMap(RfdRepository, (repository) => repository.get(rfdId)),
      );
      rawMetadata.title = committed.title;
      document.getMap<unknown>("metadata").set("title", committed.title);
    }
    const prepared = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const metadata = yield* Schema.decodeUnknownEffect(EditorMetadata)(rawMetadata);
        const body = yield* Effect.fromResult(serializeEditorMarkdown(yDocToEditorJson(document)));
        return serializeRfdDocument({ frontmatter: metadata, body });
      }),
    );
    if (prepared._tag === "Failure") {
      socket?.send(
        JSON.stringify({
          type: "error",
          message: "The draft metadata or body is invalid. Correct it before checkpointing.",
        }),
      );
      return;
    }
    this.status = { _tag: "Checkpointing", baseSha };
    this.broadcast(JSON.stringify({ type: "status", status: this.status }));
    const result = await applicationRuntime.runPromiseExit(
      Effect.flatMap(RfdRepository, (repository) =>
        repository.checkpoint(
          { rfdId, expectedHeadSha: baseSha, source: prepared.value, message },
          {
            id: attachment.identity.userId,
            name: attachment.identity.name,
            image: null,
          },
        ),
      ),
    );
    if (result._tag === "Success") {
      this.baseSha = result.value.headSha;
      const unchanged = checkpointRevision === this.revision;
      this.status = unchanged
        ? { _tag: "Clean", baseSha: result.value.headSha }
        : { _tag: "Dirty", baseSha: result.value.headSha };
      await this.persist();
      this.broadcast(JSON.stringify({ type: "checkpoint", result: result.value }));
      this.broadcast(JSON.stringify({ type: "status", status: this.status }));
      return;
    }
    const failure = Option.getOrUndefined(Cause.findErrorOption(result.cause));
    this.status =
      failure instanceof CheckpointConflict
        ? {
            _tag: "Conflicted",
            baseSha: failure.expectedHeadSha,
            remoteSha: failure.actualHeadSha,
          }
        : { _tag: "Dirty", baseSha: this.baseSha };
    await this.persist();
    this.broadcast(JSON.stringify({ type: "status", status: this.status }));
    socket?.send(
      JSON.stringify({
        type: "error",
        message:
          failure instanceof CheckpointConflict
            ? failure.message
            : "The checkpoint failed. The collaborative draft was preserved.",
      }),
    );
  };

  private readonly persist = async (): Promise<void> => {
    if (this.rfdId === null || this.baseSha === null || this.status === null) return;
    const snapshot = Y.encodeStateAsUpdate(this.document);
    if (snapshot.byteLength > maximumSnapshotBytes) {
      throw new Error(
        "The collaborative draft exceeds the 5 MB room limit. The previous persisted snapshot remains intact.",
      );
    }
    await this.ctx.storage.put({
      rfdId: this.rfdId,
      baseSha: this.baseSha,
      status: this.status,
      generation: this.generation,
      lastEditor: this.lastEditor,
      snapshot: snapshot.buffer.slice(
        snapshot.byteOffset,
        snapshot.byteOffset + snapshot.byteLength,
      ),
    });
  };

  private readonly frame = (kind: number, payload: Uint8Array): ArrayBuffer => {
    const framed = new Uint8Array(payload.byteLength + 1);
    framed[0] = kind;
    framed.set(payload, 1);
    return framed.buffer;
  };

  private readonly broadcast = (message: ArrayBuffer | string, except?: WebSocket): void => {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except) socket.send(message);
    }
  };
}
