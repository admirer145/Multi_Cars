import type {
  MultiplayerConnectionState,
  MultiplayerMessage,
  MultiplayerRole,
  MultiplayerTransport,
} from "./transport";

export class LanSocketTransport implements MultiplayerTransport {
  readonly role: MultiplayerRole;
  private readonly socket: WebSocket;
  private messageHandlers = new Set<(message: MultiplayerMessage) => void>();
  private stateHandlers = new Set<(state: MultiplayerConnectionState) => void>();
  private currentState: MultiplayerConnectionState = "connecting";

  constructor(role: MultiplayerRole, url = getDefaultLanServerUrl()) {
    this.role = role;
    this.socket = new WebSocket(url);
    this.socket.onopen = () => this.setState("connected");
    this.socket.onclose = () => this.setState("closed");
    this.socket.onerror = () => this.setState("failed");
    this.socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as MultiplayerMessage;
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    };
  }

  get state(): MultiplayerConnectionState {
    return this.currentState;
  }

  send(message: MultiplayerMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("LAN connection is not open.");
    }

    this.socket.send(JSON.stringify(message));
  }

  subscribe(handler: (message: MultiplayerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  subscribeState(handler: (state: MultiplayerConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    handler(this.currentState);
    return () => this.stateHandlers.delete(handler);
  }

  close(): void {
    this.socket.close();
    this.setState("closed");
  }

  private setState(state: MultiplayerConnectionState): void {
    if (this.currentState === state) {
      return;
    }

    this.currentState = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

export function getDefaultLanServerUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8787`;
}
