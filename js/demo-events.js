// レイアウト確認用のサンプル予定。?demo=1 のときだけ読み込まれる。
// Googleカレンダーに接続しなくても、画面の見え方を確かめられるようにするためのもの。

function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateOnly(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function DEMO_EVENTS() {
  return [
    {
      summary: '朝会',
      location: '会議室A',
      start: { dateTime: at(0, 9, 30) },
      end: { dateTime: at(0, 9, 45) },
    },
    {
      summary: '来客 山田製作所 山田様・佐藤様',
      location: '応接室1',
      start: { dateTime: at(0, 10, 30) },
      end: { dateTime: at(0, 11, 30) },
    },
    {
      summary: '人事定例会議',
      location: '会議室B',
      start: { dateTime: at(0, 13, 0) },
      end: { dateTime: at(0, 14, 0) },
    },
    {
      summary: '外出 取引先訪問（エンジニア職 中途採用面接）',
      location: '先方オフィス',
      start: { dateTime: at(0, 15, 0) },
      end: { dateTime: at(0, 16, 0) },
    },
    {
      summary: '役員会',
      location: '大会議室',
      start: { dateTime: at(0, 16, 30) },
      end: { dateTime: at(0, 18, 0) },
    },
    {
      summary: '健康診断の運用確認',
      location: '',
      start: { dateTime: at(1, 11, 0) },
      end: { dateTime: at(1, 12, 0) },
    },
    {
      summary: '来客 ソフトウェア商談',
      location: '応接室2',
      start: { dateTime: at(1, 14, 0) },
      end: { dateTime: at(1, 15, 0) },
    },
    {
      summary: '全社朝礼',
      location: '',
      start: { dateTime: at(2, 9, 0) },
      end: { dateTime: at(2, 9, 30) },
    },
    {
      // タイトルに来客・外出のキーワードは無いが、駅すぱあと連携で
      // 自動生成された移動予定として来客・外出扱いになる例。
      summary: '大阪支社',
      description: '新大阪 → 大阪支社\n\nPowered by 駅すぱあと',
      location: '',
      start: { dateTime: at(2, 13, 0) },
      end: { dateTime: at(2, 13, 40) },
    },
    {
      summary: '外出 銀行訪問',
      location: '',
      start: { dateTime: at(3, 10, 0) },
      end: { dateTime: at(3, 11, 0) },
    },
    {
      summary: '夏季休暇',
      start: { date: dateOnly(5) },
      end: { date: dateOnly(6) },
    },
    {
      summary: '労務相談',
      location: '会議室A',
      start: { dateTime: at(6, 13, 30) },
      end: { dateTime: at(6, 14, 30) },
    },
  ];
}

// Google Tasksのサンプル。実際のAPIレスポンス（items配列の要素）に近い形にしている。
export function DEMO_TASKS() {
  return [
    {
      id: 'demo-1',
      title: '見積書の確認・返信',
      notes: '山田製作所分',
      due: dateOnly(0) + 'T00:00:00.000Z',
      status: 'needsAction',
    },
    {
      id: 'demo-1b',
      title: '経費精算（今月分）',
      due: dateOnly(0) + 'T00:00:00.000Z',
      status: 'needsAction',
    },
    {
      id: 'demo-2',
      // 今日締切ではないので、今日ぶんだけの表示には出てこない例。
      title: '来週の出張手配',
      due: dateOnly(2) + 'T00:00:00.000Z',
      status: 'needsAction',
    },
    {
      id: 'demo-3',
      title: '来期の予算資料をまとめる',
      status: 'needsAction',
    },
    {
      id: 'demo-4',
      title: '（完了済みなので出ない）名刺発注',
      due: dateOnly(-1) + 'T00:00:00.000Z',
      status: 'completed',
    },
  ];
}

// 定時ニュースダイジェスト欄のサンプル。実際はGmail検索結果（js/news.js）を使う。
export function DEMO_NEWS() {
  return [
    { id: 'demo-news-1', label: '08/07 16:16' },
    { id: 'demo-news-2', label: '08/07 12:12' },
    { id: 'demo-news-3', label: '08/07 07:10' },
    { id: 'demo-news-4', label: '08/06 22:08' },
  ];
}
