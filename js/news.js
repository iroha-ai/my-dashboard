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

const NEWS_QUERY = 'subject:(定時ニュースダイジェスト) -テスト';
const NEWS_MAX_RESULTS = 20;

async function fetchDigestMeta(token, id) {
  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
    '?format=metadata&metadataHeaders=Subject&metadataHeaders=Date';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  const headers = data.payload?.headers || [];
  const subject = headers.find((h) => h.name === 'Subject')?.value || '(件名なし)';
  return { id, subject, internalDate: Number(data.internalDate || 0) };
}

async function fetchDigestList(token) {
  const listUrl =
    'https://gmail.googleapis.com/gmail/v1/users/me/messages' +
    `?q=${encodeURIComponent(NEWS_QUERY)}&maxResults=${NEWS_MAX_RESULTS}`;
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
  return items.filter(Boolean).sort((a, b) => b.internalDate - a.internalDate);
}

// 「定時ニュースダイジェスト 2026-08-07 16:16（日本時間）」→「08/07 16:16」に短縮。
// 想定外の件名（形式が変わった等）が来ても、そのまま出すだけで壊れない。
function formatLabel(subject) {
  const m = subject.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  if (m) return `${m[2]}/${m[3]} ${m[4]}`;
  return subject;
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
    const li = el('li', 'news-digest-item');
    const a = document.createElement('a');
    // #all/ なら INBOX から移動・アーカイブされていても開ける。
    a.href = `https://mail.google.com/mail/u/0/#all/${item.id}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'news-digest-link';
    a.textContent = formatLabel(item.subject);
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
