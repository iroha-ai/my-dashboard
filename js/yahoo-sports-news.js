import { CONFIG } from './config.js?v=20260820-yahoo-sports';
import { clear, el, fetchJson, showMessage } from './util.js?v=20260813-weather-fallback';

// Yahoo!ニュースの見出し一覧（スポーツ総合／モータースポーツ）。
// 定時ニュース欄（メールダイジェスト）の右側に表示する
// （2026-08-20、Hideの依頼で追加。index.html の .news-split 参照）。
//
// 取得元のRSSにCORSが無くブラウザから直接fetchできないため、
// scripts/fetch-yahoo-sports-news.mjs がGitHub Actionsで定期取得して
// data ブランチへ書いたJSONを読むだけ（train.jsonと同じ仕組み）。

const MAX_ITEMS = 8;

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
    a.className = 'yahoo-news-link';
    a.textContent = item.title;
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
