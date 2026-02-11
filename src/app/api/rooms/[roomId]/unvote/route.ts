import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId, getRoomAdminCookieName, withSessionCookie } from "@/lib/apiHelpers";
import { computeVotingFinished, ensureConnection, toRoomView } from "@/lib/roomLogic";
import { getRoom, setRoom } from "@/lib/roomStore";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  if (!/^\d{5}$/.test(roomId)) {
    return NextResponse.json({ error: "ルームIDが不正です。" }, { status: 400 });
  }

  const { sessionId, setCookie } = getOrCreateSessionId(req);

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "ルームが見つかりません。" }, { status: 404 });
  }

  const adminCookie = req.cookies.get(getRoomAdminCookieName(roomId))?.value;
  const isAdmin = !!adminCookie && adminCookie === room.adminToken;

  let nextRoom = ensureConnection(room, sessionId);
  if (computeVotingFinished(nextRoom)) {
    return NextResponse.json({ error: "投票は既に終了しています。" }, { status: 400 });
  }

  const conn = nextRoom.connections[sessionId];
  const now = Date.now();
  nextRoom = {
    ...nextRoom,
    updatedAt: now,
    connections: {
      ...nextRoom.connections,
      [sessionId]: { ...conn, vote: null, updatedAt: now },
    },
  };
  await setRoom(nextRoom);

  const view = toRoomView({ room: nextRoom, sessionId, isAdmin });
  const res = NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
  return withSessionCookie(res, setCookie);
}

