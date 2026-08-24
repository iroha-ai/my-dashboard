import { CONFIG } from './config.js?v=20260824-x-notifications-private';
import { fetchJson } from './util.js?v=20260824-x-notifications-private';

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
// 【2026-08-08 変更】当初は「5分おきcronのはずだから20分ノーレスなら止まっている」
// という前提で20分にしていたが、実際にはGitHub Actionsのschedule cronは高頻度設定でも
// GitHub側の都合で大きく間引かれ、train.yml(銀座線)の実測間隔は34〜85分だった
// （GitHub公式ドキュメントにも高負荷時の遅延がある旨の記載あり。特に珍しい話ではない）。
// GAS側のトリガー（中央線・青梅線）も同様に数分〜十数分ずれることがある。
// 20分だとほぼ常時「止まっている」誤検知になっていたため、実測の最悪ケース(85分)に
// 余裕を持たせて90分に緩めた。
const STALE_MS = 90 * 60 * 1000;

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
      // 平常時はデフォルト色（中央線等と同じ青）。異常時だけ is-trouble を付ける。
      applyState(item.id, item.isNormal ? null : 'is-trouble');
    }
  }

  return { ok: true, stale };
}

export async function updateTrain(onStatus) {
  const [trainData, trainMailData] = await Promise.all([
    fetchSource(CONFIG.trainDataUrl),
    fetchSource(CONFIG.trainMailDataUrl),
  ]);

  // 「運行情報の更新が止まっている可能性」のヘッダー表示は行わない
  // （2026-08-08、Hideの指定で非表示に）。ただし鮮度判定そのものは
  // applySource側に残っている——古いデータでリンクの色を変えてしまう
  // ことは引き続き避ける（stale/取得失敗のときは色を変えないだけ）。
  applySource(trainData);
  applySource(trainMailData);
  onStatus?.('train', null, false);
}
