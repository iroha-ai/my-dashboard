import { CONFIG } from './config.js?v=20260823-news-two-line-summary';
import { clear, el, fetchJson, showMessage } from './util.js?v=20260823-news-two-line-summary';

// Yahoo!ニュースの要約一覧（スポーツ総合／モータースポーツ）。
// 定時ニュース欄（メールダイジェスト）の右側に表示する
// （2026-08-20、Hideの依頼で追加。index.html の .news-split 参照）。
//
// 取得元のRSSにCORSが無くブラウザから直接fetchできないため、
// scripts/fetch-yahoo-sports-news.mjs がGitHub Actionsで定期取得して
// data ブランチへ書いたJSONを読むだけ（train.jsonと同じ仕組み）。

const MAX_ITEMS = 8;

// 見出しにF1・横浜Fマリノス関連の語が含まれていたら紫字にする
// （2026-08-20、Hideの指定。CONFIG.yahooNewsHighlightKeywords参照）。
function isHighlighted(title) {
  return CONFIG.yahooNewsHighlightKeywords.some((kw) => title.includes(kw));
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
    a.className = isHighlighted(item.title)
      ? 'yahoo-news-link is-highlight'
      : 'yahoo-news-link';
    const summary = item.summary || item.title;
    a.appendChild(el('span', 'news-summary', summary));
    li.appendChild(a);
    list.appendChild(li);
  }
}

export async function updateYahooSportsNews(onStatus) {
  try {
    const data = await fetchJson(`${CONFIG.yahooSportsNewsDataUrl}?t=${Date.now()}`);
    renderList('yahoo-sports-list', data.sports);
    renderList('yahoo-motorsports-list', data.motorsports);
    onStatus?.('yahooSportsNews', null, false);
  } catch (err) {
    console.error('Yahoo!ニュース見出しの取得に失敗', err);
    showMessage(document.getElementById('yahoo-sports-list'), '見出しの取得に失敗しました', true);
    showMessage(document.getElementById('yahoo-motorsports-list'), '見出しの取得に失敗しました', true);
    onStatus?.('yahooSportsNews', 'Yahoo!ニュースの取得に失敗', true);
  }
}
