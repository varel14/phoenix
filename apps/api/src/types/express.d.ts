declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth middleware. */
      user?: AuthenticatedUser;
      /** Parsed + validated request data, set by the validate() middleware. */
      validated?: ValidatedData;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image: string | null | undefined;
  role: "USER" | "ARTIST";
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidatedData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export {};
