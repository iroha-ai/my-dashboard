import { clear, el, showMessage } from './util.js?v=20260813-weather-fallback';

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
const NEWS_STATUS_URL = './data/news-digest-status.json';

function renderDeliveryStatus(status) {
  const node = document.getElementById('news-digest-status');
  if (!node) return;
  if (status?.status !== 'no_news' || !status.scheduledAt) {
    node.textContent = '';
    return;
  }
  const date = new Date(status.scheduledAt);
  if (Number.isNaN(date.getTime())) {
    node.textContent = '';
    return;
  }
  const label = new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  }).format(date);
  node.textContent = `${label}　送信ニュースなし`;
}

export async function updateDeliveryStatus() {
  try {
    const response = await fetch(`${NEWS_STATUS_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`status ${response.status}`);
    renderDeliveryStatus(await response.json());
  } catch (err) {
    console.warn('定時ニュースの配信状態を取得できませんでした', err);
    renderDeliveryStatus(null);
  }
}

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

// 件数推定用に HTML エンティティを最低限戻す。
function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// 本文からニュース件数を推定する。テンプレート変更に備え、複数の取り方を順に試す。
// どれも当てはまらなければ null（件数は表示しないが、日時・件名・リンクは残す）。
function countArticles(htmlBody, plainBody = '') {
  const html = decodeHtmlEntities(htmlBody || '');
  const plain = plainBody || html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n');
  const source = `${html}\n${plain}`;

  if (!source.trim()) return null;

  // 0件配信
  if (/今回の新着重要情報はありません/.test(source)) return 0;
  if (/今回は新着ニュースがなかった/.test(source)) return 0;

  // news-digest-html.py（2026-08-17〜）: ヘッダー「… ・ 新着 N 件」
  const headerCount = source.match(/新着\s*[：:]?\s*(\d+)\s*件/);
  if (headerCount) return Number(headerCount[1]);

  // 旧テンプレート: 「原文を読む」リンク／ボタン
  const readOriginal = source.match(/原文を読む/g);
  if (readOriginal?.length) return readOriginal.length;

  // 旧テンプレート: 青ボタンの background（空白・background-color・rgb 表記ゆれ）
  const legacyButtons = html.match(/background(?:-color)?\s*:\s*(?:#1976d2|rgb\(\s*25\s*,\s*118\s*,\s*210\s*\))/gi);
  if (legacyButtons?.length) return legacyButtons.length;

  // news-digest-html.py の記事見出し「1. タイトル」
  const numberedHeadings = html.match(/<h[1-3][^>]*>\s*\d+\./gi);
  if (numberedHeadings?.length) return numberedHeadings.length;

  // プレーンテキスト／HTML 化後テキストの番号付き行
  const numberedLines = plain.match(/^\s*\d+[\.)．、]\s+/gm);
  if (numberedLines?.length) return numberedLines.length;

  return null;
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
  const plain = decodeBase64Url(findBodyPart(data.payload, 'text/plain'));
  return {
    id,
    subject,
    internalDate: Number(data.internalDate || 0),
    count: countArticles(html, plain),
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
    await updateDeliveryStatus();
    const items = await fetchDigestList(token);
    renderDigestList(items);
    onStatus?.('news', null, false);
  } catch (err) {
    console.error('定時ニュースダイジェストの取得に失敗', err);
    showMessage(document.getElementById('news-digest-list'), '定時ニュースの取得に失敗しました', true);
    onStatus?.('news', '定時ニュースの取得に失敗', true);
  }
}
