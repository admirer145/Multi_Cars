import http from "node:http";
import os from "node:os";
import { WebSocket, WebSocketServer } from "ws";

const port = Number(process.env.MULTI_CARS_LAN_PORT ?? 8787);

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "multi-cars-lan" }));
    return;
  }

  response.writeHead(200, { "content-type": "text/plain" });
  response.end("Multi Cars LAN server is running.\n");
});

const wss = new WebSocketServer({ server });
let hostSocket = null;
let hostMatchConfig = null;
const socketPlayerIds = new WeakMap();
const activePlayerSockets = new Map();

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    const text = message.toString();
    const parsed = parseMessage(text);

    if (!parsed) {
      return;
    }

    if (parsed.type === "HOST_CLAIM") {
      if (hostSocket && hostSocket.readyState === WebSocket.OPEN && hostSocket !== socket) {
        send(socket, {
          type: "HOST_REJECTED",
          reason: "A host is already running this lobby.",
          hostName: hostMatchConfig?.leader?.name,
        });
        return;
      }

      hostSocket = socket;
      hostMatchConfig = parsed.matchConfig;
      socketPlayerIds.set(socket, parsed.matchConfig.leader.id);
      activePlayerSockets.set(parsed.matchConfig.leader.id, socket);
      send(socket, { type: "HOST_ACCEPTED", matchConfig: hostMatchConfig });
      return;
    }

    if (parsed.type === "HOST_LEFT") {
      if (socket !== hostSocket) {
        return;
      }

      clearHostLobby(socket);
      return;
    }

    if (parsed.type === "JOIN_REQUEST") {
      if (!hostSocket || hostSocket.readyState !== WebSocket.OPEN) {
        send(socket, { type: "JOIN_REJECTED", reason: "No host is available yet." });
        return;
      }

      socketPlayerIds.set(socket, parsed.player.id);
      activePlayerSockets.set(parsed.player.id, socket);
      send(hostSocket, parsed);
      return;
    }

    if (parsed.type === "JOIN_ACCEPTED") {
      if (socket !== hostSocket) {
        return;
      }

      hostMatchConfig = parsed.matchConfig;
      broadcast(socket, text);
      return;
    }

    if (parsed.type === "PLAYER_LEFT") {
      const playerId = socketPlayerIds.get(socket) ?? parsed.playerId;
      socketPlayerIds.delete(socket);
      if (playerId && activePlayerSockets.get(playerId) === socket) {
        activePlayerSockets.delete(playerId);
      }

      if (playerId && hostSocket?.readyState === WebSocket.OPEN) {
        send(hostSocket, { type: "PLAYER_LEFT", playerId });
      }
      return;
    }

    if (parsed.type === "MATCH_CONFIG") {
      if (socket !== hostSocket) {
        return;
      }

      hostMatchConfig = parsed.matchConfig;
      broadcast(socket, text);
      return;
    }

    if (parsed.type === "READY") {
      if (!hostSocket || hostSocket.readyState !== WebSocket.OPEN) {
        send(socket, { type: "JOIN_REJECTED", reason: "No host is available yet." });
        return;
      }

      send(hostSocket, parsed);
      return;
    }

    if (parsed.type === "LOBBY_STATE") {
      if (socket !== hostSocket) {
        return;
      }

      hostMatchConfig = parsed.matchConfig;
      broadcast(socket, text);
      return;
    }

    if (parsed.type === "START_RUN") {
      if (socket !== hostSocket) {
        return;
      }

      broadcast(socket, text);
      return;
    }

    if (parsed.type === "RUN_RESULT") {
      broadcast(socket, text);
    }
  });

  socket.on("close", () => {
    if (socket !== hostSocket) {
      const playerId = socketPlayerIds.get(socket);
      if (playerId && activePlayerSockets.get(playerId) === socket) {
        activePlayerSockets.delete(playerId);
      }

      if (playerId && !activePlayerSockets.has(playerId) && hostSocket?.readyState === WebSocket.OPEN) {
        send(hostSocket, { type: "PLAYER_LEFT", playerId });
      }
      return;
    }

    clearHostLobby(socket);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Multi Cars LAN server listening on port ${port}`);
  for (const address of getLanAddresses()) {
    console.log(`  ws://${address}:${port}`);
  }
});

function getLanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  return addresses.length ? addresses : ["127.0.0.1"];
}

function parseMessage(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(sender, text) {
  for (const client of wss.clients) {
    if (client === sender || client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(text);
  }
}

function clearHostLobby(sender) {
  hostSocket = null;
  hostMatchConfig = null;
  activePlayerSockets.clear();
  broadcast(sender, JSON.stringify({ type: "HOST_LEFT" }));
}
