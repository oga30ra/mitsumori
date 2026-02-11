"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CardPackId, RoomView, VoteValue } from "@/lib/planningPokerTypes";
import { CARD_PACKS } from "@/lib/roomLogic";

function isRoomId(s: string) {
  return /^\d{5}$/.test(s);
}

function toNumber(v: VoteValue | null): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function average(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function standardDeviation(nums: number[]) {
  const avg = average(nums);
  const variance =
    nums.map((x) => (x - avg) ** 2).reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(variance);
}

export default function RoomClient({ roomId }: { roomId: string }) {
  const validRoomId = isRoomId(roomId);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const pollRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const cards = useMemo(() => {
    const pack = room?.cardPack ?? ("goat" as CardPackId);
    return CARD_PACKS[pack] ?? [];
  }, [room?.cardPack]);

  const stats = useMemo(() => {
    if (!room?.revealed) return null;
    const votes = room.connections
      .filter((c) => c.voter)
      .map((c) => toNumber(c.vote))
      .filter((n): n is number => n != null);
    if (votes.length === 0) return { avg: null as number | null, sd: null as number | null };
    return { avg: average(votes), sd: standardDeviation(votes) };
  }, [room]);

  async function refresh(opts?: { force?: boolean }) {
    if (!validRoomId) return;
    if (!opts?.force && !pollingEnabled) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
      const data = (await res.json()) as RoomView | { error?: string };
      if (!res.ok) {
        const message = ("error" in data && data.error) || "取得に失敗しました。";
        setError(message);
        // If the room doesn't exist, stop auto polling.
        if (res.status === 404) setPollingEnabled(false);
        return;
      }
      setRoom(data as RoomView);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました。");
    } finally {
      inFlightRef.current = false;
    }
  }

  async function post(path: string, body?: unknown) {
    if (!validRoomId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = (await res.json()) as RoomView | { error?: string };
      if (!res.ok) throw new Error(("error" in data && data.error) || "操作に失敗しました。");
      setRoom(data as RoomView);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  // initial fetch on room change
  useEffect(() => {
    setPollingEnabled(true);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // polling timer
  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    if (!pollingEnabled) return;

    pollRef.current = window.setInterval(() => {
      void refresh();
    }, 1000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, pollingEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareUrl(`${window.location.origin}/${roomId}`);
  }, [roomId]);

  if (!validRoomId) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-700">ルームIDが不正です。</p>
            <Link className="mt-4 inline-block text-sm font-medium text-zinc-900 underline" href="/">
              ロビーへ戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
                ← ロビー
              </Link>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">Room {roomId}</h1>
                {room?.isAdmin ? (
                  <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
                    管理者
                  </span>
                ) : null}
                {room?.revealed ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900">
                    公開中
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                    未公開
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm text-zinc-600">
                投票者: <span className="font-medium text-zinc-900">{room?.votedCount ?? 0}</span> /{" "}
                <span className="font-medium text-zinc-900">{room?.voterCount ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                onClick={() => {
                  void refresh({ force: true });
                }}
                disabled={busy}
              >
                更新
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                onClick={async () => {
                  const url =
                    shareUrl ||
                    (typeof window !== "undefined" ? window.location.href : "");
                  if (!url) return;

                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    // Safari / insecure context fallback
                    window.prompt("URLをコピーしてください", url);
                  }
                }}
                disabled={busy}
                title={shareUrl || undefined}
              >
                URLをコピー
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                カードパック:{" "}
                <span className="font-medium text-zinc-900">{room?.cardPack ?? "goat"}</span>
              </div>

              {room?.isAdmin ? (
                <select
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-zinc-100 disabled:opacity-50"
                  value={room.cardPack}
                  disabled={busy}
                  onChange={(e) =>
                    post(`/api/rooms/${roomId}/card-pack`, { cardPack: e.target.value as CardPackId })
                  }
                >
                  <option value="goat">Mountain Goat</option>
                  <option value="fib">Fibonacci</option>
                  <option value="seq">Sequential</option>
                  <option value="play">Playing Cards</option>
                  <option value="tshirt">T-Shirt</option>
                </select>
              ) : null}
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3">
              <div className="text-sm">
                <div className="font-medium text-zinc-900">
                  {room?.my.voter ? "投票者" : "投票しない"}
                </div>
                <div className="text-xs text-zinc-600">
                  {room?.my.voter
                    ? room?.my.vote
                      ? `あなたの票: ${room.my.vote}`
                      : "まだ投票していません"
                    : "投票には参加しません"}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={room?.my.voter ?? true}
                  disabled={busy || !!room?.revealed}
                  onChange={(e) => post(`/api/rooms/${roomId}/toggle-voter`, { voter: e.target.checked })}
                />
                I am voting
              </label>
            </div>

            <div className={`grid grid-cols-4 gap-3 sm:grid-cols-6 ${room?.revealed || !room?.my.voter ? "opacity-50" : ""}`}>
              {cards.map((c) => (
                <button
                  key={c}
                  onClick={() => post(`/api/rooms/${roomId}/vote`, { vote: c })}
                  disabled={busy || !!room?.revealed || !room?.my.voter}
                  className={`aspect-[3/4] rounded-2xl border px-2 py-3 text-center text-lg font-semibold shadow-sm transition
                    ${room?.my.vote === c ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"}
                    disabled:cursor-not-allowed`}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">投票</h2>
              {room?.isAdmin ? (
                <div className="flex gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                    onClick={() => post(`/api/rooms/${roomId}/reset`)}
                    disabled={busy}
                  >
                    Reset
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    onClick={() => post(`/api/rooms/${roomId}/reveal`)}
                    disabled={busy || !!room?.revealed}
                  >
                    Reveal
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(room?.connections ?? []).map((c) => {
                const face = room?.revealed
                  ? c.vote ?? "—"
                  : c.hasVoted
                    ? c.isSelf
                      ? c.vote ?? "—"
                      : "X"
                    : " ";

                const clickableUnvote = c.isSelf && c.hasVoted && !room?.revealed;

                return (
                  <button
                    key={c.sessionId}
                    onClick={() => (clickableUnvote ? post(`/api/rooms/${roomId}/unvote`) : undefined)}
                    className={`aspect-[3/4] rounded-2xl border border-zinc-200 bg-white p-2 text-center shadow-sm
                      ${c.voter ? "" : "opacity-50"}
                      ${c.isSelf ? "ring-2 ring-zinc-900/10" : ""}
                      ${clickableUnvote ? "hover:bg-zinc-50" : "cursor-default"}
                    `}
                    type="button"
                  >
                    <div className="text-[10px] text-zinc-500">
                      {c.voter ? "voter" : "watch"}
                      {c.isSelf ? " • you" : ""}
                    </div>
                    <div className="mt-6 text-xl font-semibold text-zinc-900">{face}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              平均/SD:{"  "}
              {room?.revealed ? (
                stats?.avg == null ? (
                  <span className="font-medium text-zinc-900">—</span>
                ) : (
                  <span className="font-medium text-zinc-900">
                    {stats.avg.toFixed(2)} / {stats.sd?.toFixed(2)}
                  </span>
                )
              ) : (
                <span className="text-zinc-500">未公開</span>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

