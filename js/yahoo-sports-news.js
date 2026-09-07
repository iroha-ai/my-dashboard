import { CONFIG } from './config.js?v=20260905-ai-usage';
import { clear, el, fetchJson, showMessage } from './util.js?v=20260905-ai-usage';

// Yahoo!ニュースの2行要約一覧（サッカー／モータースポーツ）。
// 定時ニュース欄（メールダイジェスト）の右側に表示する
// （2026-08-20、Hideの依頼で追加。index.html の .news-split 参照）。
//
// 取得元のRSSにCORSが無くブラウザから直接fetchできないため、
// scripts/fetch-yahoo-sports-news.mjs がGitHub Actionsで定期取得して
// data ブランチへ書いたJSONを読むだけ（train.jsonと同じ仕組み）。

const MAX_ITEMS = 8;
const DEMO_SOCCER = [
  { title: '横浜F・マリノスが新体制を発表', summary: 'サッカー記事の表示例です。', link: '#' },
  { title: 'Jリーグの試合結果', summary: '国内サッカー記事の表示例です。', link: '#' },
];
const DEMO_MOTORSPORTS = [
  { title: '角田裕毅がF1テストに参加', summary: 'モータースポーツ記事の表示例です。', link: '#' },
  { title: 'MotoGPの決勝結果', summary: '二輪レース記事の表示例です。', link: '#' },
];

function findKeyword(keywords, title) {
  return keywords.find((kw) => title.includes(kw)) || '';
}

export function getKeywordInfo(item) {
  const title = item?.title || '';
  const marinosKeyword = findKeyword(CONFIG.yahooNewsMarinosKeywords, title);
  if (marinosKeyword) {
    return { keyword: marinosKeyword, className: 'is-purple-highlight' };
  }
  if (item?.category === 'motorsports') {
    const yellowKeyword = findKeyword(CONFIG.yahooMotorsportsYellowKeywords, title);
    if (yellowKeyword) {
      return { keyword: yellowKeyword, className: 'is-yellow-highlight' };
    }
    return { keyword: 'モータースポーツ', className: 'is-general-highlight' };
  }
  return { keyword: 'サッカー', className: 'is-general-highlight' };
}

export function combineSportsNews(soccer, motorsports, limit = MAX_ITEMS) {
  const groups = [
    { category: 'soccer', items: Array.isArray(soccer) ? soccer : [] },
    { category: 'motorsports', items: Array.isArray(motorsports) ? motorsports : [] },
  ];
  const combined = [];
  let index = 0;

  while (combined.length < limit && groups.some((group) => index < group.items.length)) {
    for (const group of groups) {
      const item = group.items[index];
      if (!item) continue;
      combined.push({ ...item, category: group.category });
      if (combined.length >= limit) break;
    }
    index += 1;
  }
  return combined;
}

function renderList(listId, items) {
  const list = document.getElementById(listId);
  if (!list) return;
  clear(list);

  if (!items || !items.length) {
    list.appendChild(el('li', 'placeholder', '見出しを取得できませんでした'));
    return;
  }

  for (const item of items.slice(0, MAX_ITEMS)) {
    const li = el('li', 'yahoo-news-item');
    const a = document.createElement('a');
    a.href = item.link;
    a.target = '_blank';
    a.rel = 'noopener';
    const { keyword, className } = getKeywordInfo(item);
    a.className = `yahoo-news-link${className ? ` ${className}` : ''}`;
    const summary = item.summary || item.title;
    const summaryNode = el('span', 'news-summary');
    summaryNode.appendChild(el('span', 'news-search-keyword', `【${keyword}】`));
    summaryNode.appendChild(document.createTextNode(summary));
    a.appendChild(summaryNode);
    li.appendChild(a);
    list.appendChild(li);
  }
}

export async function updateYahooSportsNews(onStatus) {
  if (new URLSearchParams(location.search).get('demo') === '1') {
    renderList('yahoo-sports-list', combineSportsNews(DEMO_SOCCER, DEMO_MOTORSPORTS));
    onStatus?.('yahooSportsNews', null, false);
    return;
  }

  try {
    const data = await fetchJson(`${CONFIG.yahooSportsNewsDataUrl}?t=${Date.now()}`);
    renderList('yahoo-sports-list', combineSportsNews(data.sports, data.motorsports));
    onStatus?.('yahooSportsNews', null, false);
  } catch (err) {
    console.error('サッカー・モータースポーツニュース見出しの取得に失敗', err);
    showMessage(document.getElementById('yahoo-sports-list'), '見出しの取得に失敗しました', true);
    onStatus?.('yahooSportsNews', 'スポーツニュースの取得に失敗', true);
  }
}
