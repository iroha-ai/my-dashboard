import { CONFIG } from './config.js';
import { fetchJson } from './util.js';

// 運行情報。詳しい文言は出さず、該当路線のリンクの色を変えるだけにしている
// （Hideの要望: 「アラートを受信したら、リンクの色を変えるだけでいい。
// 異常があるとわかればリンクを押して確認しにいけばいい」2026-08-07）。
//
// データ源が2つに分かれている（2026-08-08〜）:
//   - train.json      : 銀座線。train.ymlが5分おきcronで東京メトロを直接取得
//   - train-mail.json : 中央線・青梅線。GitHub ActionsのランナーがAkamaiに
//                        ブロックされ直接取得できないため、ジョルダンの
//                        運行情報メールをGAS（gas/train-status-watcher.gs）で
//                        監視し、repository_dispatch経由でtrain-mail.ymlが書く。
//                        GAS側は新着メールが無くても5分おきに必ず1回送るので
//                        （ハートビート方式）、updatedAtの鮮度判定はtrain.jsonと
//                        同じロジックで扱える。
const STALE_MS = 20 * 60 * 1000; // 5分おき更新のはずなので、20分以上更新が無ければ止まっていると疑う

function applyState(id, state) {
  const link = document.querySelector(`.train-link[data-line="${id}"]`);
  if (!link) return;
  link.classList.remove('is-normal', 'is-trouble');
  if (state) link.classList.add(state);
}

async function fetchSource(url) {
  try {
    return await fetchJson(`${url}?t=${Date.now()}`);
  } catch (err) {
    console.error('運行情報の取得に失敗', url, err);
    return null;
  }
}

function applySource(data) {
  if (!data) return { ok: false };

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

  return { ok: true, stale };
}

export async function updateTrain(onStatus) {
  const [trainData, trainMailData] = await Promise.all([
    fetchSource(CONFIG.trainDataUrl),
    fetchSource(CONFIG.trainMailDataUrl),
  ]);

  const result = applySource(trainData);
  const mailResult = applySource(trainMailData);

  if (!result.ok && !mailResult.ok) {
    onStatus?.('train', null, false);
    return;
  }

  if (result.stale || mailResult.stale) {
    onStatus?.('train', '運行情報の更新が止まっている可能性', true);
  } else {
    onStatus?.('train', null, false);
  }
}
