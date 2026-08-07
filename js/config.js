// 設定はこのファイルだけを書き換えれば済むようにまとめている。

export const CONFIG = {
  // Google Cloud コンソールで作成した OAuth 2.0 クライアントID（ウェブアプリケーション）。
  // 承認済みの JavaScript 生成元に、このダッシュボードのURLを登録しておくこと。
  googleClientId: '',

  // 読みたいカレンダー。'primary' は自分のメインカレンダー。
  calendarIds: ['primary'],

  // 相場JSONの取得先。GitHub Pages のキャッシュ（10分）を避けるため raw から読む。
  marketDataUrl:
    'https://raw.githubusercontent.com/iroha-ai/my-dashboard/data/market.json',

  // 相場の詳細を見にいく先。
  chartUrl: 'https://iroha-ai.github.io/realtime-charts/',

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

  // 更新間隔（ミリ秒）。
  intervals: {
    calendar: 5 * 60 * 1000,
    weather: 30 * 60 * 1000,
    market: 5 * 60 * 1000,
  },

  // 来客・面談として拾うタイトルのキーワード。
  visitorKeywords: ['来客', '面談'],

  // 会議として扱わないイベント種別（Google カレンダーの eventType）。
  excludedEventTypes: ['workingLocation', 'outOfOffice', 'focusTime', 'birthday'],

  // 一週間の予定を何日先まで出すか。
  weekDays: 7,

  // 左サイドバーに出す週間天気の地点（昭島市）。
  weeklyWeatherCity: {
    name: '昭島市',
    lat: 35.7056,
    lon: 139.3536,
    prefecture: '130000',
    forecastArea: '130010',
    warningArea: '1320700',
    days: 7,
  },
};
