import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId, getRoomAdminCookieName, readJson, withSessionCookie } from "@/lib/apiHelpers";
import { CARD_PACKS, ensureConnection, toRoomView } from "@/lib/roomLogic";
import type { CardPackId } from "@/lib/planningPokerTypes";
import { getRoom, setRoom } from "@/lib/roomStore";

type Body = { cardPack?: CardPackId };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  if (!/^\d{5}$/.test(roomId)) {
    return NextResponse.json({ error: "ルームIDが不正です。" }, { status: 400 });
  }

  const { sessionId, setCookie } = getOrCreateSessionId(req);
  const body = (await readJson<Body>(req)) ?? {};
  const cardPack = body.cardPack;
  if (!cardPack || !(cardPack in CARD_PACKS)) {
    return NextResponse.json({ error: "cardPackが不正です。" }, { status: 400 });
  }

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "ルームが見つかりません。" }, { status: 404 });
  }

  const adminCookie = req.cookies.get(getRoomAdminCookieName(roomId))?.value;
  const isAdmin = !!adminCookie && adminCookie === room.adminToken;
  if (!isAdmin) {
    return NextResponse.json({ error: "管理者のみ実行できます。" }, { status: 403 });
  }

  let nextRoom = ensureConnection(room, sessionId);
  const now = Date.now();
  nextRoom = {
    ...nextRoom,
    updatedAt: now,
    cardPack,
    forcedReveal: false,
    connections: Object.fromEntries(
      Object.entries(nextRoom.connections).map(([sid, c]) => [
        sid,
        { ...c, vote: null, updatedAt: now },
      ]),
    ),
  };
  await setRoom(nextRoom);

  const view = toRoomView({ room: nextRoom, sessionId, isAdmin: true });
  const res = NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
  return withSessionCookie(res, setCookie);
}

