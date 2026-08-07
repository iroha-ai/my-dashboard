# my-dashboard 開発引き継ぎ（Claude Code 向け）

作成日: 2026-08-07
最終更新: 2026-08-07（日経平均をTradingViewウィジェット化・運行情報リンクURL修正後）

## これは何か

Hide 個人用の常時表示ダッシュボード。会社モニターに GitHub Pages で公開し、予定・天気・運行情報・相場・時計を暗い背景の1画面に集約する。

**要件の正本:** vault（PersonalVault）内 `生成物/personal-dashboard/要件定義書.md`
**このリポジトリが本番実装。** vault 内 `生成物/my-dashboard/` は旧作業コピー（このリポジトリの初回コミットの元ネタ）で、以後の更新はここには反映されない。

## リポジトリ・デプロイ状態

| 項目 | 値 |
|------|-----|
| 本番リポジトリ | `iroha-ai/my-dashboard`（公開） |
| ブランチ | `main` |
| 本番 URL | `https://iroha-ai.github.io/my-dashboard/` |
| GitHub Pages | 有効化済み（`main` ルート） |
| Google Cloud プロジェクト | `my-dashboard`（ID: `the-name-504804-c2`） |
| OAuth クライアント | 発行済み（`js/config.js` の `googleClientId`）。テストユーザーに Hide のアカウント登録済み |
| `TWELVEDATA_API_KEY` | GitHub Secrets 登録済み |
| Actions | `相場データの更新`（5分ごと cron + 手動実行）、`data` ブランチへ orphan 上書き |

ローカルの作業コピーは `C:\Users\youtr\dev\my-dashboard`（このリポジトリの clone）。

## 技術スタック

- ビルドなし。素の HTML / CSS / ES modules
- ホスティング: GitHub Pages（静的）
- 予定: Google Calendar API + フロント OAuth（`js/config.js` の `googleClientId`）
- 天気（上段3地点）: 気象庁防災 JSON + Open-Meteo
- 天気（左サイド週間）: Open-Meteo 7日 + 気象庁週間予報で降水確率補完
- 運行情報（左サイド・週間天気の下）: **ライブ取得なし。** JR東日本・東京メトロの公式ページへの直接リンク
- 相場（日経平均以外）: GitHub Actions cron（5分・終日）→ `data` ブランチへ orphan 上書き → `raw.githubusercontent.com` から読む
- 日経平均: TradingViewウィジェット埋め込み（realtime-chartsと同じ仕組み、`market.json` 非経由）

## 現在のレイアウト（2026-08-07 時点）

```
┌─────────────────────────────────────────────────────────┐
│ 時計（時・分・秒＋日付・曜日）              取得状況     │
├──────────┬────────────┬─────────────────┬───────────────┤
│ 昭島市   │  天気：昭島｜台東｜鹿沼                       │
│ 週間天気 ├────────────┬─────────────────┤  相場         │
│ （7日）  │ 来客・面談 │  今日の予定（広め） │  最新価格     │
│          │            │                  │  最終更新     │
│ 運行情報 ├────────────┴─────────────────┤  チャートへ   │
│（リンク）│  これからの一週間              │               │
└──────────┴──────────────────────────────┴───────────────┘
```

**2026-08-07 の変更（レイアウト）:**

- 「会議」欄を廃止した。来客・面談のピックアップのみ残す
- 来客・面談と今日の予定を横並びに変更。今日の予定の欄を広め（`grid-template-columns: 1fr 2.4fr`）にした
- 左サイドバー（昭島市週間天気）の下に「運行情報」（中央線・青梅線・銀座線）を追加。
  当初はライブ取得を実装したが、下記の理由でやめて公式ページへのリンクに切り替えた

`calendar.js` の `isMeeting` / `excludedEventTypes` 判定は、会議欄を廃止したのに合わせて削除済み。

## 運行情報がリンク表示になっている経緯（重要）

`tetsudo.rti-giken.jp/free/train_all.json`（非公式・無料の鉄道運行情報API）でライブ取得する
実装を最初に作った（`scripts/fetch-train.mjs` + `js/train.js` + Actionsでの`train.json`生成）。

実装時点（2026-08-07）で、次の**3つの独立したネットワークすべて**からこのAPIに疎通できなかった:

1. Claude Code の作業サンドボックス（`curl` がタイムアウト）
2. Hide の実際のブラウザ（Chrome、ページ自体がエラー表示）
3. GitHub Actions のランナー（`fetch failed`）

3経路とも同じ結果だったため、特定ネットワークのブロックではなく**サービス自体が停止・終了して
いる可能性が高い**と判断し、ライブ取得の実装を撤回した。関連ファイル（`scripts/fetch-train.mjs`、
`js/train.js`）は削除済み。代わりに `js/config.js` の `trainLinks` と `index.html` に、
JR東日本・東京メトロの公式運行情報ページへの直接リンクを静的に書いている。

もし別の無料APIが見つかった場合、または `tetsudo.rti-giken.jp` が復活しているのを確認できた場合は、
ライブ取得に戻す余地がある。その際は `git log` で当時の実装（コミット `bfd59dd` 付近）を参照できる。

## ファイル構成

