# my-dashboard 開発引き継ぎ（Claude Code 向け）

作成日: 2026-08-07  
最終更新: 2026-08-07（左サイドバー＝昭島市週間天気への変更後）

## これは何か

Hide 個人用の常時表示ダッシュボード。会社モニターに GitHub Pages で公開し、予定・天気・相場・時計を暗い背景の1画面に集約する。

**要件の正本:** `生成物/personal-dashboard/要件定義書.md`  
**実装本体:** このディレクトリ（`生成物/my-dashboard/`）

## リポジトリ・ブランチ

| 項目 | 値 |
|------|-----|
| 親リポジトリ | `iroha-ai/iroha88new` |
| 作業ブランチ | `cursor/personal-dashboard-requirements-7925` |
| PR | #35（ドラフト） |
| 本番用リポジトリ名（未作成） | `my-dashboard`（公開リポジトリ想定） |
| 本番 URL（想定） | `https://iroha-ai.github.io/my-dashboard/` |

**重要:** 実装は vault 内 `生成物/my-dashboard/` にある。別 GitHub リポジトリ `my-dashboard` への切り出し・Pages 有効化は **未実施**。Hide 側の作業として残っている。

## 技術スタック

- ビルドなし。素の HTML / CSS / ES modules
- ホスティング: GitHub Pages（静的）
- 予定: Google Calendar API + フロント OAuth（`js/config.js` の `googleClientId`）
- 天気（上段3地点）: 気象庁防災 JSON + Open-Meteo
- 天気（左サイド週間）: Open-Meteo 7日 + 気象庁週間予報で降水確率補完
- 相場: GitHub Actions cron（5分・終日）→ `data` ブランチへ orphan 上書き → `raw.githubusercontent.com` から読む

## 現在のレイアウト（2026-08-07 時点）

```
┌─────────────────────────────────────────────────────────┐
│ 時計（時・分・秒＋日付・曜日）              取得状況     │
├──────────┬──────────────────────────────┬───────────────┤
│ 昭島市   │  天気：昭島｜台東｜鹿沼                       │
│ 週間天気 ├──────────────────────────────┤  相場         │
│ （7日）  │  来客・面談 ｜ 会議           │  最新価格     │
│          ├──────────────────────────────┤  最終更新     │
│          │  今日の予定                    │  チャートへ   │
│          ├──────────────────────────────┤               │
│          │  これからの一週間              │               │
└──────────┴──────────────────────────────┴───────────────┘
```

**2026-08-07 の変更:** 左サイドバーを「来客・会議」から「昭島市 週間天気」に差し替え。来客・会議は中央上段（3地点天気の下）へ移動。

## ファイル構成

```
生成物/my-dashboard/
├── index.html              # 画面骨格
├── css/styles.css          # 暗色テーマ・レイアウト
├── js/
│   ├── config.js           # ★ Hide が編集する設定（OAuth ID、URL 等）
│   ├── main.js             # 起動・定期更新・ステータスバー
│   ├── clock.js            # ヘッダー時計（秒あり）
│   ├── weather.js          # 上段3地点天気 + 左週間天気（昭島）
│   ├── calendar.js         # Google Calendar・来客/会議ピックアップ
│   ├── market.js           # 相場 JSON 読み込み
│   ├── demo-events.js      # ?demo=1 用サンプル予定
│   └── util.js
├── data/market.json        # ローカル確認用サンプル（本番は data ブランチ）
├── scripts/fetch-market.mjs # Actions / 手動実行用相場取得
├── .github/workflows/market.yml
├── README.md               # セットアップ手順
└── HANDOFF.md              # このファイル
```

## ローカルで動かす

```bash
cd 生成物/my-dashboard
node scripts/fetch-market.mjs > data/market.json   # 任意
python3 -m http.server 8000
```

- **デモ（認証不要）:** `http://localhost:8000/?demo=1`
- **本番同等:** `?demo=1` なし + `config.js` に Google クライアント ID

## 設定（Hide が埋めるもの）

| 項目 | 場所 | 状態 |
|------|------|------|
| `googleClientId` | `js/config.js` | **未設定**（空文字） |
| `TWELVEDATA_API_KEY` | GitHub Secrets | **未設定**（日経平均は「未取得」になる） |
| `marketDataUrl` | `js/config.js` | `iroha-ai/my-dashboard` の raw URL を指す想定 |
| 別リポジトリ作成 + Pages | GitHub | **未実施** |

