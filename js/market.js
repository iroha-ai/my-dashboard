import { CONFIG } from './config.js';
import { clear, el, fetchJson, pad2, showMessage } from './util.js';

// 取得が止まったことに気づけるよう、この時間を超えたら最終更新を警告色にする。
const STALE_AFTER_MS = 20 * 60 * 1000;

function formatValue(value, decimals) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatClock(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function renderItem(item) {
  const li = el('li', 'market-item');
  li.appendChild(el('div', 'market-name', item.label));

  if (item.ok) {
    li.appendChild(
      el('div', 'market-value', formatValue(item.value, item.decimals ?? 2))
    );
    if (item.note) {
      li.appendChild(el('div', 'market-note', item.note));
    }
  } else {
    li.appendChild(el('div', 'market-value is-missing', '未取得'));
    li.appendChild(el('div', 'market-note', item.reason || '取得できませんでした'));
  }

  return li;
}

export async function updateMarket(onStatus) {
  const list = document.getElementById('market-list');
  const updatedNode = document.getElementById('market-updated');
  const link = document.getElementById('chart-link');
  link.href = CONFIG.chartUrl;

  // ?demo=1 のときは、リポジトリに置いたサンプルを読んで表示だけ確かめる。
  const isDemo = new URLSearchParams(location.search).get('demo') === '1';
  const source = isDemo ? 'data/market.json' : CONFIG.marketDataUrl;

  let data;
  try {
    // raw のキャッシュを跨いで同じ内容を掴み続けないよう、時刻を付けて取りにいく。
    data = await fetchJson(`${source}?t=${Date.now()}`);
  } catch (err) {
    console.error('相場の取得に失敗', err);
    showMessage(list, '相場データを取得できませんでした', true);
    updatedNode.textContent = '—';
    onStatus?.('market', '相場の取得に失敗', true);
    return;
  }

  clear(list);
  for (const item of data.items || []) {
    list.appendChild(renderItem(item));
  }

  const updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
  if (updatedAt && !Number.isNaN(updatedAt.getTime())) {
    const age = Date.now() - updatedAt.getTime();
    const stale = age > STALE_AFTER_MS;
    updatedNode.textContent = `最終更新 ${formatClock(updatedAt)}`;
    updatedNode.classList.toggle('is-stale', stale);
    onStatus?.(
      'market',
      stale ? '相場データが更新されていません' : null,
      stale
    );
  } else {
    updatedNode.textContent = '最終更新 —';
    onStatus?.('market', null, false);
  }
}
