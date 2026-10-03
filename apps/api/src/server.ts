import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { initRealtime } from "./lib/realtime.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`[api] Chuyassi Emmanuel CE API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Socket.IO shares the HTTP server: chat delivery, call signaling and WebRTC relay.
initRealtime(server);

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("[api] Shutdown complete");
    process.exit(0);
  });

  // Force-exit if connections do not drain in time.
  setTimeout(() => {
    console.error("[api] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
