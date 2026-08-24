import { CONFIG } from './config.js?v=20260825-x-drive-api-fix';
import { clear, el, fetchJson, showMessage } from './util.js?v=20260825-x-drive-api-fix';

// 2026-08-23以降の現行経路。automation-2 が data ブランチへ差し替える
// 見出しJSONを読み、Yahoo!ニュース欄と同じく2行相当の要約を直接表示する。
const NEWS_HEADLINE_MAX_ITEMS = 30;

function formatHeadlineDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

function renderHeadlineStatus(data) {
  const node = document.getElementById('news-digest-status');
  if (!node) return;
  const label = formatHeadlineDate(data?.completedAt || data?.scheduledAt);
  if (!label) {
    node.textContent = '';
    return;
  }
  const count = Number(data?.count || 0);
  node.textContent = data?.status === 'no_news'
    ? `${label}　見出しなし`
    : `${label}　${count}件`;
}

function renderHeadlineList(items) {
  const list = document.getElementById('news-digest-list');
  if (!list) return;
  clear(list);

  if (!items?.length) {
    list.appendChild(el('li', 'placeholder', '現在の掲載見出しはありません'));
    return;
  }

  for (const item of items.slice(0, NEWS_HEADLINE_MAX_ITEMS)) {
    if (!item?.title || !item?.link) continue;
    const li = el('li', 'yahoo-news-item');
    const a = document.createElement('a');
    a.href = item.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = item.unverified
      ? 'yahoo-news-link news-headline-link is-unverified'
      : 'yahoo-news-link news-headline-link';
    const searchKeyword = item.searchKeyword || item.matchedKeyword || item.matched_keyword || '全般';
    const summary = item.summary || item.title;
    const summaryNode = el('span', 'news-summary');
    if (searchKeyword) {
      summaryNode.appendChild(el('span', 'news-search-keyword news-search-keyword--digest', `【${searchKeyword}】`));
    }
    summaryNode.appendChild(document.createTextNode(summary));
    a.appendChild(summaryNode);
    const metadata = [item.source, formatHeadlineDate(item.publishedAt)].filter(Boolean).join(' ・ ');
    if (metadata) a.title = metadata;
    li.appendChild(a);
    list.appendChild(li);
  }
}

export async function updateNewsDigest(onStatus) {
  try {
    const data = await fetchJson(`${CONFIG.newsHeadlinesDataUrl}?t=${Date.now()}`);
    if (!Array.isArray(data?.items)) throw new Error('items が配列ではありません');
    if (Number(data.count) !== data.items.length) {
      throw new Error('count と items.length が一致しません');
    }
    renderHeadlineStatus(data);
    renderHeadlineList(data.items);
    onStatus?.('news', null, false);
  } catch (err) {
    console.error('定時ニュース見出しの取得に失敗', err);
    renderHeadlineStatus(null);
    showMessage(document.getElementById('news-digest-list'), '定時ニュースの取得に失敗しました', true);
    onStatus?.('news', '定時ニュースの取得に失敗', true);
  }
}
