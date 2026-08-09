import { clear, el, showMessage } from './util.js';

// 定時ニュースダイジェスト（Gmailの自分宛メール）へのリンク一覧。
// 「これからの一週間」の右隣り（旧・Googleカレンダー埋め込み）に表示する
// （2026-08-08、Hideの要望で置き換え）。
//
// メールは youtree.3tree.3tree@gmail.com から自分自身に、件名
// 「定時ニュースダイジェスト YYYY-MM-DD HH:MM（日本時間）」で届く
// （テスト送信は件名に「【テスト】」が付く。ops/methodology/
// 定時ニュース配信では送信済みニュースを除外する.md、AGENTS.md参照）。
// 中身（各ニュース記事へのリンク）は使わず、**メール1通＝1行**として
// Gmail上でそのメールを開くリンクを並べる（Hideの明示的な指定）。
// 1行には「日時・件名・ニュース件数」を並べる（2026-08-08、Hideの指定）。

const NEWS_QUERY = 'subject:(定時ニュースダイジェスト) -テスト';
const NEWS_FETCH_RESULTS = 30; // 0件配信を除外した後でも表示枠を確保する
const NEWS_MAX_RESULTS = 10; // 欄に掲載するのは10件まで（2026-08-08、Hideの指定）

function decodeBase64Url(data) {
  if (!data) return '';
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    return '';
  }
}

// MIMEパートを再帰的にたどって、指定したmimeTypeの本文データ（base64url）を探す。
function findBodyPart(payload, mimeType) {
  if (!payload) return null;
  if (payload.mimeType === mimeType && payload.body?.data) return payload.body.data;
  for (const part of payload.parts || []) {
    const found = findBodyPart(part, mimeType);
    if (found) return found;
  }
  return null;
}

// 本文中の「原文を読む」等のボタンリンク（メールテンプレートで共通の背景色）の数を、
// ニュース件数の目安として数える。メールのHTMLテンプレートに依存した見た目上の
// カウントなので、テンプレートが変わると数え損なうことがある。その場合は件数を
// 表示しないだけにして、日時・件名の表示は壊さない（countArticlesがnullを返す）。
function countArticles(htmlBody) {
  if (!htmlBody) return null;
  if (/今回の新着重要情報はありません/.test(htmlBody)) return 0;
  const matches = htmlBody.match(/background:#1976d2/g);
  return matches ? matches.length : null;
}

async function fetchDigestMeta(token, id) {
  // 件数を数えるために本文（HTML）も取るので format=full を使う
  // （metadataだけで済ませたかったが、件数はヘッダーに無い）。
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  const headers = data.payload?.headers || [];
  const subject = headers.find((h) => h.name === 'Subject')?.value || '(件名なし)';
  const html = decodeBase64Url(findBodyPart(data.payload, 'text/html'));
  return {
    id,
    subject,
    internalDate: Number(data.internalDate || 0),
    count: countArticles(html),
  };
}

async function fetchDigestList(token) {
  const listUrl =
    'https://gmail.googleapis.com/gmail/v1/users/me/messages' +
    `?q=${encodeURIComponent(NEWS_QUERY)}&maxResults=${NEWS_FETCH_RESULTS}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!listRes.ok) throw new Error(`メール検索に失敗 (${listRes.status})`);
  const listData = await listRes.json();
  const ids = (listData.messages || []).map((m) => m.id);

  const items = await Promise.all(ids.map((id) => fetchDigestMeta(token, id)));
  // Gmailのlistは基本的に新しい順で返るが、念のため internalDate でも並べ直す
  // （＝「新しいものを上にアペンドしていく」という指定に合わせる）。
  return items
    .filter((item) => item && item.count !== 0)
    .sort((a, b) => b.internalDate - a.internalDate)
    .slice(0, NEWS_MAX_RESULTS);
}

// 「定時ニュースダイジェスト 2026-08-07 16:16（日本時間）」を
// 日時（「08/07 16:16」）と件名（日時を除いた部分）に分ける。
// 想定外の件名（形式が変わった等）が来ても、件名側にそのまま出すだけで壊れない。
function splitSubject(subject) {
  const m = subject.match(/^(.*?)\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  if (!m) return { date: '', title: subject };
  return { date: `${m[3]}/${m[4]} ${m[5]}`, title: m[1].trim() || subject };
}

function renderDigestList(items) {
  const list = document.getElementById('news-digest-list');
  if (!list) return;
  clear(list);

  if (!items.length) {
    list.appendChild(el('li', 'placeholder', '定時ニュースダイジェストがまだありません'));
    return;
  }

  for (const item of items) {
    const { date, title } = splitSubject(item.subject);
    const li = el('li', 'news-digest-item');
    const a = document.createElement('a');
    // #all/ なら INBOX から移動・アーカイブされていても開ける。
    a.href = `https://mail.google.com/mail/u/0/#all/${item.id}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'news-digest-link';

    if (date) a.appendChild(el('span', 'news-digest-date', date));
    a.appendChild(el('span', 'news-digest-title', title));
    if (item.count !== null && item.count !== undefined) {
      a.appendChild(el('span', 'news-digest-count', `${item.count}件`));
    }

    li.appendChild(a);
    list.appendChild(li);
  }
}

export async function updateNewsDigest(token, onStatus) {
  try {
    const items = await fetchDigestList(token);
    renderDigestList(items);
    onStatus?.('news', null, false);
  } catch (err) {
    console.error('定時ニュースダイジェストの取得に失敗', err);
    showMessage(document.getElementById('news-digest-list'), '定時ニュースの取得に失敗しました', true);
    onStatus?.('news', '定時ニュースの取得に失敗', true);
  }
}
