#!/usr/bin/env node
// GitHub Actions から5分ごとに走らせ、運行情報JSONを標準出力へ書き出す。
//
// 取得先: 鉄道運行情報API（rti-giken、非公式・キー不要）
//   https://tetsudo.rti-giken.jp/free/train_all.json
// このAPIはスキーマが公開されておらず、実装時点（2026-08-07）に
// サイト自体へ疎通できず内容を確認できていない。落ちていたときも
// 路線ごとに「取得できず」を返し、他の路線・相場データを巻き添えにしない。
//
// 「対象路線が見つからない」を黙って平常運転扱いにはしない。
// train_all.json という名前から全路線を返す設計だと考えられるため、
// 見つからない＝取りこぼしとして扱う（README参照）。

const TIMEOUT_MS = 15_000;
const SOURCE_URL = 'https://tetsudo.rti-giken.jp/free/train_all.json';

const LINES = [
  {
    id: 'chuo',
    label: '中央線',
    match: (name) => name.includes('中央線') && !name.includes('総武'),
  },
  { id: 'ome', label: '青梅線', match: (name) => name.includes('青梅線') },
  { id: 'ginza', label: '銀座線', match: (name) => name.includes('銀座線') },
];

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'my-dashboard/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  let entries = [];
  let fetchError = null;
  try {
    const data = await getJson(SOURCE_URL);
    if (!Array.isArray(data)) throw new Error('想定外の形式（配列でない）');
    entries = data;
  } catch (err) {
    fetchError = err.message;
  }

  const items = LINES.map((line) => {
    if (fetchError) {
      return { id: line.id, label: line.label, ok: false, reason: `取得失敗: ${fetchError}` };
    }

    const hit = entries.find((e) => line.match(String(e?.name ?? '')));
    if (!hit) {
      // 名前の表記が変わった等で見つからない場合。平常運転だと決めつけない。
      return { id: line.id, label: line.label, ok: false, reason: '対象路線が見つかりません' };
    }

    const status = String(hit.status ?? '').trim() || '不明';
    return {
      id: line.id,
      label: line.label,
      ok: true,
      status,
      isNormal: status.includes('平常'),
      pubDate: hit.pubDate ?? null,
      url: hit.url ?? hit.traffic_information_url ?? null,
    };
  });

  const payload = { updatedAt: new Date().toISOString(), items };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  const missing = items.filter((i) => !i.ok).map((i) => i.id);
  if (missing.length) {
    console.error(`取得できなかった路線: ${missing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
