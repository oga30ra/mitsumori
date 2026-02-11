export type CardPackId = "goat" | "fib" | "seq" | "play" | "tshirt";
export type VoteValue = string;

export type RoomId = string; // 5 digits
export type SessionId = string; // uuid

export interface RoomConnection {
  sessionId: SessionId;
  voter: boolean;
  vote: VoteValue | null;
  joinedAt: number;
  updatedAt: number;
}

export interface RoomState {
  roomId: RoomId;
  createdAt: number;
  updatedAt: number;
  cardPack: CardPackId;
  forcedReveal: boolean;
  adminToken: string;
  connections: Record<SessionId, RoomConnection>;
}

export interface RoomViewConnection {
  sessionId: SessionId;
  voter: boolean;
  hasVoted: boolean;
  vote: VoteValue | null;
  isSelf: boolean;
}

export interface RoomView {
  roomId: RoomId;
  cardPack: CardPackId;
  forcedReveal: boolean;
  revealed: boolean;
  isAdmin: boolean;
  connections: RoomViewConnection[];
  voterCount: number;
  votedCount: number;
  my: {
    sessionId: SessionId;
    voter: boolean;
    vote: VoteValue | null;
  };
}

