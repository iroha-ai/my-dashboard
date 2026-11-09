import { CONFIG } from './config.js?v=20261109-elections';
import { fetchJson } from './util.js?v=20261109-elections';

// 参政党 選挙当落モニターの開票中速報（2026-11-09追加）。メイン画面は1画面に収めるため、
// 詳細は elections/ の開票ボードに任せ、ここではライブ中だけヘッダーのステータス欄に
// 「開票LIVE」と参政党の当選数を短く出す。ライブでないときは何も出さない。
export async function updateElectionStatus(onStatus) {
  let data;
  try {
    data = await fetchJson(`${CONFIG.sanseitoElectionsDataUrl}?t=${Date.now()}`);
  } catch (err) {
    // 初回の公開前は data ブランチにファイルが無い。それは失敗ではないので黙っておく。
    if (String(err?.message || '').startsWith('404')) {
      onStatus?.('elections', null, false);
      return;
    }
    throw err;
  }
  if (data?.mode !== 'live') {
    onStatus?.('elections', null, false);
    return;
  }
  const nat = Number(data.resultsTally?.['選挙区']?.['当選'] || 0);
  const prop = Number(data.resultsTally?.['比例']?.['見込み議席'] || 0);
  const local = ['都道府県議', '市区町村議', '首長']
    .reduce((sum, key) => sum + Number(data.tally?.[key]?.['当選'] || 0), 0);
  const parts = [];
  if (nat || prop) parts.push(`国政 選挙区${nat}・比例${prop}`);
  parts.push(`地方の当選記事${local}`);
  const fresh = Number(data.newCount || 0);
  onStatus?.('elections', `開票LIVE 参政党 ${parts.join('／')}${fresh ? `（新着${fresh}）` : ''}`, false);
}
