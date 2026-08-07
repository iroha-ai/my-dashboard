import { CONFIG } from './config.js';
import { clear, el, fetchJson, showMessage } from './util.js';

const STALE_MS = 20 * 60 * 1000; // cron が5分おきなので、20分以上更新が無ければ止まっていると疑う

function renderLine(item) {
  const state = !item.ok ? 'unknown' : item.isNormal ? 'normal' : 'trouble';
  const row = el('div', `train-line is-${state}`);
  row.appendChild(el('span', 'train-label', item.label));
  row.appendChild(el('span', 'train-status', item.ok ? item.status : item.reason || '取得できず'));
  return row;
}

export async function updateTrain(onStatus) {
  const node = document.getElementById('train-list');
  if (!node) return;

  let data;
  try {
    data = await fetchJson(CONFIG.trainDataUrl);
  } catch (err) {
    console.error('運行情報の取得に失敗', err);
    showMessage(node, '運行情報を取得できませんでした', true);
    onStatus?.('train', '運行情報の取得に失敗', true);
    return;
  }

  const items = data.items || [];
  clear(node);
  for (const item of items) {
    node.appendChild(renderLine(item));
  }

  const updatedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
  const stale = !updatedAt || Date.now() - updatedAt > STALE_MS;
  const missing = items.some((i) => !i.ok);

  if (stale) {
    onStatus?.('train', '運行情報の更新が止まっている可能性', true);
  } else if (missing) {
    onStatus?.('train', '一部路線の運行情報を取得できず', true);
  } else {
    onStatus?.('train', null, false);
  }
}
