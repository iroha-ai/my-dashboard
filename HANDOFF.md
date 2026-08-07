# my-dashboard 開発引き継ぎ（Claude Code 向け）

作成日: 2026-08-07
最終更新: 2026-08-07（相場をTradingViewウィジェットに一本化・cron撤去後）

## これは何か

Hide 個人用の常時表示ダッシュボード。会社モニターに GitHub Pages で公開し、予定・タスク・天気・運行情報・相場・時計を暗い背景の1画面に集約する。

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
| 有効化済みAPI | Google Calendar API、Google Tasks API |
| OAuth クライアント | 発行済み（`js/config.js` の `googleClientId`）。テストユーザーに Hide のアカウント登録済み |
| OAuthスコープ | `calendar.readonly` + `tasks.readonly` |
| GitHub Actions | **無し。** 相場のcronは撤去済み（下記「相場をTradingViewウィジェットに一本化」参照） |
| GitHub Secrets | **無し。** `TWELVEDATA_API_KEY` は不要になったため削除済み |

ローカルの作業コピーは `C:\Users\youtr\dev\my-dashboard`（このリポジトリの clone）。

## 技術スタック

- ビルドなし。素の HTML / CSS / ES modules。GitHub Actionsもcronも一切無い（完全に静的）
- ホスティング: GitHub Pages（静的）
- 予定: Google Calendar API + フロント OAuth（`js/config.js` の `googleClientId`）
- タスク（来客・外出の右隣）: Google Tasks API（`@default`リストの、今日が期限のものだけ）。予定と同じトークンを使い回す
- 天気（上段3地点）: 気象庁防災 JSON + Open-Meteo
- 天気（左サイド週間・昭島/鹿沼の2地点）: Open-Meteo 7日 + 気象庁週間予報で降水確率補完
- 運行情報（左サイド・週間天気の下）: **ライブ取得なし。** JR東日本・東京メトロの公式ページへの直接リンク
- 相場（ドル円・日経平均・XRP・XLM・金・銀の全6銘柄）: **TradingViewウィジェット埋め込み**
  （`embed-widget-single-quote.js`）。`index.html` に直書き、`realtime-charts` と同じ仕組み

## 現在のレイアウト（2026-08-07 時点）

```
┌─────────────────────────────────────────────────────────┐
│ 時計（時・分・秒＋日付・曜日）              取得状況     │
├──────────┬──────┬──────┬────────────────┬───────────────┤
│ 昭島市   │  天気：昭島｜台東｜鹿沼                       │
│ 週間天気 ├──────┬──────┬────────────────┤  相場         │
│ 鹿沼市   │来客・│タスク│ 今日の予定（広め） │ （widget×6）  │
│ 週間天気 │外出  │      │                  │               │
│ 運行情報 ├──────┴──────┴────────────────┤  チャートへ   │
│（リンク）│  これからの一週間              │               │
└──────────┴──────────────────────────────┴───────────────┘
```

来客・外出／タスクは**今日ぶんだけ**表示する（一週間分は「これからの一週間」欄で見られる）。

## 相場をTradingViewウィジェットに一本化（2026-08-07）

**きっかけ:** Hideから「相場の元データ、日経平均のデータと同じところから参照してほしい」との指示。

**変更前の構成（撤去済み）:**

- GitHub Actions cron（5分ごと）が `scripts/fetch-market.mjs` を実行
  - ドル円: Twelve Data（要APIキー）→ 無ければ Frankfurter 前日終値
  - XRP・XLM: CoinGecko（キー不要）
  - 金・銀: gold-api.com（キー不要）
  - 日経平均: 元々 Twelve Data 対応外で「未取得」表示 → 後に個別でTradingViewウィジェット化
- 取得結果を `data` ブランチへ orphan コミットで上書き
- フロントは `raw.githubusercontent.com/.../data/market.json` を5分ごとに読む

**変更後の構成:**

- 6銘柄すべて `index.html` に直書きしたTradingViewウィジェット（`embed-widget-single-quote.js`）
- ウィジェット自身がリアルタイム更新するため、取得処理・cron・鮮度チェックが一切不要に
- `realtime-charts`（`https://iroha-ai.github.io/realtime-charts/`）と同じシンボルを使用

**削除したもの:** `js/market.js`、`scripts/fetch-market.mjs`、`data/market.json`、
`.github/workflows/market.yml`、GitHub Secrets の `TWELVEDATA_API_KEY`。
`config.js` から `marketDataUrl` / `chartUrl` / `intervals.market` を削除。

