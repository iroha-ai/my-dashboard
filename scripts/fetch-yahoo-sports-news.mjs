#!/usr/bin/env node
// Yahoo!ニュースのRSS（サッカー／モータースポーツ）を取得し、定時ニュース欄の
// 右側に出す見出し一覧JSONを書き出す（2026-08-20、Hideの依頼で追加）。
//
// Yahoo!ニュースの公式カテゴリRSSには独立したサッカーRSSがないため、
// サッカー専門媒体の公式RSSを束ねてサッカー欄にする。「モータースポーツ」単体の
// カテゴリRSSも存在しないため、同社にニュースを配信しているmedia/msportcom
// （motorsport.com 日本版。F1中心）のRSSで代替している。
//
// どちらのRSSも Access-Control-Allow-Origin が無く、ブラウザから直接fetchできない
// （train.jsonと同じ理由・同じ仕組みで回避する）。このスクリプトをGitHub Actionsから
// 定期実行し、data ブランチへJSONを書き出す。
const SOCCER_RSS_FEEDS = [
  'https://news.yahoo.co.jp/rss/media/soccermzw/all.xml',
  'https://news.yahoo.co.jp/rss/media/gekisaka/all.xml',
  'https://news.yahoo.co.jp/rss/media/goal/all.xml',
  'https://news.yahoo.co.jp/rss/media/soccerk/all.xml',
];
const MOTORSPORTS_RSS = 'https://news.yahoo.co.jp/rss/media/msportcom/all.xml';
const MARINOS_KEYWORDS = ['マリノス', '横浜FM', '横浜ＦＭ', '横浜F・マリノス', '横浜Ｆ・マリノス'];
const MOTORSPORTS_YELLOW_KEYWORDS = [
  '角田',
  'ホンダ',
  'ＨＯＮＤＡ',
  'Honda',
  'HONDA',
  'アストンマーティン',
  'アストンマーチン',
  'Aston Martin',
  'アロンソ',
];
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

function cleanSummary(text) {
  return decodeEntities(unwrapCdata(text))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    const descriptionRaw = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '';
    let title = decodeEntities(unwrapCdata(titleRaw)).trim();
    const link = decodeEntities(unwrapCdata(linkRaw)).trim();
    if (!title || !link) continue;
    if (stripSuffix) title = stripSourceSuffix(title);
    const summary = cleanSummary(descriptionRaw) || title;
    items.push({ title, summary, link });
  }
  return items;
}

async function fetchFeed(url, opts) {
  const xml = await getText(url);
  const items = parseItems(xml, opts);
  if (!items.length) throw new Error('見出しが1件も取れなかった（RSS形式が変わった可能性）');
  return items.slice(0, MAX_ITEMS);
}

async function fetchSoccerFeed() {
  const feedGroups = await Promise.all(SOCCER_RSS_FEEDS.map((url) => fetchFeed(url)));
  const seen = new Set();
  const items = [];
  for (const group of feedGroups) {
    for (const item of group) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      items.push(item);
      if (items.length >= MAX_ITEMS) return items;
    }
  }
  return items;
}

function addSearchKeywords(items, fallback, specialKeywords) {
  return items.map((item) => ({
    ...item,
    searchKeyword: specialKeywords.find((kw) => item.title.includes(kw)) || fallback,
  }));
}

async function main() {
  // 片方だけ失敗した場合も含め、まとめて失敗扱いにする。中途半端な内容で
  // dataブランチを上書きすると、失敗した側の欄が「空」で確定してしまい、
  // 直前の正常な見出しが消えてしまうため（train.json同様、取れないときは
  // 直前の状態を保つ方を優先する）。
  const [soccer, motorsports] = await Promise.all([
    fetchSoccerFeed(),
    fetchFeed(MOTORSPORTS_RSS, { stripSuffix: true }),
  ]);

  const payload = {
    updatedAt: new Date().toISOString(),
    // 既存のdashboard JSON互換のため、サッカー欄もsportsキーで保存する。
    sports: addSearchKeywords(soccer, 'サッカー', MARINOS_KEYWORDS),
    motorsports: addSearchKeywords(motorsports, 'モータースポーツ', MOTORSPORTS_YELLOW_KEYWORDS),
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
