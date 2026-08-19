#!/usr/bin/env node
// Yahoo!ニュースのRSS（スポーツ総合／モータースポーツ）を取得し、定時ニュース欄の
// 右側に出す見出し一覧JSONを書き出す（2026-08-20、Hideの依頼で追加）。
//
// Yahoo!ニュースの公式カテゴリRSSは国内・国際・経済・エンタメ・スポーツ・IT・科学・
// 地域の8種のみで、「モータースポーツ」単体のカテゴリRSSは存在しない
// （https://news.yahoo.co.jp/rss で確認済み）。そのため、モータースポーツ枠は
// 同社にニュースを配信している media/msportcom（motorsport.com 日本版。F1中心）の
// RSSで代替している。
//
// どちらのRSSも Access-Control-Allow-Origin が無く、ブラウザから直接fetchできない
// （train.jsonと同じ理由・同じ仕組みで回避する）。このスクリプトをGitHub Actionsから
// 定期実行し、data ブランチへJSONを書き出す。
const SPORTS_RSS = 'https://news.yahoo.co.jp/rss/topics/sports.xml';
const MOTORSPORTS_RSS = 'https://news.yahoo.co.jp/rss/media/msportcom/all.xml';
const MAX_ITEMS = 10;
const TIMEOUT_MS = 15_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function unwrapCdata(text) {
  const m = text.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return m ? m[1] : text;
}

// motorsport.com 日本版のタイトル末尾に付く配信元表記
// 「…(motorsport.com 日本版)」を取り除く。他フィードでは該当しないので無害。
function stripSourceSuffix(title) {
  return title.replace(/\s*\([^()]{1,24}\)\s*$/, '').trim();
}

// 依存を増やしたくないので簡易正規表現でRSSの<item>だけ拾う
// （Yahoo!ニュースのRSSは構造が単純で、この程度で十分。train.jsonの
// JSONP剥がしと同じ「決め打ちで十分」という判断）。
function parseItems(xml, { stripSuffix = false } = {}) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const linkRaw = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '';
    let title = decodeEntities(unwrapCdata(titleRaw)).trim();
    const link = decodeEntities(unwrapCdata(linkRaw)).trim();
    if (!title || !link) continue;
    if (stripSuffix) title = stripSourceSuffix(title);
    items.push({ title, link });
  }
  return items;
}

async function fetchFeed(url, opts) {
  const xml = await getText(url);
  const items = parseItems(xml, opts);
  if (!items.length) throw new Error('見出しが1件も取れなかった（RSS形式が変わった可能性）');
  return items.slice(0, MAX_ITEMS);
}

async function main() {
  // 片方だけ失敗した場合も含め、まとめて失敗扱いにする。中途半端な内容で
  // dataブランチを上書きすると、失敗した側の欄が「空」で確定してしまい、
  // 直前の正常な見出しが消えてしまうため（train.json同様、取れないときは
  // 直前の状態を保つ方を優先する）。
  const [sports, motorsports] = await Promise.all([
    fetchFeed(SPORTS_RSS),
    fetchFeed(MOTORSPORTS_RSS, { stripSuffix: true }),
  ]);

  const payload = {
    updatedAt: new Date().toISOString(),
    sports,
    motorsports,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
