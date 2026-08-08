#!/usr/bin/env node
// GitHub Actions から定期的に走らせ、運行情報の簡易ステータスJSONを書き出す。
// 「異常があるかどうか」だけを検知し、フロント側で該当路線リンクの色を
// 変えるために使う（詳しい文言は出さず、色だけ。詳細は公式ページへ）。
//
// 【2026-08-08 変更】中央線・青梅線はここでは扱わない。GitHub Actionsの
// ランナーが traininfo.jreast.co.jp に Akamai（Bot対策）でブロックされ、
// ライブ検知できなかったため、ジョルダンの運行情報メール検知（GAS）に
// 切り替えた（gas/train-status-watcher.gs → .github/workflows/train-mail.yml
// → data/train-mail.json）。このスクリプトは銀座線（東京メトロ）専用。
// 詳細はHANDOFF.md参照。
//
// 出典（東京メトロの公式サイトが内部で使っているJSONをそのまま読む形。
// 社内モニターでの個人利用の範囲と割り切って使っている。2026-08-07、
// Hide了承済み。HANDOFF.md参照）:
//
//   銀座線: https://www.tokyometro.jp/library/common/operation/status.json
//     東京メトロの公式トップページが読み込んでいるJSONP
//     （operate_status_cb_func(...)）。jp.lines[].status_icon が
//     "heijou" なら平常、それ以外は何かしら異常。

const TIMEOUT_MS = 15_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) {
    if (process.env.DEBUG_TRAIN) {
      console.error(`DEBUG ${url} -> ${res.status}`);
      for (const [k, v] of res.headers.entries()) console.error(`DEBUG header ${k}: ${v}`);
      console.error(`DEBUG body(500): ${(await res.text()).slice(0, 500)}`);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchMetroGinza() {
  const text = await getText('https://www.tokyometro.jp/library/common/operation/status.json');
  // JSONP（例: operate_status_cb_func({...})）の皮を剥ぐ。
  const m = text.match(/^\s*[\w$]+\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) throw new Error('JSONPの形式が想定と違う');
  const data = JSON.parse(m[1]);
  const line = data?.jp?.lines?.find((l) => l.name_alpha === 'ginza');
  if (!line) throw new Error('銀座線のデータが見つからない');
  return line;
}

async function main() {
  const items = [];

  try {
    const metro = await fetchMetroGinza();
    items.push({
      id: 'ginza',
      label: '銀座線',
      ok: true,
      isNormal: metro.status_icon === 'heijou',
      status: metro.status_info,
    });
  } catch (err) {
    items.push({ id: 'ginza', label: '銀座線', ok: false, reason: `取得失敗: ${err.message}` });
  }

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
