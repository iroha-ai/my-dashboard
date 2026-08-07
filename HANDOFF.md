# my-dashboard 開発引き継ぎ（Claude Code 向け）

作成日: 2026-08-07
最終更新: 2026-08-07（本番デプロイ・運行情報パネル追加後）

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
| Actions | `相場・運行情報の更新`（5分ごと cron + 手動実行）、`data` ブランチへ orphan 上書き |

ローカルの作業コピーは `C:\Users\youtr\dev\my-dashboard`（このリポジトリの clone）。

## 技術スタック

- ビルドなし。素の HTML / CSS / ES modules
- ホスティング: GitHub Pages（静的）
- 予定: Google Calendar API + フロント OAuth（`js/config.js` の `googleClientId`）
- 天気（上段3地点）: 気象庁防災 JSON + Open-Meteo
- 天気（左サイド週間）: Open-Meteo 7日 + 気象庁週間予報で降水確率補完
- 運行情報（左サイド・週間天気の下）: `tetsudo.rti-giken.jp`（非公式・無料）→ Actions cron → `data` ブランチ
- 相場: GitHub Actions cron（5分・終日）→ `data` ブランチへ orphan 上書き → `raw.githubusercontent.com` から読む

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
│ 中央線   │  これからの一週間              │               │
│ 青梅線   │                                │               │
│ 銀座線   │                                │               │
└──────────┴──────────────────────────────┴───────────────┘
```

**2026-08-07 の変更（レイアウト）:**

- 「会議」欄を廃止した。来客・面談のピックアップのみ残す
- 来客・面談と今日の予定を横並びに変更。今日の予定の欄を広め（`grid-template-columns: 1fr 2.4fr`）にした
- 左サイドバー（昭島市週間天気）の下に「運行情報」（中央線・青梅線・銀座線）を追加

`calendar.js` の `isMeeting` / `excludedEventTypes` 判定は、会議欄を廃止したのに合わせて削除済み。

## ファイル構成

```
my-dashboard/
├── index.html               # 画面骨格
├── css/styles.css           # 暗色テーマ・レイアウト
├── js/
│   ├── config.js            # ★ Hide が編集する設定（OAuth ID、URL 等）
│   ├── main.js              # 起動・定期更新・ステータスバー
│   ├── clock.js             # ヘッダー時計（秒あり）
│   ├── weather.js           # 上段3地点天気 + 左週間天気（昭島）
│   ├── calendar.js          # Google Calendar・来客/面談ピックアップ
│   ├── market.js            # 相場 JSON 読み込み
│   ├── train.js             # 運行情報 JSON 読み込み（新規）
│   ├── demo-events.js       # ?demo=1 用サンプル予定
│   └── util.js
├── data/market.json         # ローカル確認用サンプル（本番は data ブランチ）
├── scripts/
│   ├── fetch-market.mjs     # Actions / 手動実行用相場取得
│   └── fetch-train.mjs      # Actions / 手動実行用運行情報取得（新規）
├── .github/workflows/market.yml  # 「相場・運行情報の更新」ワークフロー
├── README.md                # セットアップ手順
└── HANDOFF.md                # このファイル
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
- [x] 相場6銘柄表示 + 最終更新時刻 + チャートリンク
- [x] 運行情報（中央線・青梅線・銀座線）＋最終更新時刻
- [x] 相場・運行情報取得スクリプト + Actions ワークフロー（data ブランチ orphan 上書き）
- [x] `?demo=1` デモモード
- [x] 取得失敗時のステータス表示（ヘッダー右）
- [x] 本番デプロイ（公開リポジトリ・Pages・OAuth・APIキー）

## 未完了・次にやること（優先順）

### 1. 運行情報APIの実地確認（重要・未検証）

`tetsudo.rti-giken.jp/free/train_all.json` は非公式・スキーマ非公開のAPI。実装時点（2026-08-07）で
サイト自体に疎通できず（Claude Codeのサンドボックス・Hideの実ブラウザどちらからも到達不可）、
実際のレスポンス形式を確認できていない。`scripts/fetch-train.mjs` は一般に知られている想定スキーマ
（`name` / `status` / `pubDate` フィールドを持つ配列）で書いているが未検証。

サイトが復旧し次第、次を確認すること:

