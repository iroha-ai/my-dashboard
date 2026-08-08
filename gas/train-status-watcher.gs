/**
 * ジョルダン乗換案内の「運行情報メール」を監視し、my-dashboard の運行情報欄
 * （中央線・青梅線）に反映する。銀座線は引き続き東京メトロの公式データを
 * 直接読む方式（scripts/fetch-train.mjs）のまま。
 *
 * 【これは Git 管理用の控えであって、実行はされない】
 * Google Apps Script はこのリポジトリから直接デプロイされない。
 * https://script.google.com で新規プロジェクトを作り、このファイルの中身を
 * まるごと貼り付けてから、Script Properties と時間主導型トリガーを設定すること。
 * 手順は README.md の「運行情報（ジョルダンのメール検知：中央線・青梅線）」を参照。
 *
 * 【要検証・要調整】
 * SEARCH_QUERY / ROUTE_PATTERNS / ALERT_KEYWORDS / NORMAL_KEYWORDS は、
 * ジョルダンの公式ページ（https://mb.jorudan.co.jp/os/annai/usefuluml.html）を
 * もとにした推測で、実際の配信メールの件名・本文の文言までは未確認。
 * 最初のメールが届いたら実物の件名・本文を見て、この4つを実態に合わせて調整すること
 * （特に SEARCH_QUERY の送信元アドレスは、実際に届いたメールのヘッダーで確認して埋める）。
 *
 * 【設計: ハートビート方式】
 * ジョルダンは状態が変わったときだけメールを送ると考えられる（推測）ため、
 * 「メールが来ない＝平常運転」と「メールが来ない＝監視自体が壊れている」を
 * 区別できない。これに対処するため、最後に確認できた各路線の状態を
 * Script Properties（LAST_STATE）にキャッシュしておき、新着メールの有無に
 * 関わらず**毎回のトリガー実行で必ず1回 repository_dispatch を送る**。
 * こうすると train-mail.json の updatedAt が5分おきに更新され続けるので、
 * フロント側（js/train.js）の「20分以上更新が無ければ止まっていると疑う」
 * という既存の判定ロジックをそのまま使い回せる。
 * ただし、これでも「ジョルダンからのメール配信自体が止まっている」場合は
 * 検知できない（updatedAtは更新され続けるが中身が古いまま）。GASの実行ログを
 * 時々確認するか、実際に運行障害があったときに正しく反応するか定点観測すること。
 *
 * 全体の流れ:
 *   1. 5分おきのトリガーで checkJorudanMail() が走る
 *   2. Gmail から未読の運行情報メールを検索する
 *   3. 件名・本文からどの路線か／平常運転か異常かを判定し、キャッシュを更新する
 *   4. 新着の有無に関わらず、キャッシュの中身をまとめて1回だけ
 *      GitHub の repository_dispatch API に送る
 *   5. train-mail.yml が data ブランチの train-mail.json を書き換え、
 *      ダッシュボードに反映される
 */

// ---------- 設定（Script Properties で上書きされない既定値） ----------

// Gmail 検索クエリ。件名に「運行情報」を含む未読メールを対象にしている。
// 送信元が判明したら `from:xxx@jorudan.co.jp` 等を足して絞り込むこと（誤検知を減らせる）。
const SEARCH_QUERY = 'subject:(運行情報) is:unread newer_than:2d';

// 路線ID → メール本文中に出てきそうな表記のパターン（部分一致）。
// 対象は中央線（快速）・青梅線の2路線のみ（銀座線は東京メトロ直読みのため対象外）。
const ROUTE_PATTERNS = {
  chuo: { label: '中央線', patterns: ['中央線（快速）', '中央線(快速)', '中央線快速'] },
  ome: { label: '青梅線', patterns: ['青梅線'] },
};

// 「異常あり」と判定するキーワード（いずれかを含めば alert）。
const ALERT_KEYWORDS = ['運転見合わせ', '運休', '遅延', '一部運休', 'ダイヤが乱れ', '運転を見合わせ'];

// 「平常に戻った」と判定するキーワード（いずれかを含めば normal。ALERT より優先して判定する）。
const NORMAL_KEYWORDS = ['運転再開', '平常運転', '運転を再開'];

// ---------- メイン ----------

function checkJorudanMail() {
  const state = loadState();
  const threads = GmailApp.search(SEARCH_QUERY, 0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      if (!message.isUnread()) continue;

      const subject = message.getSubject();
      const body = message.getPlainBody();
      const text = `${subject}\n${body}`;

      const status = detectStatus(text);
      const routeIds = matchRoutes(text);

      if (status && routeIds.length > 0) {
        for (const id of routeIds) {
          state[id] = {
            ok: true,
            isNormal: status === 'normal',
            status: status === 'normal' ? '平常運転' : '運行に影響あり（詳細はメール参照）',
            source: subject,
          };
        }
      }
      // 判定できない・対象路線が含まれないメールも、既読にするだけで何もしない。
      message.markRead();
    }
  }

  saveState(state);
  dispatchHeartbeat(state);
}

function detectStatus(text) {
  if (NORMAL_KEYWORDS.some((k) => text.indexOf(k) !== -1)) return 'normal';
  if (ALERT_KEYWORDS.some((k) => text.indexOf(k) !== -1)) return 'alert';
  return null;
}

function matchRoutes(text) {
  return Object.keys(ROUTE_PATTERNS).filter((id) =>
    ROUTE_PATTERNS[id].patterns.some((pattern) => text.indexOf(pattern) !== -1)
  );
}

// ---------- 状態キャッシュ（Script Properties） ----------

function loadState() {
  const raw = PropertiesService.getScriptProperties().getProperty('LAST_STATE');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveState(state) {
  PropertiesService.getScriptProperties().setProperty('LAST_STATE', JSON.stringify(state));
}

// ---------- GitHub への送信（新着の有無に関わらず毎回1回） ----------

function dispatchHeartbeat(state) {
  const items = Object.keys(ROUTE_PATTERNS).map((id) => {
    const cached = state[id];
    if (!cached) {
      // まだ一度もメールで確認できていない路線は「不明」のまま送る。
      // フロント側は ok:false を「取れない」として扱い、色を変えない。
      return { id, label: ROUTE_PATTERNS[id].label, ok: false, reason: '未確認（ジョルダンからのメール未着）' };
    }
    return { id, label: ROUTE_PATTERNS[id].label, ...cached };
  });

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  const repo = props.getProperty('GITHUB_REPO'); // 例: 'iroha-ai/my-dashboard'

  if (!token || !repo) {
    Logger.log('GITHUB_TOKEN / GITHUB_REPO が Script Properties に未設定です');
    return;
  }

  const url = `https://api.github.com/repos/${repo}/dispatches`;
  const payload = {
    event_type: 'train-mail',
    client_payload: { items },
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code >= 300) {
    Logger.log(`GitHub dispatch 失敗: ${code} ${res.getContentText()}`);
  } else {
    Logger.log(`GitHub dispatch 成功: ${JSON.stringify(items)}`);
  }
}

// ---------- セットアップ用（GASエディタから手動で一度だけ実行する） ----------

/**
 * 5分おきの時間主導型トリガーを作る。既存の同名トリガーは一度消してから作り直す
 * （重複登録を防ぐため）。GASエディタでこの関数を選んで実行ボタンを押すこと。
 * 初回実行時にGmail読み取りの権限承認ダイアログが出るので許可すること。
 */
function installTrigger() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'checkJorudanMail') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  ScriptApp.newTrigger('checkJorudanMail').timeBased().everyMinutes(5).create();
  Logger.log('トリガーを設定しました（5分おき）');
}