**トレードオフ:** TradingViewウィジェットは要インターネット接続で、読み込み失敗時も
画面右上のステータス表示の対象外（気づきにくい）。以前の `market.json` 方式にあった
「取得失敗を明示・最終更新時刻の鮮度チェック」は無くなった。ただし、そもそも旧方式も
GitHub Actionsのcron間隔がGitHub側で保証されず、頻繁に「相場データが更新されていません」
警告が出て運用上の摩擦になっていたため、トータルではシンプルさを優先した判断。

## Googleサインインが「毎回クリックが必要」な件（2026-08-07 判明）

理屈のうえでは、一度「接続する」で許可すれば、以後はページを開き直しても
サイレント（無言）で自動再ログインするはず（`calendar.js`の`getAccessToken()`が
`prompt: ''`で毎回サイレント取得を試みる設計）。

しかし実機（Hideの実ブラウザ）で確認したところ、**Hideが一度同意を済ませたあとも、
ページをリロードするとサイレント取得は毎回失敗し、「カレンダーに接続できていません」
に戻ってしまう**ことを確認した。原因は未調査だが、サードパーティCookie制限など、
バックエンドを持たない静的サイト＋GISトークンモデルにありがちな制約が疑われる。

現状は「モニターの電源を入れ直したときだけ、一度だけ手で押す」という運用で
割り切っている（README「準備」参照）。もし原因を突き止めて解消できれば、
本来の「常時表示で放置できる」という要件定義の意図に近づく。調べる場合は:

- ブラウザのサードパーティCookie設定（`accounts.google.com`関連）を確認する
- GISの「FedCM」対応状況（2026年時点でのGoogle側の移行状況）を確認する
- 可能なら、軽量なバックエンド（Cloudflare WorkersなどでリフレッシュトークンをKVに
  保持する等）に置き換える案も選択肢として検討する（要件定義書の「追加インフラを
  持たない」方針からは外れるため、Hideへの確認が必要）

## タスク連携（2026-08-07 追加）

Google Tasksの`@default`リストから、**今日が期限のものだけ**を来客・外出の右隣に表示する。

- Google Cloud側で **Google Tasks API** を有効化済み（`js/config.js`と同じ`my-dashboard`プロジェクト）
- OAuthスコープに`tasks.readonly`を追加（既存の`calendar.readonly`との併記）
- トークンはカレンダーと共通（`calendar.js`が取得したものを`tasks.js`の`updateTasks(token, ...)`に渡す）。
  Tasks用に別途サインインフローは持たない
- `js/tasks.js`が取得・描画を担当。`js/calendar.js`からトークン取得後に呼ばれる
- 表示スタイルは来客・外出と同じ`.pickup-item`を流用（`is-task`修飾子、枠線の色だけ変えている）

**ハマった点（2026-08-07）:** Tasks API有効化のクリックが最初は実際には反映されておらず、
`403 Google Tasks API has not been used in project ... or it is disabled` が出続けた。
Cloud Consoleの製品詳細ページに出る青いチェックマークは**有効化状態の表示ではなくTasksの
プロダクトロゴ**で、紛らわしい。有効化できたかどうかは、ボタンが「API を無効にする」に
変わっているか、または「API とサービス」→「有効な API とサービス」の一覧に実際に
出ているかで確認すること（「有効にする」ボタンがまだ表示されている＝未有効）。

## 運行情報がリンク表示になっている経緯

`tetsudo.rti-giken.jp/free/train_all.json`（非公式・無料の鉄道運行情報API）でライブ取得する
実装を最初に作った（`scripts/fetch-train.mjs` + `js/train.js` + Actionsでの`train.json`生成、
いずれも削除済み）。

実装時点（2026-08-07）で、次の**3つの独立したネットワークすべて**からこのAPIに疎通できなかった:

1. Claude Code の作業サンドボックス（`curl` がタイムアウト）
2. Hide の実際のブラウザ（Chrome、ページ自体がエラー表示）
3. GitHub Actions のランナー（`fetch failed`）

3経路とも同じ結果だったため、特定ネットワークのブロックではなく**サービス自体が停止・終了して
いる可能性が高い**と判断し、ライブ取得の実装を撤回した。代わりに `js/config.js` の `trainLinks`
と `index.html` に、JR東日本・東京メトロの公式運行情報ページへの直接リンクを静的に書いている。

もし別の無料APIが見つかった場合、または `tetsudo.rti-giken.jp` が復活しているのを確認できた場合は、
ライブ取得に戻す余地がある。その際は `git log` で当時の実装（コミット `bfd59dd` 付近）を参照できる。

## 相場ウィジェットのシンボル一覧

`index.html` の `.market-widgets` に直書き。銘柄を変えるときはここを編集する（`config.js`には無い）。

