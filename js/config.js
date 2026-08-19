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
  // 銀座線（train.json・train.ymlが5分おきcronで直接取得）と
  // 中央線・青梅線（train-mail.json・train-mail.ymlがジョルダンのメール検知から
  // 反映。2026-08-08〜）でファイルが分かれている。js/train.js が両方読んで合成する。
  trainDataUrl:
    'https://raw.githubusercontent.com/iroha-ai/my-dashboard/data/train.json',
  trainMailDataUrl:
    'https://raw.githubusercontent.com/iroha-ai/my-dashboard/data/train-mail.json',

  // Yahoo!ニュース見出しJSONの取得先。train.jsonと同じ data ブランチ・raw経由
  // （Yahoo側のRSSにCORSが無くブラウザから直接fetchできないため、
  // scripts/fetch-yahoo-sports-news.mjs がGitHub Actionsで定期取得して書く。
  // 2026-08-20、Hideの依頼で「定時ニュース」欄の右側に追加）。
  yahooSportsNewsDataUrl:
    'https://raw.githubusercontent.com/iroha-ai/my-dashboard/data/yahoo-sports-news.json',

  // 天気を出す3地点。
  // forecastArea は気象庁の予報区、warningArea は市区町村の警報・注意報コード。
  cities: [
    {
      name: '昭島',
      lat: 35.7056,
      lon: 139.3536,
      radarUrl: 'https://weather.yahoo.co.jp/weather/zoomradar/?lat=35.7056&lon=139.3536&z=12',
      prefecture: '130000',
      forecastArea: '130010',
      warningArea: '1320700',
    },
    {
      name: '台東',
      lat: 35.7126,
      lon: 139.7800,
      radarUrl: 'https://weather.yahoo.co.jp/weather/zoomradar/?lat=35.7126&lon=139.7800&z=12',
      prefecture: '130000',
      forecastArea: '130010',
      warningArea: '1310600',
    },
    {
      name: '鹿沼',
      lat: 36.5670,
      lon: 139.7450,
      radarUrl: 'https://weather.yahoo.co.jp/weather/zoomradar/?lat=36.5670&lon=139.7450&z=12',
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
    yahooSportsNews: 20 * 60 * 1000,
  },

  // 来客・外出として拾うタイトルのキーワード（部分一致）。
  visitorKeywords: ['来客', '外出'],

  // 来客・外出として拾う、説明欄（description）のマーカー文字列（部分一致）。
  // 駅すぱあと（経路検索）連携などで自動生成された予定は、タイトルに
  // 来客・外出のキーワードが入っていないことがあるため、こちらでも拾う。
  // じょるだん（乗換案内）経由の予定も同様に、説明欄末尾のリンクで判定する（2026-08-09追加）。
  visitorDescriptionMarkers: ['Powered by 駅すぱあと', 'jorudan.jp'],

  // 移動として拾うタイトルのキーワード（部分一致）。来客・外出とは別枠で紫色にする。
  transitKeywords: ['移動'],

  // Google Tasksが期限つきでカレンダー側にも疑似イベントとして出てくるものを見分けるマーカー
  // （説明欄にGoogleが自動で入れる定型文。eventType: "FOCUS_TIME" で出てくる）。
  // 「今日の予定」「これからの一週間」欄で、タスク由来の項目を緑色にするために使う（2026-08-09追加）。
  taskDescriptionMarkers: ['tasks.google.com/task/'],

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
