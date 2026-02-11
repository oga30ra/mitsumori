"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function isRoomId(s: string) {
  return /^\d{5}$/.test(s);
}

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedRoomId = useMemo(() => roomId.replace(/[^\d]/g, "").slice(0, 5), [roomId]);

  async function createRoom() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = (await res.json()) as { roomId?: string; error?: string };
      if (!res.ok || !data.roomId) throw new Error(data.error ?? "作成に失敗しました。");
      router.push(`/${data.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました。");
      setBusy(false);
    }
  }

  async function joinRoom() {
    setError(null);
    const id = normalizedRoomId;
    if (!isRoomId(id)) {
      setError("5桁のルーム番号を入力してください。");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "ルームに入れませんでした。");
      }
      router.push(`/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ルームに入れませんでした。");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen text-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">MitsuMori</h1>
              <p className="mt-2 text-sm text-zinc-600">
                ルームを作ってURL（または5桁番号）を共有し、チームで見積もりを揃えます。
              </p>
            </div>
          </div>
        </header>

        <main className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-700" htmlFor="room">
                  ルーム番号（5桁）
                </label>
                <input
                  id="room"
                  inputMode="numeric"
                  pattern="\\d*"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 text-lg tracking-widest outline-none focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  value={normalizedRoomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="例: 12345"
                  disabled={busy}
                />
              </div>
              <button
                onClick={joinRoom}
                disabled={busy}
                className="inline-flex h-[54px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                入室
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                はじめての人はルームを作成してください。
              </div>
              <button
                onClick={createRoom}
                disabled={busy}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-zinc-900 px-6 font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                ルームを作成
              </button>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

