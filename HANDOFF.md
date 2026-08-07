# my-dashboard 開発引き継ぎ（Claude Code 向け）

作成日: 2026-08-07
最終更新: 2026-08-07（運行情報をライブ検知に復活・リンク色分けを追加）

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
| GitHub Actions | `運行情報の更新`（5分ごと cron + 手動実行）、`data` ブランチへ orphan 上書き。相場用cronは撤去済み |
| GitHub Secrets | **無し。**（`TWELVEDATA_API_KEY` は不要になり削除済み。運行情報の取得元もキー不要） |

ローカルの作業コピーは `C:\Users\youtr\dev\my-dashboard`（このリポジトリの clone）。

## 技術スタック

- ビルドなし。素の HTML / CSS / ES modules
- ホスティング: GitHub Pages（静的）
- 予定: Google Calendar API + フロント OAuth（`js/config.js` の `googleClientId`）
- タスク（来客・外出の右隣）: Google Tasks API（`@default`リストの、今日が期限のものだけ）。予定と同じトークンを使い回す
- 天気（上段3地点）: 気象庁防災 JSON + Open-Meteo
- 天気（左サイド週間・昭島/鹿沼の2地点）: Open-Meteo 7日 + 気象庁週間予報で降水確率補完
- 運行情報（左サイド・週間天気の下）: リンクは公式ページへの直リンク。GitHub Actionsが
  5分ごとに「平常運転かどうか」だけ取得し、異常があるときだけリンクの色を変える
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
│（リンク  │  これからの一週間              │               │
│ ＋色分け）│                                │               │
└──────────┴──────────────────────────────┴───────────────┘
```

来客・外出／タスクは**今日ぶんだけ**表示する（一週間分は「これからの一週間」欄で見られる）。

## 運行情報をライブ検知に復活（2026-08-07）

**きっかけ:** Hideから「事故情報はプッシュ型で欲しい。アラートを受信したら、当該路線の
リンクの色を変えるだけでもいい。事故があったとわかればリンクを押して確認しにいけばいい」
との要望。

**それまでの状態:** `tetsudo.rti-giken.jp`（非公式API）が疎通不可だったため、静的リンクの
みにしていた（下記「静的リンクにしていた経緯（過去の記録）」参照）。

**新しく見つけたデータ源（公式サイトが自分自身の表示に使っている内部データ）:**

- **中央線・青梅線（JR東日本）:** `https://traininfo.jreast.co.jp/train_info/kanto.aspx`
  のHTMLを解析する。`<span class="traininfo-routes__name">中央線快速電車</span>` の直後に
  `<p class="traininfo-routes__status normal または delay 等"><span>状態文言</span></p>`
  という規則的な構造がある。`normal` クラスなら平常運転、それ以外なら何かしら異常。
- **銀座線（東京メトロ）:** `https://www.tokyometro.jp/library/common/operation/status.json`
  （JSONP、`operate_status_cb_func(...)` でラップされている）。トップページの運行状況表示が
  内部で読んでいるものと同じ。`jp.lines[].name_alpha === 'ginza'` の
  `status_icon`（`"heijou"` なら平常）と `status_info` を見る。

どちらも、この実装時点（2026-08-07）で実際に発生していた東京駅での人身事故による
遅延（中央線快速・中央本線・青梅線）を正しく検知できることを確認済み。

**⚠️ 重要（利用規約）:** JR東日本の運行情報ページ末尾には
「このページの情報を無断転載、複写または電磁媒体等に加工することを禁じます。」との
記載がある。Hideに提示のうえ、**個人利用・非公開的な用途（社内モニター表示、平常/異常の
色分けだけを抽出、詳しい文言は表示しない）の範囲と割り切って実装している**（2026-08-07、
了承済み）。もし問題を指摘された場合は、`js/main.js` から `updateTrain` の呼び出しを外せば
即座にライブ検知を止め、静的リンクのみの表示に戻せる（`.github/workflows/train.yml` も
無効化すること）。

**実装:**

- `scripts/fetch-train.mjs`: 上記2つのデータ源を取得し、`{id, label, ok, isNormal, status}`
  の配列を `train.json` として出力。1つの路線の取得に失敗しても他を巻き添えにしない
- `.github/workflows/train.yml`: 5分ごとのcronで実行し、`data` ブランチへ orphan 上書き
  （`market.yml` と同じパターン。ただし今は運行情報専用のワークフロー）
- `js/train.js`: `train.json` を読み、`.train-link[data-line="chuo|ome|ginza"]` の
  クラスを `is-normal` / `is-trouble` に切り替えるだけ。**詳しい文言は画面に出さない**
  （Hideの要望どおり、色だけ）
- 取得できなかった・データが古い（20分以上更新なし）ときは、**色を変えずそのまま**にする
  （「取れない＝平常運転」と決めつけない、という既存の設計方針を踏襲）

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

## 静的リンクにしていた経緯（過去の記録）

`tetsudo.rti-giken.jp/free/train_all.json`（非公式・無料の鉄道運行情報API）でライブ取得する
実装を最初に作ったが、実装時点（2026-08-07）で、次の**3つの独立したネットワークすべて**から
このAPIに疎通できなかった:

1. Claude Code の作業サンドボックス（`curl` がタイムアウト）
2. Hide の実際のブラウザ（Chrome、ページ自体がエラー表示）
3. GitHub Actions のランナー（`fetch failed`）

