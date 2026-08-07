import { CONFIG } from './config.js';
import { fetchJson } from './util.js';

// 運行情報。詳しい文言は出さず、該当路線のリンクの色を変えるだけにしている
// （Hideの要望: 「アラートを受信したら、リンクの色を変えるだけでいい。
// 異常があるとわかればリンクを押して確認しにいけばいい」2026-08-07）。
const STALE_MS = 20 * 60 * 1000; // cronが5分おきなので、20分以上更新が無ければ止まっていると疑う

function applyState(id, state) {
  const link = document.querySelector(`.train-link[data-line="${id}"]`);
  if (!link) return;
  link.classList.remove('is-normal', 'is-trouble');
  if (state) link.classList.add(state);
}

export async function updateTrain(onStatus) {
  let data;
  try {
    data = await fetchJson(`${CONFIG.trainDataUrl}?t=${Date.now()}`);
  } catch (err) {
    console.error('運行情報の取得に失敗', err);
    // 取得できないときは色を変えない（平常運転だと決めつけない）。
    onStatus?.('train', null, false);
    return;
  }

  const items = data.items || [];
  const updatedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
  const stale = !updatedAt || Date.now() - updatedAt > STALE_MS;

  for (const item of items) {
    if (stale || !item.ok) {
      applyState(item.id, null); // 不明な間はリンクの色を変えない
    } else {
      applyState(item.id, item.isNormal ? 'is-normal' : 'is-trouble');
    }
  }

  if (stale) {
    onStatus?.('train', '運行情報の更新が止まっている可能性', true);
  } else {
    onStatus?.('train', null, false);
  }
}
