import type {
  VersusMatchConfig,
  VersusPlayer,
  VersusRunResult,
} from "../core/multiplayer/versusMode";

export type MultiplayerConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "closed"
  | "failed";

export type MultiplayerRole = "host" | "client";

export type MultiplayerMessage =
  | { type: "HOST_CLAIM"; matchConfig: VersusMatchConfig }
  | { type: "HOST_ACCEPTED"; matchConfig: VersusMatchConfig }
  | { type: "HOST_REJECTED"; reason: string; hostName?: string }
  | { type: "HOST_LEFT" }
  | { type: "JOIN_REQUEST"; player: VersusPlayer }
  | { type: "JOIN_REJECTED"; reason: string }
  | { type: "JOIN_ACCEPTED"; matchConfig: VersusMatchConfig }
  | { type: "PLAYER_LEFT"; playerId: string }
  | { type: "MATCH_CONFIG"; matchConfig: VersusMatchConfig }
  | { type: "READY"; playerId: string }
  | { type: "LOBBY_STATE"; matchConfig: VersusMatchConfig; readyPlayerIds: string[] }
  | { type: "START_RUN"; matchConfig: VersusMatchConfig; startsAtEpochMs: number }
  | { type: "RUN_RESULT"; result: VersusRunResult }
  | { type: "PING"; sentAtEpochMs: number }
  | { type: "PONG"; sentAtEpochMs: number; receivedAtEpochMs: number };

export type MultiplayerTransport = {
  readonly role: MultiplayerRole;
  readonly state: MultiplayerConnectionState;
  send(message: MultiplayerMessage): void;
  subscribe(handler: (message: MultiplayerMessage) => void): () => void;
  subscribeState(handler: (state: MultiplayerConnectionState) => void): () => void;
  close(): void;
};
