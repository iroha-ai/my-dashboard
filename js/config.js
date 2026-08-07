// 設定はこのファイルだけを書き換えれば済むようにまとめている。
//
// 相場（ドル円・日経平均・XRP・XLM・金・銀）はここには無い。
// TradingViewウィジェット（embed-widget-single-quote.js）として
// index.html に直書きしている（realtime-chartsと同じシンボル・同じ仕組み）。
// 銘柄を増減・変更したいときは index.html の `.market-widgets` を編集する。

export const CONFIG = {
  // Google Cloud コンソールで作成した OAuth 2.0 クライアントID（ウェブアプリケーション）。
  // 承認済みの JavaScript 生成元に、このダッシュボードのURLを登録しておくこと。
  googleClientId:
    '780678067574-3764pdfn1ur3s8d53un3c4d542bj9ihq.apps.googleusercontent.com',

  // 読みたいカレンダー。'primary' は自分のメインカレンダー。
  calendarIds: ['primary'],

  // 運行情報JSONの取得先。data ブランチ・raw経由（相場JSONと同じ考え方）。
  // 内容は各路線の「平常運転かどうか」だけ。リンク自体は index.html に直書き。
  trainDataUrl:
    'https://raw.githubusercontent.com/iroha-ai/my-dashboard/data/train.json',

  // 天気を出す3地点。
  // forecastArea は気象庁の予報区、warningArea は市区町村の警報・注意報コード。
  cities: [
    {
      name: '昭島',
      lat: 35.7056,
      lon: 139.3536,
      prefecture: '130000',
      forecastArea: '130010',
      warningArea: '1320700',
    },
    {
      name: '台東',
      lat: 35.7126,
      lon: 139.7800,
      prefecture: '130000',
      forecastArea: '130010',
      warningArea: '1310600',
    },
    {
      name: '鹿沼',
      lat: 36.5670,
      lon: 139.7450,
      prefecture: '090000',
      forecastArea: '090010',
      warningArea: '0920500',
    },
  ],

  // 更新間隔（ミリ秒）。相場（TradingViewウィジェット）はウィジェット自身が
  // リアルタイム更新するので、ここには含まれない。
  intervals: {
    calendar: 5 * 60 * 1000,
    weather: 30 * 60 * 1000,
    train: 5 * 60 * 1000,
  },

  // 来客・外出として拾うタイトルのキーワード（部分一致）。
  visitorKeywords: ['来客', '外出'],

  // 来客・外出として拾う、説明欄（description）のマーカー文字列（部分一致）。
  // 駅すぱあと（経路検索）連携などで自動生成された予定は、タイトルに
  // 来客・外出のキーワードが入っていないことがあるため、こちらでも拾う。
  visitorDescriptionMarkers: ['Powered by 駅すぱあと'],

  // 一週間の予定を何日先まで出すか。
  weekDays: 7,

  // 左サイドバーに出す週間天気の地点（上から順に表示）。
  // domId は index.html 側の要素ID（`${domId}-alerts` / `${domId}-weekly-list`）と対応させる。
  weeklyWeatherCities: [
    {
      domId: 'akishima',
      name: '昭島市',
      lat: 35.7056,
      lon: 139.3536,
      prefecture: '130000',
      forecastArea: '130010',
      warningArea: '1320700',
      days: 7,
    },
    {
      domId: 'kanuma',
      name: '鹿沼市',
      lat: 36.5670,
      lon: 139.7450,
      prefecture: '090000',
      forecastArea: '090010',
      warningArea: '0920500',
      days: 7,
    },
  ],
};
