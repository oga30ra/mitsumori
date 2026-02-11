## MitsuMori

「ルーム作成 → 参加 → 投票 →（全員投票で自動公開 / 管理者による強制公開）→ リセット」を、Next.js（App Router）で実装した簡易プランニングポーカーです。

**ルーム状態はRedis（Upstash）に保存**し、クライアントは**1秒間隔のポーリング**で同期します。

## Getting Started

### ローカル起動

まず依存関係を入れて、開発サーバを起動します。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

### Redis（推奨）

`.env` に `UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN` を設定してください。

- **ローカルで環境変数なしでも動きます**（メモリ保存フォールバック）が、プロセス再起動で消えます。
- ルームの保持時間（TTL）は `PP_ROOM_TTL_SECONDS`（秒）で調整できます（デフォルト2時間）。

## 使い方

- **`/`**: ロビー（ルーム作成 / 5桁ルーム番号で入室）
- **`/[roomId]`**: ルーム
  - 投票者はカードを選択
  - 全投票者が投票すると自動で公開
  - ルーム作成者（管理者）は `Reveal`（強制公開）や `Reset` が可能

## Deploy on Server like Vercel

- Environment Variables に以下を設定
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `PP_ROOM_TTL_SECONDS`（任意）