3経路とも同じ結果だったため、サービス自体が停止・終了している可能性が高いと判断し、
いったんライブ取得の実装を撤回し静的リンクのみにした。その後、同日中にHideから
「アラートが欲しい」との要望があり、JR東日本・東京メトロ自身の内部データを直接読む
方式（上記「運行情報をライブ検知に復活」）で再実装した。`tetsudo.rti-giken.jp`は
結局使っていない。

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
├── index.html                    # 画面骨格。運行情報リンク・相場ウィジェットもここに直書き
├── css/styles.css                # 暗色テーマ・レイアウト
├── js/
│   ├── config.js                 # ★ Hide が編集する設定（OAuth ID、trainDataUrl 等）
│   ├── main.js                    # 起動・定期更新・ステータスバー
│   ├── clock.js                   # ヘッダー時計（秒あり。ローカルタイムゾーン依存、README参照）
│   ├── weather.js                 # 上段3地点天気 + 左週間天気（昭島・鹿沼）
│   ├── calendar.js                # Google Calendar・来客/外出ピックアップ・トークン管理
│   ├── tasks.js                   # Google Tasks 読み込み（calendar.jsのトークンを流用）
│   ├── train.js                   # 運行情報：リンクの色分けだけ行う
│   ├── demo-events.js             # ?demo=1 用サンプル予定・タスク
│   └── util.js
├── scripts/fetch-train.mjs       # Actions / 手動実行用の運行情報取得
├── .github/workflows/train.yml   # 「運行情報の更新」ワークフロー（5分ごと）
├── README.md                      # セットアップ手順
└── HANDOFF.md                      # このファイル
```

相場のcron関連（`scripts/fetch-market.mjs`、`js/market.js`、`data/`、
`.github/workflows/market.yml`）は2026-08-07に削除済み（TradingViewウィジェット化にともなう）。

## ローカルで動かす

```bash
cd my-dashboard
node scripts/fetch-train.mjs   # 動作確認したいとき（標準出力にJSONが出る）
python3 -m http.server 8000
```

- **デモ（認証不要）:** `http://localhost:8000/?demo=1`（天気・相場ウィジェット・運行情報は本物、予定・タスクはサンプル）
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
- [x] 運行情報（中央線・青梅線・銀座線）：リンク＋5分ごとの色分け
- [x] `?demo=1` デモモード
- [x] 取得失敗時のステータス表示（ヘッダー右）
- [x] 本番デプロイ（公開リポジトリ・Pages・OAuth）

## 未完了・次にやること（優先順）

### 1. Googleサインインが毎回必要（優先度中・原因未調査）

上記「Googleサインインが『毎回クリックが必要』な件」を参照。実害は小さい
（電源を入れ直した時に一回押すだけ）が、要件定義の「常時表示で放置」からは
少しずれている。時間があるときに原因を調べる。

### 2. 中央線・青梅線（JR東日本）はライブ検知できていない（現状把握・保留）

`traininfo.jreast.co.jp` は **Akamai（Bot対策）によるIPブロック**で、GitHub Actionsの
ランナーからのアクセスがHTTP 403で弾かれる（`server: AkamaiGHost` ヘッダーで確認済み、
2026-08-07）。ローカル環境やブラウザからは通るが、GitHub Actions特有の問題。

UA偽装等でのさらなる回避は行わない方針（Bot検知の迂回に当たるため）。`fetch-train.mjs`は
「取得できない＝色を変えない」設計なので実害は無いが、**中央線・青梅線のリンクは常に
無色のまま**（銀座線だけライブで色が付く）。Hideに選択肢を提示し、「今のままでよい」と
判断済み（2026-08-07）。

代替案として **駅すぱあとAPI**（`https://docs.ekispert.com/v1/api/operationLine/service/rescuenow/information.html`、
レスキューナウ提供の鉄道運行情報、JR・メトロ含め横断的にカバー）を調査した。無料
トライアル制度があるが、申請フォーム経由の審査が必要で即座には使えないため保留。
やる気が出たら:

1. `https://api-info.ekispert.com/form/trial/` から無料トライアルを申請（Hideの操作が必要）
2. APIキーを取得したら `GET /v1/json/operationLine/service/rescuenow/information?key=...` で
   路線ごとの運行情報が取れる（`status`属性で平常/異常を判定）
3. `scripts/fetch-train.mjs` を駅すぱあとAPI呼び出しに差し替える（中央線・青梅線・銀座線を
   まとめて1つのAPIから取れる可能性が高く、東京メトロ側の個別実装も統合できるかもしれない）
4. APIキーは `EKISPERT_API_KEY` のようなGitHub Secretsに置く

`scripts/fetch-train.mjs`には`DEBUG_TRAIN`環境変数でレスポンスヘッダー・本文を
ログ出力するデバッグコードを残してある（`.github/workflows/train.yml`のenv:に
`DEBUG_TRAIN: '1'`を足せば有効化できる）。

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

- 「運行情報のパースが壊れてないか確認して」
- 「週間天気の天気ラベルを気象庁の週間 weatherCode に合わせて改善して」
- 「時計を確実に日本時間にして」
- 「相場ウィジェットに別の銘柄を追加して」（Hide の指示があれば）

## 注意（公開リポジトリ）

- **予定・タスクの中身はリポジトリにコミットしない**（ブラウザ OAuth のみ）
- cron がコミットするのは `train.json`（平常/異常の色分け情報のみ、路線名と状態のみ）
- APIキー・Secretsは現状不要

---

*このファイルは Claude Code が更新している。作業内容を変えたら、このファイルも合わせて更新すること。*
