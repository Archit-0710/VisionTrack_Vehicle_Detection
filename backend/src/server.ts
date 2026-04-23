import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import { Server as SocketIOServer, Socket } from "socket.io";
import WebSocket from "ws";

const PYTHON_URL = process.env.PYTHON_URL ?? "http://localhost:8000";
const PYTHON_WS = process.env.PYTHON_WS ?? "ws://localhost:8000";
const PORT = parseInt(process.env.PORT ?? "3001", 10);

// ---- Express app ----
const app = express();
app.use(cors({ origin: "*" }));
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "vehicle-detection-gateway" });
});

// ---- HTTP server + Socket.io ----
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e6, // 5 MB (for base64 thumbnails)
  transports: ["websocket", "polling"],
});

// ---- Active bridges: runId → Set<Socket> ----
const bridges = new Map<number, { pyWs: WebSocket; sockets: Set<Socket> }>();

io.on("connection", (socket: Socket) => {
  console.log(`[WS] client connected: ${socket.id}`);

  /**
   * Client emits 'subscribe' with { runId } to start receiving processing updates.
   * Gateway opens a WebSocket to Python /ws/{runId} and relays all messages.
   */
  socket.on("subscribe", ({ runId }: { runId: number }) => {
    if (!runId) return;
    console.log(`[WS] ${socket.id} subscribing to run ${runId}`);

    // Re-use existing Python WS if already bridged
    if (bridges.has(runId)) {
      bridges.get(runId)!.sockets.add(socket);
      socket.join(`run:${runId}`);
      return;
    }

    // Open new Python WebSocket
    const pyWs = new WebSocket(`${PYTHON_WS}/api/ws/${runId}`);
    const entry = { pyWs, sockets: new Set<Socket>([socket]) };
    bridges.set(runId, entry);
    socket.join(`run:${runId}`);

    pyWs.on("open", () => {
      console.log(`[WS] Python WS open for run ${runId}`);
    });

    pyWs.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Broadcast to all clients subscribed to this run
        io.to(`run:${runId}`).emit(msg.type ?? "update", msg);
        // Clean up bridge when done
        if (msg.type === "processing_complete" || msg.type === "error") {
          pyWs.close();
          bridges.delete(runId);
        }
      } catch {
        // ignore parse errors
      }
    });

    pyWs.on("error", (err: Error) => {
      console.error(`[WS] Python WS error run ${runId}:`, err.message);
      io.to(`run:${runId}`).emit("error", { message: err.message });
    });

    pyWs.on("close", () => {
      console.log(`[WS] Python WS closed for run ${runId}`);
      bridges.delete(runId);
    });
  });

  /**
   * Client emits 'unsubscribe' to stop receiving updates for a run.
   */
  socket.on("unsubscribe", ({ runId }: { runId: number }) => {
    socket.leave(`run:${runId}`);
    const entry = bridges.get(runId);
    if (entry) {
      entry.sockets.delete(socket);
      if (entry.sockets.size === 0) {
        entry.pyWs.close();
        bridges.delete(runId);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[WS] client disconnected: ${socket.id}`);
    // Clean up empty bridges
    for (const [runId, entry] of bridges.entries()) {
      entry.sockets.delete(socket);
      if (entry.sockets.size === 0) {
        entry.pyWs.close();
        bridges.delete(runId);
      }
    }
  });
});

// ---- Start ----
httpServer.listen(PORT, () => {
  console.log(`🚗  Gateway listening on http://localhost:${PORT}`);
  console.log(`    Bridging Python service at ${PYTHON_URL}`);
});
