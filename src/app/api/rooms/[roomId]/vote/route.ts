import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSessionId, getRoomAdminCookieName, readJson, withSessionCookie } from "@/lib/apiHelpers";
import { CARD_PACKS, computeVotingFinished, ensureConnection, toRoomView } from "@/lib/roomLogic";
import { getRoom, setRoom } from "@/lib/roomStore";

type Body = { vote?: string };

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
  const vote = body.vote;
  if (typeof vote !== "string" || vote.length === 0) {
    return NextResponse.json({ error: "voteが不正です。" }, { status: 400 });
  }

  const room = await getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "ルームが見つかりません。" }, { status: 404 });
  }

  const adminCookie = req.cookies.get(getRoomAdminCookieName(roomId))?.value;
  const isAdmin = !!adminCookie && adminCookie === room.adminToken;

  let nextRoom = ensureConnection(room, sessionId);
  const conn = nextRoom.connections[sessionId];
  if (!conn.voter) {
    return NextResponse.json({ error: "投票者に設定されていません。" }, { status: 400 });
  }
  if (computeVotingFinished(nextRoom)) {
    return NextResponse.json({ error: "投票は既に終了しています。" }, { status: 400 });
  }

  const validVotes = CARD_PACKS[nextRoom.cardPack] ?? [];
  if (!validVotes.includes(vote)) {
    return NextResponse.json({ error: "このカードパックに存在しない票です。" }, { status: 400 });
  }

  const now = Date.now();
  nextRoom = {
    ...nextRoom,
    updatedAt: now,
    connections: {
      ...nextRoom.connections,
      [sessionId]: { ...conn, vote, updatedAt: now },
    },
  };

  await setRoom(nextRoom);

  const view = toRoomView({ room: nextRoom, sessionId, isAdmin });
  const res = NextResponse.json(view, {
    headers: { "Cache-Control": "no-store" },
  });
  return withSessionCookie(res, setCookie);
}

