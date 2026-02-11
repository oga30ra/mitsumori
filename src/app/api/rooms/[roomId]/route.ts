import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId, getRoomAdminCookieName, withSessionCookie } from "@/lib/apiHelpers";
import { getRoom, setRoom } from "@/lib/roomStore";
import { ensureConnection, toRoomView } from "@/lib/roomLogic";

function isValidRoomId(roomId: string) {
  return /^\d{5}$/.test(roomId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  if (!isValidRoomId(roomId)) {
    return NextResponse.json({ error: "ルームIDが不正です。" }, { status: 400 });
  }

  const { sessionId, setCookie } = getOrCreateSessionId(req);

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "ルームが見つかりません。" }, { status: 404 });
  }

  const adminCookie = req.cookies.get(getRoomAdminCookieName(roomId))?.value;
  const isAdmin = !!adminCookie && adminCookie === room.adminToken;

  const nextRoom = ensureConnection(room, sessionId);
  if (nextRoom !== room) {
    await setRoom(nextRoom);
  }

  const view = toRoomView({ room: nextRoom, sessionId, isAdmin });
  const res = NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
  return withSessionCookie(res, setCookie);
}

