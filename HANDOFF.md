# my-dashboard 開発引き継ぎ（Claude Code 向け）

作成日: 2026-08-07
最終更新: 2026-08-08（運行情報：中央線・青梅線をジョルダンのメール検知方式に切替）

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
| GitHub Actions | `運行情報の更新`（銀座線・5分ごと cron）＋`運行情報の更新（ジョルダンのメール検知：中央線・青梅線）`（GAS からの repository_dispatch）。どちらも `data` ブランチへ orphan 上書き。相場用cronは撤去済み |
| GitHub Secrets | **無し。**（`TWELVEDATA_API_KEY` は不要になり削除済み。運行情報の取得元もキー不要）。ただし中央線・青梅線用の GitHub PAT は Google Apps Script 側の Script Properties に別途必要（下記「運行情報：中央線・青梅線をジョルダンのメール検知に切替」参照） |

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

## 運行情報：中央線・青梅線をジョルダンのメール検知に切替（2026-08-08）

**きっかけ:** 下記「未完了・次にやること」に保留として残っていた、中央線・青梅線の
Akamaiブロック問題に対して、HideがJorudan方式への切替を明示的に指示。駅すぱあとAPI
（審査待ちで即座には使えない）よりも、以前vault側に計画だけ残っていたジョルダンの
メール検知方式（Gmail監視）を先に採用した。

**構成（銀座線とはデータ源・更新経路が完全に分かれている）:**

- `gas/train-status-watcher.gs`: Google Apps Script。ジョルダンの「運行情報メール」を
  Gmail検索で監視し、件名・本文から路線（中央線・青梅線）と状態（平常/異常）を判定する。
  新着メールの有無に関わらず、**5分おきのトリガー実行のたびに必ず1回**
  `repository_dispatch`（`event_type: train-mail`）を送る「ハートビート方式」。
  最後に確認できた状態は Script Properties（`LAST_STATE`）にキャッシュしていて、
  新着が無い回もキャッシュの中身を送り続ける。これにより `train-mail.json` の
  `updatedAt` が5分おきに更新され続け、フロント側の鮮度判定（20分ルール）を
  train.json と同じロジックのまま使い回せる
- `.github/workflows/train-mail.yml`: `repository_dispatch` を受けて起動し、
  `data` ブランチの `train-mail.json` を上書きする。`train.yml`（銀座線側）が
  同じ `data` ブランチの `train.json` を書くのと衝突しないよう、お互いに
  相手のファイルを引き継いでから orphan コミットを作る実装にしている
  （両方とも `git show data:<相手のファイル>` で読み込んでからツリーに含める）
- `js/config.js`: `trainMailDataUrl`（`train-mail.json` の raw URL）を追加
- `js/train.js`: `train.json`（銀座線）と `train-mail.json`（中央線・青梅線）の
  両方を並行フェッチし、それぞれ独立に鮮度判定してリンクの色を反映する

**⚠️ この切替はコードだけでは動かない。Hide側の手動セットアップが必要
（README.md「4. 運行情報（ジョルダンのメール検知）を設定する」に手順あり）:**

1. ジョルダンの運行情報メールを、中央線（快速）・青梅線の2路線で登録する
2. GitHubのFine-grained PATを発行する（対象リポジトリ限定・Contents: Read and write）
3. `script.google.com` で新規GASプロジェクトを作り、`gas/train-status-watcher.gs`
   の中身を貼り付ける
4. Script Properties に `GITHUB_TOKEN` / `GITHUB_REPO` を設定する
5. `installTrigger` を一度だけ手動実行し、Gmail読み取りを許可する

**⚠️ もう一つ未検証な点:** `gas/train-status-watcher.gs` 内の `SEARCH_QUERY` /
`ROUTE_PATTERNS` / `ALERT_KEYWORDS` / `NORMAL_KEYWORDS` は、ジョルダンの公式ページの
説明文からの推測であり、実際に配信されるメールの件名・本文の実物は未確認。
**最初の実メールが届いた時点で、これらの値を実物に合わせて調整する作業がまだ残っている。**
特に `SEARCH_QUERY` に送信元アドレス（`from:`）を足すと誤検知を減らせる。

**この切替でも解決しない限界:** ジョルダンが「状態が変わったときだけ」メールを送る
（推測）前提なので、「メールが来ない＝平常運転」と「メールが来ない＝ジョルダン側の
配信自体が止まっている／購読が切れている」を区別できない。ハートビートで
`updatedAt` は更新され続けるため見た目上は「動いている」ように見えてしまう点に注意
（GASの実行ログを時々確認するか、実際の運行障害時に正しく反応するか定点観測することを推奨）。

