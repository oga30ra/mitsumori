import { NextRequest, NextResponse } from "next/server";
import type { RoomState } from "@/lib/planningPokerTypes";
import { getOrCreateSessionId, getRoomAdminCookieName, withSessionCookie } from "@/lib/apiHelpers";
import { getRoom, setRoom } from "@/lib/roomStore";
import { ensureConnection } from "@/lib/roomLogic";

function isFiveDigits(s: string) {
  return /^\d{5}$/.test(s);
}

function randomRoomId(): string {
  const n = Math.floor(10000 + Math.random() * 90000);
  return String(n);
}

export async function POST(req: NextRequest) {
  const { sessionId, setCookie } = getOrCreateSessionId(req);

  let roomId: string | null = null;
  for (let i = 0; i < 30; i++) {
    const candidate = randomRoomId();
    if (!isFiveDigits(candidate)) continue;
    const existing = await getRoom(candidate);
    if (!existing) {
      roomId = candidate;
      break;
    }
  }

  if (!roomId) {
    return NextResponse.json(
      { error: "ルームIDの生成に失敗しました。" },
      { status: 500 },
    );
  }

  const adminToken = crypto.randomUUID();
  const now = Date.now();
  let room: RoomState = {
    roomId,
    createdAt: now,
    updatedAt: now,
    cardPack: "goat",
    forcedReveal: false,
    adminToken,
    connections: {},
  };
  room = ensureConnection(room, sessionId);
  await setRoom(room);

  const res = NextResponse.json({ roomId }, { status: 201 });
  res.cookies.set({
    name: getRoomAdminCookieName(roomId),
    value: adminToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return withSessionCookie(res, setCookie);
}

