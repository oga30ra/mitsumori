import type {
  CardPackId,
  RoomConnection,
  RoomState,
  RoomView,
  SessionId,
  VoteValue,
} from "./planningPokerTypes";

export const CARD_PACKS: Record<CardPackId, VoteValue[]> = {
  fib: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?"],
  goat: ["0", "½", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "☕"],
  seq: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?"],
  play: ["A♠", "2", "3", "5", "8", "♔"],
  tshirt: ["XL", "L", "M", "S", "XS", "?"],
};

export function ensureConnection(
  room: RoomState,
  sessionId: SessionId,
): RoomState {
  const existing = room.connections[sessionId];
  if (existing) return room;
  const now = Date.now();
  const conn: RoomConnection = {
    sessionId,
    voter: true,
    vote: null,
    joinedAt: now,
    updatedAt: now,
  };
  return {
    ...room,
    updatedAt: now,
    connections: { ...room.connections, [sessionId]: conn },
  };
}

export function computeVotingFinished(room: RoomState): boolean {
  if (room.forcedReveal) return true;
  const voters = Object.values(room.connections).filter((c) => c.voter);
  if (voters.length === 0) return false;
  return voters.every((c) => c.vote != null && c.vote !== "");
}

export function toRoomView(opts: {
  room: RoomState;
  sessionId: SessionId;
  isAdmin: boolean;
}): RoomView {
  const { room, sessionId, isAdmin } = opts;
  const finished = computeVotingFinished(room);
  const revealed = finished; // reveal when finished (forced or all voters voted)

  const connections = Object.values(room.connections)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((c) => {
      const isSelf = c.sessionId === sessionId;
      const hasVoted = !!c.vote;
      const canSeeVote = revealed || isSelf;
      return {
        sessionId: c.sessionId,
        voter: c.voter,
        hasVoted,
        vote: canSeeVote ? c.vote : null,
        isSelf,
      };
    });

  const voterCount = Object.values(room.connections).filter((c) => c.voter)
    .length;
  const votedCount = Object.values(room.connections).filter(
    (c) => c.voter && c.vote,
  ).length;

  const me = room.connections[sessionId] ?? {
    sessionId,
    voter: true,
    vote: null,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    roomId: room.roomId,
    cardPack: room.cardPack,
    forcedReveal: room.forcedReveal,
    revealed,
    isAdmin,
    connections,
    voterCount,
    votedCount,
    my: {
      sessionId: me.sessionId,
      voter: me.voter,
      vote: me.vote,
    },
  };
}

