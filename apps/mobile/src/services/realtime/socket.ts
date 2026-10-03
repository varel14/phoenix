import { io, type Socket } from "socket.io-client";
import Cookies from "@react-native-cookies/cookies";
import { API_URL } from "../api/api-client";

/**
 * Singleton Socket.IO connection. The Better Auth session token is read from
 * the native cookie store and sent in the handshake — the server resolves it
 * against the session table before allowing any room subscription.
 */
let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;
// Guard against the race where disconnectRealtime() runs while the cookie
// read inside connectRealtime() is still in flight — without it the pending
// connect would assign a live, authenticated socket after cleanup.
let disconnected = true;

export async function connectRealtime(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  disconnected = false;
  connecting = (async () => {
    try {
      const cookies = await Cookies.get(API_URL);
      const sessionToken = cookies?.["phoenix.session_token"]?.value;
      if (!sessionToken || disconnected) return null;

      socket = io(API_URL, {
        transports: ["websocket"],
        auth: { sessionToken },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10_000,
      });
      return socket;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectRealtime(): void {
  disconnected = true;
  socket?.disconnect();
  socket = null;
}
