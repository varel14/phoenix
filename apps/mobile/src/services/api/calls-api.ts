import { apiFetch } from "./api-client";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const CACHE_TTL_MS = 10 * 60_000;

let cache: { servers: IceServer[]; expiresAt: number } | null = null;

export const callsApi = {
  /**
   * TURN/STUN servers for WebRTC calls. Credentials are short-lived
   * server-side, so the answer is cached for a few minutes at most.
   * Falls back to plain STUN when the API is unreachable (direct P2P may
   * then fail behind symmetric NAT, but nothing breaks otherwise).
   */
  async iceServers(): Promise<IceServer[]> {
    if (cache && cache.expiresAt > Date.now()) return cache.servers;
    try {
      const result = await apiFetch<{ data: { iceServers: IceServer[] } }>("/api/v1/calls/ice-servers");
      const servers = result.data.iceServers;
      if (servers.length === 0) return DEFAULT_ICE_SERVERS;
      cache = { servers, expiresAt: Date.now() + CACHE_TTL_MS };
      return servers;
    } catch {
      return DEFAULT_ICE_SERVERS;
    }
  },
};
