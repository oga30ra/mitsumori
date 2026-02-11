import { NextRequest, NextResponse } from "next/server";
import type { RoomId, SessionId } from "./planningPokerTypes";

const SESSION_COOKIE = "pp_session";

export function getRoomAdminCookieName(roomId: RoomId) {
  return `pp_admin_${roomId}`;
}

export function getOrCreateSessionId(req: NextRequest): {
  sessionId: SessionId;
  setCookie?: { name: string; value: string };
} {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (existing) return { sessionId: existing };

  const sessionId = crypto.randomUUID();
  return { sessionId, setCookie: { name: SESSION_COOKIE, value: sessionId } };
}

export function withSessionCookie(
  res: NextResponse,
  setCookie?: { name: string; value: string },
) {
  if (!setCookie) return res;
  res.cookies.set({
    name: setCookie.name,
    value: setCookie.value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

