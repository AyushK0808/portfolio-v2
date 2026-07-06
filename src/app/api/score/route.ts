import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Arena high-score cache. The all-time best across every visitor lives in a
 * Workers KV namespace (binding: SCORES) — a globally-replicated, low-latency
 * store, which is the right "cache" for a single shared leaderboard value.
 *
 *   GET  /api/score        → { best, name }
 *   POST /api/score {score,name} → records it if it beats the cache; { best, name }
 *
 * If the KV binding is absent (e.g. plain `next dev` without a namespace) the
 * endpoint degrades to a no-op so the game still runs.
 */

const KEY = 'arena:highscore';

interface HighScore {
  best: number;
  name: string;
  at: string;
}

interface ScoreEnv {
  SCORES?: KVNamespace;
}

function kv(): KVNamespace | null {
  try {
    return (getCloudflareContext().env as unknown as ScoreEnv).SCORES ?? null;
  } catch {
    return null;
  }
}

async function readBest(store: KVNamespace | null): Promise<HighScore> {
  const empty: HighScore = { best: 0, name: '—', at: '' };
  if (!store) return empty;
  const raw = await store.get(KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<HighScore>;
    return {
      best: Number(parsed.best) || 0,
      name: (parsed.name || '—').toString(),
      at: (parsed.at || '').toString(),
    };
  } catch {
    return empty;
  }
}

export async function GET() {
  const current = await readBest(kv());
  return NextResponse.json(current, {
    headers: { 'Cache-Control': 'public, max-age=15' },
  });
}

export async function POST(req: NextRequest) {
  let body: { score?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad payload' }, { status: 400 });
  }

  const score = Math.floor(Number(body.score));
  if (!Number.isFinite(score) || score < 0 || score > 10_000_000) {
    return NextResponse.json({ ok: false, error: 'bad score' }, { status: 400 });
  }
  const name = (body.name ?? 'GUEST PILOT').toString().trim().slice(0, 24) || 'GUEST PILOT';

  const store = kv();
  const current = await readBest(store);

  if (store && score > current.best) {
    const next: HighScore = { best: score, name, at: new Date().toISOString() };
    await store.put(KEY, JSON.stringify(next));
    return NextResponse.json({ ok: true, ...next });
  }

  return NextResponse.json({ ok: true, ...current });
}
