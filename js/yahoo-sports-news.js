import { CONFIG } from './config.js?v=20260825-x-drive-enable-flow';
import { clear, el, fetchJson, showMessage } from './util.js?v=20260825-x-drive-enable-flow';

// Yahoo!ニュースの2行要約一覧（サッカー）。
// 定時ニュース欄（メールダイジェスト）の右側に表示する
// （2026-08-20、Hideの依頼で追加。index.html の .news-split 参照）。
//
// 取得元のRSSにCORSが無くブラウザから直接fetchできないため、
// scripts/fetch-yahoo-sports-news.mjs がGitHub Actionsで定期取得して
// data ブランチへ書いたJSONを読むだけ（train.jsonと同じ仕組み）。

const MAX_ITEMS = 8;

function findKeyword(keywords, title) {
  return keywords.find((kw) => title.includes(kw)) || '';
}

function getKeywordInfo(title) {
  const marinosKeyword = findKeyword(CONFIG.yahooNewsMarinosKeywords, title);
  if (marinosKeyword) {
    return { keyword: marinosKeyword, className: 'is-purple-highlight' };
  }
  return { keyword: '全般', className: 'is-general-highlight' };
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
    const { keyword, className } = getKeywordInfo(item.title);
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
  try {
    const data = await fetchJson(`${CONFIG.yahooSportsNewsDataUrl}?t=${Date.now()}`);
    renderList('yahoo-sports-list', data.sports);
    onStatus?.('yahooSportsNews', null, false);
  } catch (err) {
    console.error('サッカーニュース見出しの取得に失敗', err);
    showMessage(document.getElementById('yahoo-sports-list'), '見出しの取得に失敗しました', true);
    onStatus?.('yahooSportsNews', 'サッカーニュースの取得に失敗', true);
  }
}
