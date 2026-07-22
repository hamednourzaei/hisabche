// backend/src/websocket/activity.ws.ts
import { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import { supabase } from "../db";

interface ActivityWebSocketMessage {
  type: "ping" | "pong" | "activity";
  payload: any;
}

export async function activityWebSocket(fastify: FastifyInstance) {
  // Registers the plugin and augments Fastify's route options with
  // `{ websocket: true }`, which is what was previously missing.
  await fastify.register(websocketPlugin);

  fastify.get("/ws/activities", { websocket: true }, (socket, request) => {
    // ─── Send initial ping ──────────────────────────────────────────────────
    socket.send(
      JSON.stringify({
        type: "ping",
        payload: { timestamp: Date.now() },
      })
    );

    // ─── Handle messages ──────────────────────────────────────────────────
    socket.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString()) as ActivityWebSocketMessage;

        if (data.type === "pong") {
          // Keep alive
          return;
        }

        if (data.type === "activity") {
          // ─── Broadcast to all connected clients ────────────────────────
          // This would be implemented with a room/subscription system
          socket.send(
            JSON.stringify({
              type: "activity",
              payload: data.payload,
            })
          );
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    // ─── Handle close ─────────────────────────────────────────────────────
    socket.on("close", () => {
      console.log("WebSocket closed");
    });
  });
}