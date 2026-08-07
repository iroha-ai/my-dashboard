#!/usr/bin/env node
// GitHub Actions から定期的に走らせ、運行情報の簡易ステータスJSONを書き出す。
// 「異常があるかどうか」だけを検知し、フロント側で該当路線リンクの色を
// 変えるために使う（詳しい文言は出さず、色だけ。詳細は公式ページへ）。
//
// 出典（いずれもJR東日本・東京メトロの公式サイトが内部で使っている
// HTML/JSONをそのまま読む形。無断転載・複写・加工を禁じる旨の記載が
// JR東日本側にあるが、社内モニターでの個人利用の範囲と割り切って
// 使っている。2026-08-07、Hide了承済み。HANDOFF.md参照）:
//
//   中央線・青梅線: https://traininfo.jreast.co.jp/train_info/kanto.aspx
//     路線名の直後に traininfo-routes__status クラス（normal/それ以外）と
//     文言が並ぶHTML構造を読む。
//
//   銀座線: https://www.tokyometro.jp/library/common/operation/status.json
//     東京メトロの公式トップページが読み込んでいるJSONP
//     （operate_status_cb_func(...)）。jp.lines[].status_icon が
//     "heijou" なら平常、それ以外は何かしら異常。

const TIMEOUT_MS = 15_000;
// 「いかにもボット」なUAだとJR東日本側で403になったため、実ブラウザに近い
// ヘッダーにしている（Botブロックの回避が目的ではなく、単に人が普通に
// 見るのと同じ条件で読みにいっているだけ）。
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// 路線名の直後2000文字以内に現れる traininfo-routes__status クラスと文言を拾う。
function parseJreastLine(html, lineName) {
  const nameIdx = html.indexOf(`traininfo-routes__name">${lineName}<`);
  if (nameIdx === -1) return null;
  const window = html.slice(nameIdx, nameIdx + 2000);
  const m = window.match(/traininfo-routes__status ([a-z]+)">\s*<span>([^<]+)<\/span>/);
  if (!m) return null;
  return { statusClass: m[1], statusText: m[2].trim() };
}

async function fetchJreast() {
  const html = await getText('https://traininfo.jreast.co.jp/train_info/kanto.aspx');
  return {
    chuo: parseJreastLine(html, '中央線快速電車'),
    ome: parseJreastLine(html, '青梅線'),
  };
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
    const jr = await fetchJreast();
    for (const [id, label, key] of [
      ['chuo', '中央線', 'chuo'],
      ['ome', '青梅線', 'ome'],
    ]) {
      const line = jr[key];
      if (!line) {
        items.push({ id, label, ok: false, reason: '路線が見つかりません' });
      } else {
        items.push({
          id,
          label,
          ok: true,
          isNormal: line.statusClass === 'normal',
          status: line.statusText,
        });
      }
    }
  } catch (err) {
    for (const [id, label] of [
      ['chuo', '中央線'],
      ['ome', '青梅線'],
    ]) {
      items.push({ id, label, ok: false, reason: `取得失敗: ${err.message}` });
    }
  }

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