```
my-dashboard/
├── index.html               # 画面骨格（運行情報リンクもここに直書き）
├── css/styles.css           # 暗色テーマ・レイアウト
├── js/
│   ├── config.js            # ★ Hide が編集する設定（OAuth ID、URL、trainLinks 等）
│   ├── main.js               # 起動・定期更新・ステータスバー
│   ├── clock.js              # ヘッダー時計（秒あり）
│   ├── weather.js            # 上段3地点天気 + 左週間天気（昭島）
│   ├── calendar.js           # Google Calendar・来客/面談ピックアップ
│   ├── market.js             # 相場 JSON 読み込み
│   ├── demo-events.js        # ?demo=1 用サンプル予定
│   └── util.js
├── data/market.json          # ローカル確認用サンプル（本番は data ブランチ）
├── scripts/fetch-market.mjs  # Actions / 手動実行用相場取得
├── .github/workflows/market.yml  # 「相場データの更新」ワークフロー
├── README.md                 # セットアップ手順
└── HANDOFF.md                 # このファイル
```

## ローカルで動かす

```bash
cd my-dashboard
node scripts/fetch-market.mjs > data/market.json   # 任意
python3 -m http.server 8000
```

- **デモ（認証不要）:** `http://localhost:8000/?demo=1`
- **本番同等:** `?demo=1` なし + `config.js` に Google クライアント ID（設定済み）

## 実装済み

- [x] 要件定義書（壁打ち完了）
- [x] 静的ダッシュボード UI（暗背景・モニター視認性）
- [x] 時計（秒＋日付・曜日）
- [x] 上段3地点の今日の天気（気温・予報文・注意報）
- [x] 左サイド：昭島市 週間天気（7日）
- [x] 来客・面談ピックアップ（今日の予定と横並び）
- [x] 今日の予定（広め）・これからの一週間
- [x] 相場5銘柄表示（`market.json`） + 日経平均（TradingViewウィジェット） + 最終更新時刻 + チャートリンク
- [x] 運行情報（中央線・青梅線・銀座線への公式ページリンク）
- [x] 相場取得スクリプト + Actions ワークフロー（data ブランチ orphan 上書き）
- [x] `?demo=1` デモモード
- [x] 取得失敗時のステータス表示（ヘッダー右）
- [x] 本番デプロイ（公開リポジトリ・Pages・OAuth・APIキー）

## 未完了・次にやること（優先順）

### 1. 日経平均（解決済み・2026-08-07）

Twelve Data無料プランが指数（N225）に未対応だったため、`scripts/fetch-market.mjs` から
日経平均を完全に除外し、代わりに `index.html` の相場パネルへ TradingView ウィジェット
（`embed-widget-single-quote.js`、symbol: `OANDA:JP225USD`）を直接埋め込んだ。
`https://iroha-ai.github.io/realtime-charts/` で使っているのと同じ仕組み。

- キー不要・APIレート制限の心配なし
- 要インターネット接続（他のウィジェット系表示と同条件）
- `market.json` の一部ではないため、取得失敗時のステータス表示（ヘッダー右）の対象外。
  ウィジェット自体が読み込めなかった場合は空白のまま気づきにくい点は残る

### 2. 運行情報のライブ化（任意・優先度低）

上記の経緯により静的リンクにしている。ライブ化したい場合は、東京メトロ（銀座線）分だけでも
公式Open Data（[ODPT](https://developer.odpt.org/)、無料登録要）に切り替える案がある。
JR東日本（中央線・青梅線）分は公式の無料APIが見当たらないため、この路線はリンクのままになる
可能性が高い。

### 3. 実装で残っている論点

| 論点 | メモ |
|------|------|
| カレンダー「タスク」判別 | Calendar API の events にタスクは含まれない見込み。実機確認待ち |
| GitHub スケジュール実行 | 長期非稼働で自動無効化されうる。相場欄の最終更新時刻で気づく設計 |
| Pages CDN | 相場は raw 経由で回避済み（600秒キャッシュ問題） |

## データの流れ（確定）

```
[GitHub Actions cron・5分・終日]
   └→ scripts/fetch-market.mjs（Secrets: TWELVEDATA_API_KEY）
        └→ data ブランチへ orphan 上書き（market.json のみ）

[モニター PC ブラウザ]
   ├→ 画面: GitHub Pages
   ├→ 相場: raw.githubusercontent.com/.../data/market.json
   ├→ 天気: 気象庁 + Open-Meteo（30分）
   ├→ 予定: Google Calendar API（5分・リポジトリ非経由）
   └→ 運行情報: 静的リンク（取得なし）
```

## 相場取得の中身（fetch-market.mjs）

| 銘柄 | 取得先 | キー |
|------|--------|------|
| XRP, XLM | CoinGecko | 不要 |
| 金, 銀 | gold-api.com | 不要 |
| ドル円 | Twelve Data → 無ければ Frankfurter 前日終値 | 任意 |
| 日経平均 | TradingViewウィジェット埋め込み（`fetch-market.mjs` 対象外） | 不要 |

## Claude Code への指示例

引き継ぎセッション開始時に、次を読んでから作業すること:

1. このファイル（`HANDOFF.md`）
2. `README.md`
3. `js/config.js`

作業例:

- 「銀座線だけODPTでライブ化して」
- 「週間天気の天気ラベルを気象庁の週間 weatherCode に合わせて改善して」
- 「来客・面談と今日の予定の横幅比率を変えて」（Hide の指示があれば）

## 注意（公開リポジトリ）

- **予定の中身はリポジトリにコミットしない**（ブラウザ OAuth のみ）
- cron がコミットするのは `market.json` のみ
- API キーは Secrets のみ

---

*このファイルは Claude Code が更新している。作業内容を変えたら、このファイルも合わせて更新すること。*