1. Actions「相場・運行情報の更新」のログ、または `data` ブランチの `train.json` を見る
2. 中央線・青梅線・銀座線が正しく拾えているか（`ok: true` になっているか）
3. `status` の文言が実際の表記と一致しているか（「平常運転」判定用の `.includes('平常')` が効くか）
4. 表記が違う場合は `scripts/fetch-train.mjs` の `LINES[].match` を調整する

サイトが恒久的に落ちている場合の代替案:

- 東京メトロ（銀座線）は公式Open Data（ODPT, https://developer.odpt.org/ ）に無料登録すれば取れる
- JR東日本（中央線・青梅線）は公式の無料APIが見当たらないため、運行情報ページへのリンク表示に格下げする案も検討

### 2. 日経平均の取得方法（Hideから別途検討の指示あり・未着手）

Twelve Data無料プランは指数（N225）に対応しておらず、現状「未取得」表示になる。代替候補:

| 候補 | メモ |
|------|------|
| Twelve Data 有料プラン | 確実だが月額コストが発生 |
| stooq.com のCSVエンドポイント | 無料・キー不要（`^NKX` 等）。フォーマット確認要 |
| Yahoo Finance 非公式エンドポイント | 無料だが非公式・仕様変更リスクあり |
| 他の指数データ提供元 | 要調査 |

次のセッションで比較検討し、`scripts/fetch-market.mjs` の日経平均取得ロジックを差し替える。

### 3. 実装で残っている論点

| 論点 | メモ |
|------|------|
| カレンダー「タスク」判別 | Calendar API の events にタスクは含まれない見込み。実機確認待ち |
| GitHub スケジュール実行 | 長期非稼働で自動無効化されうる。相場・運行情報の最終更新時刻で気づく設計 |
| Pages CDN | 相場・運行情報は raw 経由で回避済み（600秒キャッシュ問題） |

## データの流れ（確定）

```
[GitHub Actions cron・5分・終日]
   ├→ scripts/fetch-market.mjs（Secrets: TWELVEDATA_API_KEY）→ market.json
   └→ scripts/fetch-train.mjs（キー不要）→ train.json
        └→ 両方まとめて data ブランチへ orphan 上書き

[モニター PC ブラウザ]
   ├→ 画面: GitHub Pages
   ├→ 相場: raw.githubusercontent.com/.../data/market.json
   ├→ 運行情報: raw.githubusercontent.com/.../data/train.json
   ├→ 天気: 気象庁 + Open-Meteo（30分）
   └→ 予定: Google Calendar API（5分・リポジトリ非経由）
```

## 相場取得の中身（fetch-market.mjs）

| 銘柄 | 取得先 | キー |
|------|--------|------|
| XRP, XLM | CoinGecko | 不要 |
| 金, 銀 | gold-api.com | 不要 |
| ドル円 | Twelve Data → 無ければ Frankfurter 前日終値 | 任意 |
| 日経平均 | Twelve Data | **必須**（無料プランでは未対応、上記「未完了」参照） |

## 運行情報取得の中身（fetch-train.mjs）

| 路線 | 一致条件 |
|------|---------|
| 中央線 | `name` に「中央線」を含み「総武」を含まない |
| 青梅線 | `name` に「青梅線」を含む |
| 銀座線 | `name` に「銀座線」を含む |

対象路線が見つからない場合は「平常運転」と決めつけず `ok: false` にする（README「気をつけていること」参照）。

## Claude Code への指示例

引き継ぎセッション開始時に、次を読んでから作業すること:

1. このファイル（`HANDOFF.md`）
2. `README.md`
3. `js/config.js`

作業例:

- 「運行情報APIが復旧したか確認して、スキーマを実データに合わせて直して」
- 「日経平均の代替取得方法を比較して、実装して」
- 「週間天気の天気ラベルを気象庁の週間 weatherCode に合わせて改善して」
- 「来客・面談と今日の予定の横幅比率を変えて」（Hide の指示があれば）

## 注意（公開リポジトリ）

- **予定の中身はリポジトリにコミットしない**（ブラウザ OAuth のみ）
- cron がコミットするのは `market.json` と `train.json` のみ
- API キーは Secrets のみ

---

*このファイルは Claude Code が更新している。作業内容を変えたら、このファイルも合わせて更新すること。*
