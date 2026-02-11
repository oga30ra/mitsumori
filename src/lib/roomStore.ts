import { Redis } from "@upstash/redis";
import type { RoomId, RoomState } from "./planningPokerTypes";

const DEFAULT_ROOM_TTL_SECONDS = 60 * 60 * 2; // 2 hours

function getRoomTtlSeconds(): number {
  const raw = process.env.PP_ROOM_TTL_SECONDS;
  if (!raw) return DEFAULT_ROOM_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  // safety bounds: 5 minutes .. 30 days
  if (!Number.isFinite(parsed) || parsed < 60 * 5 || parsed > 60 * 60 * 24 * 30) {
    return DEFAULT_ROOM_TTL_SECONDS;
  }
  return parsed;
}

const ROOM_TTL_SECONDS = getRoomTtlSeconds();
const KEY_PREFIX = "pp:room:";

function roomKey(roomId: RoomId) {
  return `${KEY_PREFIX}${roomId}`;
}

function nowMs() {
  return Date.now();
}

function getRedis(): Redis | null {
  // Upstash expects UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return Redis.fromEnv();
  }
  return null;
}

type MemoryEntry = { room: RoomState; expiresAt: number };

function getMemoryStore(): Map<string, MemoryEntry> {
  const g = globalThis as unknown as { __ppRooms?: Map<string, MemoryEntry> };
  if (!g.__ppRooms) g.__ppRooms = new Map();
  return g.__ppRooms;
}

function memoryGet(roomId: RoomId): RoomState | null {
  const store = getMemoryStore();
  const entry = store.get(roomId);
  if (!entry) return null;
  if (entry.expiresAt < nowMs()) {
    store.delete(roomId);
    return null;
  }
  return entry.room;
}

function memorySet(room: RoomState) {
  const store = getMemoryStore();
  store.set(room.roomId, {
    room,
    expiresAt: nowMs() + ROOM_TTL_SECONDS * 1000,
  });
}

export async function getRoom(roomId: RoomId): Promise<RoomState | null> {
  const redis = getRedis();
  if (!redis) return memoryGet(roomId);

  const raw = await redis.get(roomKey(roomId));
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as RoomState;
    } catch {
      return null;
    }
  }
  // If the value was stored as JSON (non-string), Upstash may deserialize it.
  if (typeof raw === "object") {
    return raw as RoomState;
  }
  return null;
}

export async function setRoom(room: RoomState): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memorySet(room);
    return;
  }
  await redis.set(roomKey(room.roomId), JSON.stringify(room), {
    ex: ROOM_TTL_SECONDS,
  });
}

export async function deleteRoom(roomId: RoomId): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    getMemoryStore().delete(roomId);
    return;
  }
  await redis.del(roomKey(roomId));
}