| 表示順 | 銘柄 | シンボル |
|------|------|------|
| 1 | ドル円 | `OANDA:USDJPY` |
| 2 | 日経平均 | `OANDA:JP225USD` |
| 3 | XRP/USD | `COINBASE:XRPUSD` |
| 4 | XLM/USD | `COINBASE:XLMUSD` |
| 5 | 金（XAU/USD） | `OANDA:XAUUSD` |
| 6 | 銀（XAG/USD） | `OANDA:XAGUSD` |

## ファイル構成

```
my-dashboard/
├── index.html               # 画面骨格。運行情報リンク・相場ウィジェットもここに直書き
├── css/styles.css           # 暗色テーマ・レイアウト
├── js/
│   ├── config.js            # ★ Hide が編集する設定（OAuth ID、trainLinks 等）
│   ├── main.js               # 起動・定期更新・ステータスバー
│   ├── clock.js              # ヘッダー時計（秒あり。ローカルタイムゾーン依存、README参照）
│   ├── weather.js            # 上段3地点天気 + 左週間天気（昭島・鹿沼）
│   ├── calendar.js           # Google Calendar・来客/外出ピックアップ・トークン管理
│   ├── tasks.js              # Google Tasks 読み込み（calendar.jsのトークンを流用）
│   ├── demo-events.js        # ?demo=1 用サンプル予定・タスク
│   └── util.js
├── README.md                 # セットアップ手順
└── HANDOFF.md                 # このファイル
```

`.github/`・`scripts/`・`data/`・`js/market.js` は2026-08-07に削除済み（相場のcron撤去にともなう）。

## ローカルで動かす

```bash
cd my-dashboard
python3 -m http.server 8000
```

- **デモ（認証不要）:** `http://localhost:8000/?demo=1`（天気・相場ウィジェットは本物、予定・タスクはサンプル）
- **本番同等:** `?demo=1` なし + `config.js` に Google クライアント ID（設定済み）

## 実装済み

- [x] 要件定義書（壁打ち完了）
- [x] 静的ダッシュボード UI（暗背景・モニター視認性）
- [x] 時計（秒＋日付・曜日）
- [x] 上段3地点の今日の天気（気温・予報文・注意報）
- [x] 左サイド：昭島市・鹿沼市 週間天気（7日）
- [x] 来客・外出ピックアップ（今日ぶんだけ、今日の予定と横並び）
- [x] タスク（Google Tasks・今日ぶんだけ）
- [x] 今日の予定（広め）・これからの一週間
- [x] 相場6銘柄（TradingViewウィジェット） + チャートリンク
- [x] 運行情報（中央線・青梅線・銀座線への公式ページリンク）
- [x] `?demo=1` デモモード
- [x] 取得失敗時のステータス表示（ヘッダー右）
- [x] 本番デプロイ（公開リポジトリ・Pages・OAuth）

## 未完了・次にやること（優先順）

### 1. Googleサインインが毎回必要（優先度中・原因未調査）

上記「Googleサインインが『毎回クリックが必要』な件」を参照。実害は小さい
（電源を入れ直した時に一回押すだけ）が、要件定義の「常時表示で放置」からは
少しずれている。時間があるときに原因を調べる。

### 2. 運行情報のライブ化（任意・優先度低）

上記の経緯により静的リンクにしている。ライブ化したい場合は、東京メトロ（銀座線）分だけでも
公式Open Data（[ODPT](https://developer.odpt.org/)、無料登録要）に切り替える案がある。
JR東日本（中央線・青梅線）分は公式の無料APIが見当たらないため、この路線はリンクのままになる
可能性が高い。

### 3. 時計のタイムゾーン（優先度低）

`js/clock.js` はブラウザ／OSのローカル時刻をそのまま使っている。モニターPCのタイムゾーン
設定が日本時間になっていれば結果的に問題ないが、明示的に `Asia/Tokyo` を指定した方が
PC設定に依存せず安全（Hideから「確実にJSTにしたい」という指示があれば対応する）。

## Claude Code への指示例

引き継ぎセッション開始時に、次を読んでから作業すること:

1. このファイル（`HANDOFF.md`）
2. `README.md`
3. `js/config.js`

作業例:

- 「銀座線だけODPTでライブ化して」
- 「週間天気の天気ラベルを気象庁の週間 weatherCode に合わせて改善して」
- 「時計を確実に日本時間にして」
- 「相場ウィジェットに別の銘柄を追加して」（Hide の指示があれば）

## 注意（公開リポジトリ）

- **予定・タスクの中身はリポジトリにコミットしない**（ブラウザ OAuth のみ）
- APIキー・Secretsは現状不要（TradingViewウィジェットもGoogle OAuthもキー不要）

---

*このファイルは Claude Code が更新している。作業内容を変えたら、このファイルも合わせて更新すること。*
