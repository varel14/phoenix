import crypto from "node:crypto";
import { env } from "../config/env.js";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN = "stun:stun.l.google.com:19302";

/**
 * coturn "REST API" shared-secret auth: username is "<expiry>:<user>" and the
 * credential is base64(HMAC-SHA1(secret, username)). coturn rejects credentials
 * whose expiry has passed, so leaked values stop working on their own.
 */
function ephemeralTurnCredentials(secret: string, userId: string): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + env.TURN_CREDENTIAL_TTL_SEC;
  const username = `${expiry}:${userId}`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  return { username, credential };
}

/**
 * ICE servers handed to call participants. Always includes a public STUN
 * server; the TURN relay is appended only when TURN_URL is configured —
 * without it peers behind symmetric NAT cannot connect.
 */
export function getIceServers(userId: string): IceServer[] {
  const servers: IceServer[] = [{ urls: DEFAULT_STUN }];

  if (env.TURN_URL) {
    const urls = env.TURN_URL
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      if (env.TURN_AUTH_SECRET) {
        servers.push({ urls, ...ephemeralTurnCredentials(env.TURN_AUTH_SECRET, userId) });
      } else if (env.TURN_USERNAME && env.TURN_CREDENTIAL) {
        servers.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
      } else {
        servers.push({ urls });
      }
    }
  }

  return servers;
}