## 実装済み

- [x] 要件定義書（壁打ち完了）
- [x] 静的ダッシュボード UI（暗背景・モニター視認性）
- [x] 時計（秒＋日付・曜日）
- [x] 上段3地点の今日の天気（気温・予報文・注意報）
- [x] **左サイド：昭島市 週間天気（7日）**
- [x] 来客・面談 / 会議ピックアップ（中央上段）
- [x] 今日の予定・これからの一週間
- [x] 相場6銘柄表示 + 最終更新時刻 + チャートリンク
- [x] 相場取得スクリプト + Actions ワークフロー（data ブランチ orphan 上書き）
- [x] `?demo=1` デモモード
- [x] 取得失敗時のステータス表示（ヘッダー右）

## 未完了・次にやること（優先順）

### 1. 本番デプロイ（Hide 作業が多い）

1. GitHub に `my-dashboard` 公開リポジトリを作成
2. このディレクトリの中身を push
3. Pages を `main` ルートで有効化
4. Google Cloud で OAuth クライアント作成 → `js/config.js` に ID
5. Secrets に `TWELVEDATA_API_KEY` 登録
6. Actions「相場データの更新」を手動実行 → `data` ブランチ確認
7. 会社モニターで常時表示

### 2. 実装で残っている論点

| 論点 | メモ |
|------|------|
| 日経平均 | Twelve Data 無料キー必須。未設定時は「未取得・APIキー未設定」 |
| カレンダー「タスク」判別 | Calendar API の events にタスクは含まれない見込み。実機確認待ち |
| GitHub スケジュール実行 | 長期非稼働で自動無効化されうる。相場の最終更新時刻で気づく設計 |
| Pages CDN | 相場は raw 経由で回避済み（600秒キャッシュ問題） |

### 3. ユーザー要望の余地（未着手）

- レイアウト微調整（来客・会議の位置、週間天気の見せ方）
- 昭島と台東の予報文が同じ（気象庁「東京地方」共通）— README に注記済み

## データの流れ（確定）

```
[GitHub Actions cron・5分・終日]
   └→ scripts/fetch-market.mjs（Secrets: TWELVEDATA_API_KEY）
        └→ data ブランチへ orphan 上書き（market.json のみ）

[モニター PC ブラウザ]
   ├→ 画面: GitHub Pages
   ├→ 相場: raw.githubusercontent.com/.../data/market.json
   ├→ 天気: 気象庁 + Open-Meteo（30分）
   └→ 予定: Google Calendar API（5分・リポジトリ非経由）
```

## 相場取得の中身（fetch-market.mjs）

| 銘柄 | 取得先 | キー |
|------|--------|------|
| XRP, XLM | CoinGecko | 不要 |
| 金, 銀 | gold-api.com | 不要 |
| ドル円 | Twelve Data → 無ければ Frankfurter 前日終値 | 任意 |
| 日経平均 | Twelve Data | **必須** |

## Claude Code への指示例

引き継ぎセッション開始時に、次を読んでから作業すること:

1. このファイル（`HANDOFF.md`）
2. `生成物/personal-dashboard/要件定義書.md`
3. `README.md`
4. `js/config.js`

作業例:

- 「`my-dashboard` リポジトリ用に初期 commit 用スクリプトを書いて」
- 「Google OAuth の接続テスト手順を README に追記して」
- 「週間天気の天気ラベルを気象庁の週間 weatherCode に合わせて改善して」
- 「来客・会議を左に戻す／別配置にする」（Hide の指示があれば）

## 注意（公開リポジトリ）

- **予定の中身はリポジトリにコミットしない**（ブラウザ OAuth のみ）
- cron がコミットするのは `market.json` のみ
- API キーは Secrets のみ

## 関連 PR・コミット

- PR #35: 要件定義 + 実装 + 週間天気変更
- 直近コミット: `c45a38b` 左サイドバーを昭島市の週間天気予報に変更

---

*この引き継ぎノートは Cursor Cloud Agent が作成。Claude Code セッション開始時に最初に読むこと。*
