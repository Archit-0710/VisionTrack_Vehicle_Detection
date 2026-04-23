/** Socket.io client singleton that bridges to the Node.js gateway on :3001 */
import { io, Socket } from "socket.io-client";

const GATEWAY_URL = "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(GATEWAY_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socket.on("connect", () => {
      console.log("[Socket.io] connected to gateway");
    });
    socket.on("disconnect", (reason: string) => {
      console.log("[Socket.io] disconnected:", reason);
    });
    socket.on("connect_error", (err: Error) => {
      console.warn("[Socket.io] connect error:", err.message);
    });
  }
  return socket;
}

export function subscribeToRun(runId: number): void {
  getSocket().emit("subscribe", { runId });
}

export function unsubscribeFromRun(runId: number): void {
  getSocket().emit("unsubscribe", { runId });
}

export function destroySocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