**切り戻し方法:** `js/config.js`の`trainMailDataUrl`を無効にするか、
`js/train.js`から該当ソースの取得を外せば、中央線・青梅線は元の静的リンク表示に戻る。
GAS側のトリガーも `installTrigger` と対になる形で `ScriptApp.getProjectTriggers()`
から手動削除すること。

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
│   ├── config.js                 # ★ Hide が編集する設定（OAuth ID、trainDataUrl / trainMailDataUrl 等）
│   ├── main.js                    # 起動・定期更新・ステータスバー
│   ├── clock.js                   # ヘッダー時計（秒あり。ローカルタイムゾーン依存、README参照）
│   ├── weather.js                 # 上段3地点天気 + 左週間天気（昭島・鹿沼）
│   ├── calendar.js                # Google Calendar・来客/外出ピックアップ・トークン管理
│   ├── tasks.js                   # Google Tasks 読み込み（calendar.jsのトークンを流用）
│   ├── train.js                   # 運行情報：train.json + train-mail.jsonを合成してリンクの色分け
│   ├── demo-events.js             # ?demo=1 用サンプル予定・タスク
│   └── util.js
├── scripts/fetch-train.mjs       # Actions / 手動実行用の運行情報取得（銀座線のみ）
├── gas/train-status-watcher.gs   # ジョルダンのメール監視（中央線・青梅線）。GAS本体は
│                                  # script.google.comに手動で貼り付ける控え（このリポジトリからは実行されない）
├── .github/workflows/
│   ├── train.yml                 # 「運行情報の更新」（銀座線・5分ごとcron）
│   └── train-mail.yml            # 「運行情報の更新（ジョルダンのメール検知）」（中央線・青梅線・GASからのdispatch）
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
- [x] 運行情報：銀座線はリンク＋5分ごとの色分け（ライブ）
- [ ] 運行情報：中央線・青梅線はコード実装済みだが、ジョルダンのメール検知が
      未セットアップのため実際にはまだ色が付かない（下記「未完了・次にやること」2番）
- [x] `?demo=1` デモモード
- [x] 取得失敗時のステータス表示（ヘッダー右）
- [x] 本番デプロイ（公開リポジトリ・Pages・OAuth）

## 未完了・次にやること（優先順）

### 1. Googleサインインが毎回必要（優先度中・原因未調査）

上記「Googleサインインが『毎回クリックが必要』な件」を参照。実害は小さい
（電源を入れ直した時に一回押すだけ）が、要件定義の「常時表示で放置」からは
少しずれている。時間があるときに原因を調べる。

### 2. 中央線・青梅線：ジョルダンのメール検知セットアップが未実施（優先度高・Hide側の作業待ち）

`traininfo.jreast.co.jp` の直接取得が **Akamai（Bot対策）によるIPブロック**で
GitHub Actionsから使えなかった問題（`server: AkamaiGHost` ヘッダーで確認済み、
2026-08-07）は、2026-08-08にジョルダンのメール検知方式へのコード側の切替は完了した
（上記「運行情報：中央線・青梅線をジョルダンのメール検知に切替」参照）。

ただし**実際に動き出すには、まだHide側の手動セットアップが5ステップ残っている**
（README.md「4. 運行情報（ジョルダンのメール検知）を設定する」）。これが終わるまでは
`train-mail.json`が存在しないため、中央線・青梅線のリンクは今まで通り無色のまま
（フロント側は「取れない＝平常運転」と決めつけない設計なので、実害はなく安全側に倒れる）。

セットアップが終わったら、最初の実メールの件名・本文を見て
`gas/train-status-watcher.gs`の`SEARCH_QUERY`/`ROUTE_PATTERNS`/キーワード群が
実物と合っているか確認・調整する作業も残っている（このスクリプトのコメント参照）。

**駅すぱあとAPI**（`https://docs.ekispert.com/v1/api/operationLine/service/rescuenow/information.html`、
レスキューナウ提供、JR・メトロ横断カバー）は代替案として調査済みだが、無料トライアルが
審査制で即座には使えないため保留のまま。ジョルダン方式がうまく機能しなかった場合の
セカンドオプションとして記録だけ残しておく（申請: `https://api-info.ekispert.com/form/trial/`）。

`scripts/fetch-train.mjs`には`DEBUG_TRAIN`環境変数でレスポンスヘッダー・本文を
ログ出力するデバッグコードを残してある（銀座線取得用。`.github/workflows/train.yml`の
env:に`DEBUG_TRAIN: '1'`を足せば有効化できる）。

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
- cron / dispatch がコミットするのは `train.json`・`train-mail.json`（いずれも平常/異常の
  色分け情報のみ、路線名と状態のみ。ジョルダンメールの本文そのものはリポジトリに残らない）
- このリポジトリ自体にAPIキー・Secretsは現状不要。ただし**GitHub PATはGAS側の
  Script Properties（Googleアカウント内）に保存される**ため、リポジトリのSecretsではない
  形でクレデンシャルが1つ増えている点に注意

---

*このファイルは Claude Code が更新している。作業内容を変えたら、このファイルも合わせて更新すること。*
