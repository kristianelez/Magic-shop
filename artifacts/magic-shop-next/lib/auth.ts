import type { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "magic-shop-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
  },
};
