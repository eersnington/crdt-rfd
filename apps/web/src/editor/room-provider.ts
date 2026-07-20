import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import type { RoomCapability, RoomStatus } from "@crdt-rfd/domain";

const messageDocumentUpdate = 0;
const messageAwareness = 1;
const messageDocumentSnapshot = 2;
const messageAwarenessQuery = 3;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export const roomWebSocketUrl = (
  rfdId: string,
  location: Pick<Location, "protocol" | "host"> = window.location,
): string => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/rfd/${encodeURIComponent(rfdId)}/room`;
};

export class RfdRoomProvider {
  readonly document = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.document);
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = false;
  private connectionStatus: ConnectionStatus = "disconnected";
  private hasConnected = false;
  private failedConnectionAttempts = 0;
  private roomStatus: RoomStatus | null = null;
  private capability: RoomCapability | null = null;
  private error: string | null = null;
  private generation: number | null = null;
  private snapshot: {
    readonly connection: ConnectionStatus;
    readonly room: RoomStatus | null;
    readonly capability: RoomCapability | null;
    readonly error: string | null;
    readonly localChangePending: boolean;
  } = {
    connection: "disconnected",
    room: null,
    capability: null,
    error: null,
    localChangePending: false,
  };
  private localChangePending = false;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly rfdId: string,
    private readonly onCheckpoint?: () => void,
  ) {
    this.document.on("update", this.onDocumentUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  readonly connect = () => {
    if (this.socket !== null) return;
    this.reconnectTimer = null;
    this.shouldConnect = true;
    this.setConnectionStatus("connecting");
    const socket = new WebSocket(roomWebSocketUrl(this.rfdId));
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onopen = () => {
      this.hasConnected = true;
      this.failedConnectionAttempts = 0;
      this.error = null;
      this.setConnectionStatus("connected");
      const localState = this.awareness.getLocalState();
      if (localState !== null) {
        this.sendBinary(
          messageAwareness,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.document.clientID]),
        );
      }
    };
    socket.onmessage = (event) => this.onMessage(event.data);
    socket.onerror = () => socket.close();
    socket.onclose = (event) => {
      this.socket = null;
      if (this.shouldConnect && event.code !== 1000 && event.code !== 1001) {
        this.failedConnectionAttempts += 1;
        if (this.hasConnected || this.failedConnectionAttempts >= 3) {
          this.error = `Room connection closed (${event.code}${event.reason ? `: ${event.reason}` : ""}). Retrying…`;
        }
      }
      this.setConnectionStatus("disconnected");
      if (this.shouldConnect) this.reconnectTimer = setTimeout(this.connect, 500);
    };
  };

  readonly disconnect = () => {
    this.shouldConnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "Live document closed");
    this.setConnectionStatus("disconnected");
  };

  readonly checkpoint = (message?: string) => {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.error = null;
      this.snapshot = {
        connection: this.connectionStatus,
        room: this.roomStatus,
        capability: this.capability,
        error: null,
        localChangePending: this.localChangePending,
      };
      this.emit();
      this.socket.send(JSON.stringify({ type: "checkpoint", message }));
    }
  };

  readonly destroy = () => {
    this.disconnect();
    this.awareness.off("update", this.onAwarenessUpdate);
    this.document.off("update", this.onDocumentUpdate);
    this.awareness.destroy();
    this.document.destroy();
  };

  private readonly onMessage = (message: string | ArrayBuffer) => {
    if (typeof message === "string") {
      const event = JSON.parse(message) as {
        readonly type?: string;
        readonly status?: RoomStatus;
        readonly message?: string;
        readonly generation?: number;
        readonly capability?: RoomCapability;
      };
      if (event.type === "bootstrap" && event.generation !== undefined) {
        if (this.generation !== null && this.generation !== event.generation) {
          window.location.reload();
          return;
        }
        this.generation = event.generation;
        if (event.capability !== undefined) {
          this.capability = event.capability;
          this.snapshot = {
            connection: this.connectionStatus,
            room: this.roomStatus,
            capability: this.capability,
            error: this.error,
            localChangePending: this.localChangePending,
          };
          this.emit();
        }
      } else if (event.type === "status" && event.status !== undefined) {
        this.roomStatus = event.status;
        this.localChangePending = false;
        this.snapshot = {
          connection: this.connectionStatus,
          room: this.roomStatus,
          capability: this.capability,
          error: this.error,
          localChangePending: false,
        };
        this.emit();
      } else if (event.type === "checkpoint") {
        this.onCheckpoint?.();
      } else if (event.type === "reset") {
        window.location.reload();
      } else if (event.type === "error") {
        this.error = event.message ?? "The room operation failed.";
        this.snapshot = {
          connection: this.connectionStatus,
          room: this.roomStatus,
          capability: this.capability,
          error: this.error,
          localChangePending: this.localChangePending,
        };
        this.emit();
      }
      return;
    }
    const bytes = new Uint8Array(message);
    const kind = bytes[0];
    const payload = bytes.subarray(1);
    if (kind === messageDocumentSnapshot || kind === messageDocumentUpdate) {
      Y.applyUpdate(this.document, payload, this);
      if (kind === messageDocumentSnapshot) {
        this.sendBinary(messageDocumentUpdate, Y.encodeStateAsUpdate(this.document));
      }
    } else if (kind === messageAwareness) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, payload, this);
    } else if (kind === messageAwarenessQuery) {
      this.sendBinary(
        messageAwareness,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.document.clientID]),
      );
    }
  };

  private readonly onDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    this.localChangePending = true;
    this.snapshot = {
      connection: this.connectionStatus,
      room: this.roomStatus,
      capability: this.capability,
      error: this.error,
      localChangePending: true,
    };
    this.emit();
    this.sendBinary(messageDocumentUpdate, update);
  };

  private readonly onAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    const clients = [...added, ...updated, ...removed];
    this.sendBinary(
      messageAwareness,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients),
    );
  };

  private readonly sendBinary = (kind: number, payload: Uint8Array) => {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const message = new Uint8Array(payload.byteLength + 1);
    message[0] = kind;
    message.set(payload, 1);
    this.socket.send(message);
  };

  private readonly setConnectionStatus = (status: ConnectionStatus) => {
    this.connectionStatus = status;
    this.snapshot = {
      connection: this.connectionStatus,
      room: this.roomStatus,
      capability: this.capability,
      error: this.error,
      localChangePending: this.localChangePending,
    };
    this.emit();
  };

  private readonly emit = () => {
    for (const listener of this.listeners) listener();
  };
}
